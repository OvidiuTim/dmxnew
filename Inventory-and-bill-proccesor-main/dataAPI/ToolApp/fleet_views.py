import json
from datetime import timedelta
from decimal import Decimal, InvalidOperation
from io import BytesIO
from pathlib import Path

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.http import FileResponse, HttpResponse, JsonResponse
from django.utils import timezone
from django.utils.dateparse import parse_date
from django.utils.timezone import localdate
from django.views.decorators.csrf import csrf_exempt

from ToolApp.fleet_services import (
    blocking_equipment_documents,
    close_open_utilaj_sessions,
    document_rows,
    missing_employee_authorizations,
)
from ToolApp.models import (
    AlimentareUtilaj,
    AttendanceSession,
    ConstructionSite,
    DocumentUtilaj,
    DocumentUtilajVersiune,
    EmployeeDocument,
    FleetAuditLog,
    IncercareUtilajBlocata,
    SesiuneUtilaj,
    SesizareDefectUtilaj,
    RevizieUtilaj,
    TipDocumentUtilaj,
    Utilaj,
)
from ToolApp.security import get_app_user_from_request, request_has_admin
from ToolApp.views import MISSING_EXIT_SOURCE_TAG, _find_user_by_pin


def _error(code, message, status=400, **extra):
    return JsonResponse({"ok": False, "error_code": code, "error": message, **extra}, status=status)


def _json_body(request):
    try:
        data = json.loads(request.body or "{}")
    except (TypeError, ValueError, UnicodeDecodeError):
        return None
    return data if isinstance(data, dict) else None


def _employee_for_action(request, data):
    app_user = getattr(request, "app_user", None) or get_app_user_from_request(request)
    if app_user:
        return app_user.employee
    pin = str(data.get("pin") or "").strip()
    return _find_user_by_pin(pin) if pin else None


def _actor(request):
    if request_has_admin(request):
        return "Administrator"
    app_user = getattr(request, "app_user", None) or get_app_user_from_request(request)
    if app_user:
        return app_user.employee.UserName or app_user.username
    return "Sistem"


def _audit(request, action, utilaj=None, **details):
    FleetAuditLog.objects.create(
        utilaj=utilaj,
        actiune=action,
        actor=_actor(request),
        detalii=details,
    )


def _blocked_attempt(utilaj, employee, code, message, status=409, **extra):
    IncercareUtilajBlocata.objects.create(
        utilaj=utilaj,
        angajat=employee,
        cod=code,
        motiv=message,
    )
    FleetAuditLog.objects.create(
        utilaj=utilaj,
        actiune="utilizare_blocata",
        actor=employee.UserName if employee else "Necunoscut",
        detalii={"code": code, "message": message},
    )
    return _error(code, message, status, **extra)


def _decimal(value, field):
    if value in (None, ""):
        return None
    try:
        parsed = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise ValueError(f"{field} trebuie să fie un număr valid.")
    if parsed < 0:
        raise ValueError(f"{field} nu poate fi negativ.")
    return parsed


def _gps(data):
    value = data.get("gps") or {}
    if not isinstance(value, dict):
        return None, None, None
    try:
        return (
            float(value["lat"]) if value.get("lat") is not None else None,
            float(value["lng"]) if value.get("lng") is not None else None,
            float(value["accuracy"]) if value.get("accuracy") is not None else None,
        )
    except (TypeError, ValueError):
        raise ValueError("Coordonatele GPS nu sunt valide.")


def _session_payload(session):
    if not session:
        return None
    return {
        "id": session.pk,
        "employee": {"id": session.angajat_id, "name": session.angajat.UserName},
        "started_at": timezone.localtime(session.inceput).isoformat(),
        "ended_at": timezone.localtime(session.sfarsit).isoformat() if session.sfarsit else None,
        "start_counter": str(session.contor_inceput) if session.contor_inceput is not None else None,
        "end_counter": str(session.contor_sfarsit) if session.contor_sfarsit is not None else None,
        "close_reason": session.motiv_inchidere or None,
        "site": session.santier.name if session.santier else None,
        "duration_seconds": max(0, int(((session.sfarsit or timezone.now()) - session.inceput).total_seconds())),
    }


def _utilaj_payload(utilaj, request=None):
    open_session = utilaj.sesiuni.select_related("angajat").filter(sfarsit__isnull=True).first()
    return {
        "id": utilaj.pk,
        "token": str(utilaj.token_qr),
        "code": utilaj.cod_intern,
        "name": utilaj.denumire,
        "registration_number": utilaj.nr_inmatriculare,
        "chassis_series": utilaj.serie_sasiu,
        "manufacture_year": utilaj.an_fabricatie,
        "owner": utilaj.proprietar,
        "ownership_type": utilaj.tip_proprietate,
        "internal_rate": str(utilaj.tarif_intern) if utilaj.tarif_intern is not None else None,
        "category": utilaj.categorie,
        "category_label": utilaj.get_categorie_display(),
        "counter_type": utilaj.tip_contor,
        "current_counter": str(utilaj.contor_curent) if utilaj.contor_curent is not None else None,
        "state": utilaj.stare,
        "state_label": utilaj.get_stare_display(),
        "site": ({"id": utilaj.santier_curent_id, "code": utilaj.santier_curent.code, "name": utilaj.santier_curent.name}
                 if utilaj.santier_curent else None),
        "documents": document_rows(utilaj, request=request),
        "active_session": _session_payload(open_session),
        "has_problems": utilaj.stare in {Utilaj.Stare.DEFECT, Utilaj.Stare.SERVICE}
            or any(row["status"] in {"missing", "expired"} for row in document_rows(utilaj)),
    }


def _parse_iso_date(value, field_name):
    if not value:
        return None
    parsed = parse_date(str(value))
    if not parsed:
        raise ValueError(f"{field_name} nu este o dată validă.")
    return parsed


def _equipment_values(data, instance=None):
    values = {}
    text_fields = {
        "code": "cod_intern", "name": "denumire", "registration_number": "nr_inmatriculare",
        "chassis_series": "serie_sasiu", "owner": "proprietar", "ownership_type": "tip_proprietate",
    }
    for incoming, model_field in text_fields.items():
        if incoming in data:
            values[model_field] = str(data.get(incoming) or "").strip()
    for incoming, model_field in (("category", "categorie"), ("counter_type", "tip_contor"), ("state", "stare")):
        if incoming in data:
            values[model_field] = str(data.get(incoming) or "").strip()
    if "current_counter" in data:
        values["contor_curent"] = _decimal(data.get("current_counter"), "Contorul")
    if "internal_rate" in data:
        values["tarif_intern"] = _decimal(data.get("internal_rate"), "Tariful intern")
    if "manufacture_year" in data:
        year = data.get("manufacture_year")
        values["an_fabricatie"] = int(year) if year not in (None, "") else None
    if "site_id" in data:
        site_id = data.get("site_id")
        values["santier_curent"] = ConstructionSite.objects.filter(pk=site_id).first() if site_id else None
        if site_id and not values["santier_curent"]:
            raise ValueError("Șantierul selectat nu există.")
    if not instance and (not values.get("cod_intern") or not values.get("denumire")):
        raise ValueError("Codul intern și denumirea sunt obligatorii.")
    return values


@csrf_exempt
def fleet_lookup(request):
    """Exact code/registration lookup for employees who cannot scan the QR."""
    if request.method != "GET":
        return _error("METHOD_NOT_ALLOWED", "Este permis doar GET.", 405)
    query = str(request.GET.get("q") or "").strip()
    if not query:
        return _error("QUERY_REQUIRED", "Introdu codul utilajului sau numărul de înmatriculare.")
    utilaj = Utilaj.objects.select_related("santier_curent").filter(activ=True).filter(
        Q(cod_intern__iexact=query) | Q(nr_inmatriculare__iexact=query)
    ).first()
    if not utilaj:
        return _error("NOT_FOUND", "Utilajul nu a fost găsit.", 404)
    return JsonResponse({"ok": True, "equipment": _utilaj_payload(utilaj, request=request)})


@csrf_exempt
def fleet_equipment_collection(request):
    if request.method == "GET":
        items = Utilaj.objects.select_related("santier_curent").filter(activ=True)
        query = str(request.GET.get("q") or "").strip()
        if query:
            items = items.filter(Q(cod_intern__icontains=query) | Q(denumire__icontains=query) | Q(nr_inmatriculare__icontains=query))
        if request.GET.get("category"):
            items = items.filter(categorie=request.GET["category"])
        if request.GET.get("state"):
            items = items.filter(stare=request.GET["state"])
        if request.GET.get("site"):
            items = items.filter(santier_curent_id=request.GET["site"])
        payload = [_utilaj_payload(item, request=request) for item in items]
        if request.GET.get("problems") in {"1", "true"}:
            payload = [item for item in payload if item["has_problems"]]
        return JsonResponse({"ok": True, "equipment": payload})
    if request.method == "POST":
        data = _json_body(request)
        if data is None:
            return _error("INVALID_JSON", "Corpul cererii nu este JSON valid.")
        try:
            values = _equipment_values(data)
            with transaction.atomic():
                utilaj = Utilaj.objects.create(**values)
                type_ids = data.get("required_document_type_ids") or []
                utilaj.tipuri_document_necesare.set(TipDocumentUtilaj.objects.filter(pk__in=type_ids, activ=True))
                _audit(request, "utilaj_creat", utilaj, code=utilaj.cod_intern)
        except (ValueError, TypeError) as exc:
            return _error("INVALID_INPUT", str(exc))
        except IntegrityError:
            return _error("DUPLICATE_CODE", "Există deja un utilaj cu acest cod intern.", 409)
        return JsonResponse({"ok": True, "equipment": _utilaj_payload(utilaj, request=request)}, status=201)
    return _error("METHOD_NOT_ALLOWED", "Este permis doar GET sau POST.", 405)


@csrf_exempt
def fleet_equipment_detail(request, equipment_id):
    utilaj = Utilaj.objects.select_related("santier_curent").filter(pk=equipment_id, activ=True).first()
    if not utilaj:
        return _error("NOT_FOUND", "Utilajul nu a fost găsit.", 404)
    if request.method == "GET":
        payload = _utilaj_payload(utilaj, request=request)
        payload["required_document_type_ids"] = list(utilaj.tipuri_document_necesare.values_list("pk", flat=True))
        payload["sessions"] = [_session_payload(item) for item in utilaj.sesiuni.select_related("angajat", "santier")[:100]]
        payload["defects"] = [_defect_payload(item, request) for item in utilaj.defecte.select_related("raportat_de")[:100]]
        payload["fuel"] = [_fuel_payload(item) for item in utilaj.alimentari.select_related("angajat")[:100]]
        payload["document_history"] = [
            {
                "id": item.pk,
                "type": item.document.tip.nume,
                "expiry_date": item.data_expirare.isoformat() if item.data_expirare else None,
                "file_name": item.nume_fisier_original,
                "uploaded_by": item.incarcat_de,
                "created_at": timezone.localtime(item.created_at).isoformat(),
                "file_url": request.build_absolute_uri(
                    f"/api/fleet/equipment/document-versions/{item.pk}/download/"
                ) if item.fisier else "",
            }
            for item in DocumentUtilajVersiune.objects.select_related("document__tip")
            .filter(document__utilaj=utilaj)[:100]
        ]
        payload["maintenance"] = [_maintenance_payload(item) for item in utilaj.revizii.all()[:100]]
        payload["audit"] = [_audit_payload(item) for item in utilaj.audit_logs.all()[:100]]
        return JsonResponse({"ok": True, "equipment": payload})
    if request.method in {"PUT", "PATCH"}:
        data = _json_body(request)
        if data is None:
            return _error("INVALID_JSON", "Corpul cererii nu este JSON valid.")
        try:
            values = _equipment_values(data, instance=utilaj)
            before = {field: str(getattr(utilaj, field, "")) for field in values}
            for field, value in values.items():
                setattr(utilaj, field, value)
            utilaj.save()
            if "required_document_type_ids" in data:
                utilaj.tipuri_document_necesare.set(
                    TipDocumentUtilaj.objects.filter(pk__in=(data.get("required_document_type_ids") or []), activ=True)
                )
            _audit(request, "utilaj_modificat", utilaj, before=before)
        except (ValueError, TypeError) as exc:
            return _error("INVALID_INPUT", str(exc))
        except IntegrityError:
            return _error("DUPLICATE_CODE", "Există deja un utilaj cu acest cod intern.", 409)
        return JsonResponse({"ok": True, "equipment": _utilaj_payload(utilaj, request=request)})
    if request.method == "DELETE":
        if utilaj.sesiuni.filter(sfarsit__isnull=True).exists():
            return _error("ACTIVE_SESSION", "Utilajul nu poate fi arhivat cât timp este în lucru.", 409)
        utilaj.activ = False
        utilaj.save(update_fields=("activ", "updated_at"))
        _audit(request, "utilaj_arhivat", utilaj)
        return JsonResponse({"ok": True})
    return _error("METHOD_NOT_ALLOWED", "Metodă neacceptată.", 405)


def fleet_equipment_qr(request, equipment_id):
    if request.method != "GET":
        return _error("METHOD_NOT_ALLOWED", "Este permis doar GET.", 405)
    utilaj = Utilaj.objects.filter(pk=equipment_id, activ=True).first()
    if not utilaj:
        return _error("NOT_FOUND", "Utilajul nu a fost găsit.", 404)
    import qrcode
    target = request.build_absolute_uri(f"/pontaj/utilaj/{utilaj.token_qr}")
    image = qrcode.make(target)
    output = BytesIO()
    image.save(output, format="PNG")
    response = HttpResponse(output.getvalue(), content_type="image/png")
    response["Content-Disposition"] = f'inline; filename="{utilaj.cod_intern}-qr.png"'
    response["Cache-Control"] = "public, max-age=86400"
    return response


def _defect_payload(item, request=None):
    photo_url = request.build_absolute_uri(item.fotografie.url) if request and item.fotografie else (item.fotografie.url if item.fotografie else None)
    return {
        "id": item.pk, "equipment_id": item.utilaj_id, "equipment": item.utilaj.cod_intern,
        "reported_by": item.raportat_de.UserName if item.raportat_de else None,
        "description": item.descriere, "photo_url": photo_url,
        "severity": item.gravitate, "severity_label": item.get_gravitate_display(),
        "status": item.status, "status_label": item.get_status_display(),
        "assignee": item.responsabil, "repair_cost": str(item.cost_reparatie) if item.cost_reparatie is not None else None,
        "resolution_notes": item.observatii_rezolvare,
        "created_at": timezone.localtime(item.created_at).isoformat(),
        "resolved_at": timezone.localtime(item.resolved_at).isoformat() if item.resolved_at else None,
    }


def _fuel_payload(item):
    return {
        "id": item.pk, "date": item.data.isoformat(), "liters": str(item.litri), "cost": str(item.cost),
        "counter": str(item.contor) if item.contor is not None else None,
        "employee": item.angajat.UserName if item.angajat else None,
    }


def _audit_payload(item):
    return {
        "id": item.pk, "action": item.actiune, "actor": item.actor, "details": item.detalii,
        "created_at": timezone.localtime(item.created_at).isoformat(),
    }


def _maintenance_payload(item):
    remaining = None
    if item.contor_scadenta is not None and item.utilaj.contor_curent is not None:
        remaining = item.contor_scadenta - item.utilaj.contor_curent
    return {
        "id": item.pk,
        "equipment_id": item.utilaj_id,
        "equipment": item.utilaj.cod_intern,
        "name": item.denumire,
        "due_date": item.data_scadenta.isoformat() if item.data_scadenta else None,
        "due_counter": str(item.contor_scadenta) if item.contor_scadenta is not None else None,
        "remaining_counter": str(remaining) if remaining is not None else None,
        "status": item.status,
        "status_label": item.get_status_display(),
        "notes": item.observatii,
        "cost": str(item.cost) if item.cost is not None else None,
        "completed_at": timezone.localtime(item.finalizata_la).isoformat() if item.finalizata_la else None,
    }


def fleet_dashboard(request):
    if request.method != "GET":
        return _error("METHOD_NOT_ALLOWED", "Este permis doar GET.", 405)
    today = localdate()
    now = timezone.now()
    equipment = list(Utilaj.objects.select_related("santier_curent").filter(activ=True))
    documents = DocumentUtilaj.objects.select_related("utilaj", "tip").filter(utilaj__activ=True, data_expirare__isnull=False)
    open_sessions = list(SesiuneUtilaj.objects.select_related("utilaj", "angajat", "santier").filter(sfarsit__isnull=True))
    expired = documents.filter(data_expirare__lt=today).count()
    expiring_7 = documents.filter(data_expirare__range=(today, today + timedelta(days=7))).count()
    expiring_30 = documents.filter(data_expirare__range=(today, today + timedelta(days=30))).count()
    yesterday_open = SesiuneUtilaj.objects.filter(sfarsit__isnull=True, inceput__date__lt=today).count()
    blocked_today = IncercareUtilajBlocata.objects.filter(created_at__date=today).count()
    active_ids = {item.utilaj_id for item in open_sessions}
    last_used = {}
    # Evită expresii dependente de baza de date: ultima utilizare este calculată din valorile existente.
    for utilaj_id, value in SesiuneUtilaj.objects.values_list("utilaj_id", "inceput").order_by("utilaj_id", "-inceput"):
        last_used.setdefault(utilaj_id, value)
    idle = []
    for item in equipment:
        last = last_used.get(item.pk)
        days = (today - timezone.localdate(last)).days if last else None
        if item.pk not in active_ids and (days is None or days > 7):
            idle.append({"id": item.pk, "code": item.cod_intern, "name": item.denumire, "days": days, "site": item.santier_curent.name if item.santier_curent else None})
    events = []
    for session in SesiuneUtilaj.objects.select_related("utilaj", "angajat").order_by("-inceput")[:8]:
        events.append({"type": "usage", "at": session.inceput, "title": f"{session.angajat.UserName} a luat {session.utilaj.cod_intern}"})
    for defect in SesizareDefectUtilaj.objects.select_related("utilaj", "raportat_de").order_by("-created_at")[:8]:
        events.append({"type": "defect", "at": defect.created_at, "title": f"Defect raportat la {defect.utilaj.cod_intern}"})
    for blocked in IncercareUtilajBlocata.objects.select_related("utilaj", "angajat").order_by("-created_at")[:8]:
        events.append({"type": "blocked", "at": blocked.created_at, "title": f"Utilizare blocată: {blocked.utilaj.cod_intern}"})
    events.sort(key=lambda row: row["at"], reverse=True)
    return JsonResponse({
        "ok": True,
        "cards": {
            "expired_documents": expired, "expiring_7_days": expiring_7, "expiring_30_days": expiring_30,
            "defective_or_service": sum(item.stare in {Utilaj.Stare.DEFECT, Utilaj.Stare.SERVICE} for item in equipment),
            "not_returned_yesterday": yesterday_open, "blocked_attempts": blocked_today,
        },
        "field": {
            "in_use": len(open_sessions),
            "available": sum(item.stare == Utilaj.Stare.DISPONIBIL for item in equipment),
            "items": [{"code": row.utilaj.cod_intern, "name": row.utilaj.denumire, "employee": row.angajat.UserName,
                       "site": row.santier.name if row.santier else (row.utilaj.santier_curent.name if row.utilaj.santier_curent else None),
                       "started_at": timezone.localtime(row.inceput).isoformat()} for row in open_sessions],
        },
        "events": [{**row, "at": timezone.localtime(row["at"]).isoformat()} for row in events[:12]],
        "idle": idle,
        "sites": [{"id": item.pk, "code": item.code, "name": item.name} for item in ConstructionSite.objects.filter(status=ConstructionSite.Status.ACTIVE)],
        "document_types": [{"id": item.pk, "name": item.nume, "blocking": item.blocheaza_utilizarea,
                            "warning_days": item.zile_avertizare} for item in TipDocumentUtilaj.objects.filter(activ=True)],
        "generated_at": timezone.localtime(now).isoformat(),
    })


def fleet_expirations(request):
    if request.method != "GET":
        return _error("METHOD_NOT_ALLOWED", "Este permis doar GET.", 405)
    today = localdate()
    rows = []
    for item in DocumentUtilaj.objects.select_related("utilaj", "tip").filter(utilaj__activ=True, data_expirare__isnull=False).order_by("data_expirare"):
        days = (item.data_expirare - today).days
        group = "expired" if days < 0 else "7" if days <= 7 else "30" if days <= 30 else "60" if days <= 60 else "later"
        rows.append({
            "id": item.pk, "equipment_id": item.utilaj_id, "equipment": item.utilaj.cod_intern,
            "equipment_name": item.utilaj.denumire, "type_id": item.tip_id, "type": item.tip.nume,
            "expiry_date": item.data_expirare.isoformat(), "days_remaining": days, "group": group,
            "file_url": request.build_absolute_uri(f"/api/fleet/qr/{item.utilaj.token_qr}/documents/{item.pk}/") if item.fisier else "",
        })
    authorization_type_ids = TipDocumentUtilaj.objects.filter(activ=True).values_list(
        "documente_angajat_necesare__id", flat=True
    )
    authorizations = []
    for item in EmployeeDocument.objects.select_related("employee", "document_type").filter(
        document_type_id__in=authorization_type_ids,
        has_expiry=True,
        expiry_date__isnull=False,
    ).order_by("expiry_date"):
        days = (item.expiry_date - today).days
        if days > 60:
            continue
        group = "expired" if days < 0 else "7" if days <= 7 else "30" if days <= 30 else "60"
        authorizations.append({
            "id": item.pk,
            "employee_id": item.employee_id,
            "employee": item.employee.UserName,
            "type": item.document_type.name,
            "expiry_date": item.expiry_date.isoformat(),
            "days_remaining": days,
            "group": group,
        })
    return JsonResponse({"ok": True, "rows": rows, "authorizations": authorizations})


@csrf_exempt
def fleet_document_types(request):
    if request.method == "GET":
        return JsonResponse({"ok": True, "types": [
            {"id": item.pk, "name": item.nume, "blocking": item.blocheaza_utilizarea, "warning_days": item.zile_avertizare}
            for item in TipDocumentUtilaj.objects.filter(activ=True)
        ]})
    if request.method == "POST":
        data = _json_body(request)
        if data is None or not str(data.get("name") or "").strip():
            return _error("INVALID_INPUT", "Denumirea tipului este obligatorie.")
        item, created = TipDocumentUtilaj.objects.get_or_create(
            nume=str(data["name"]).strip(),
            defaults={"blocheaza_utilizarea": bool(data.get("blocking")), "zile_avertizare": int(data.get("warning_days") or 30)},
        )
        return JsonResponse({"ok": True, "type": {"id": item.pk, "name": item.nume, "blocking": item.blocheaza_utilizarea,
                                                      "warning_days": item.zile_avertizare}}, status=201 if created else 200)
    return _error("METHOD_NOT_ALLOWED", "Metodă neacceptată.", 405)


@csrf_exempt
def fleet_documents(request):
    if request.method != "POST":
        return _error("METHOD_NOT_ALLOWED", "Este permis doar POST.", 405)
    try:
        utilaj = Utilaj.objects.get(pk=request.POST.get("equipment_id"), activ=True)
        tip = TipDocumentUtilaj.objects.get(pk=request.POST.get("type_id"), activ=True)
        expiry = _parse_iso_date(request.POST.get("expiry_date"), "Data expirării")
    except (Utilaj.DoesNotExist, TipDocumentUtilaj.DoesNotExist, ValueError) as exc:
        return _error("INVALID_INPUT", str(exc) or "Utilajul sau tipul documentului nu există.")
    uploaded = request.FILES.get("file")
    current = DocumentUtilaj.objects.filter(utilaj=utilaj, tip=tip).first()
    if not current and not uploaded:
        return _error("FILE_REQUIRED", "Fișierul este obligatoriu pentru primul document.")
    if current:
        current.data_expirare = expiry
        if uploaded:
            current.fisier = uploaded
            current.nume_fisier_original = uploaded.name
        current.save()
        document = current
    else:
        document = DocumentUtilaj.objects.create(utilaj=utilaj, tip=tip, data_expirare=expiry, fisier=uploaded,
                                                 nume_fisier_original=uploaded.name if uploaded else "")
    DocumentUtilajVersiune.objects.create(
        document=document,
        data_expirare=document.data_expirare,
        fisier=document.fisier.name if document.fisier else "",
        nume_fisier_original=document.nume_fisier_original,
        incarcat_de=_actor(request),
    )
    utilaj.tipuri_document_necesare.add(tip)
    _audit(request, "document_reinnoit" if current else "document_adaugat", utilaj, document_type=tip.nume,
           expiry_date=expiry.isoformat() if expiry else None)
    return JsonResponse({"ok": True, "equipment": _utilaj_payload(utilaj, request=request)})


def fleet_sessions(request):
    if request.method != "GET":
        return _error("METHOD_NOT_ALLOWED", "Este permis doar GET.", 405)
    rows = SesiuneUtilaj.objects.select_related("utilaj", "angajat", "santier", "attendance_session")
    start = _parse_iso_date(request.GET.get("start"), "Data de început") if request.GET.get("start") else None
    end = _parse_iso_date(request.GET.get("end"), "Data de sfârșit") if request.GET.get("end") else None
    if start: rows = rows.filter(inceput__date__gte=start)
    if end: rows = rows.filter(inceput__date__lte=end)
    if request.GET.get("equipment"): rows = rows.filter(utilaj_id=request.GET["equipment"])
    if request.GET.get("employee"): rows = rows.filter(angajat_id=request.GET["employee"])
    if request.GET.get("site"): rows = rows.filter(santier_id=request.GET["site"])
    payload = []
    for row in rows[:1000]:
        item = _session_payload(row)
        attendance_seconds = row.attendance_session.duration_seconds if row.attendance_session else None
        item.update({"equipment_id": row.utilaj_id, "equipment": row.utilaj.cod_intern, "equipment_name": row.utilaj.denumire,
                     "attendance_mismatch": not row.attendance_session_id or (attendance_seconds is not None and item["duration_seconds"] > attendance_seconds),
                     "suspicious_counter": row.contor_sfarsit is not None and row.contor_inceput is not None and row.contor_sfarsit < row.contor_inceput})
        payload.append(item)
    blocked = IncercareUtilajBlocata.objects.select_related("utilaj", "angajat")
    if start:
        blocked = blocked.filter(created_at__date__gte=start)
    if end:
        blocked = blocked.filter(created_at__date__lte=end)
    if request.GET.get("equipment"):
        blocked = blocked.filter(utilaj_id=request.GET["equipment"])
    if request.GET.get("employee"):
        blocked = blocked.filter(angajat_id=request.GET["employee"])
    return JsonResponse({
        "ok": True,
        "sessions": payload,
        "blocked_attempts": [{
            "id": item.pk,
            "equipment": item.utilaj.cod_intern,
            "employee": item.angajat.UserName if item.angajat else "Necunoscut",
            "code": item.cod,
            "reason": item.motiv,
            "created_at": timezone.localtime(item.created_at).isoformat(),
        } for item in blocked[:1000]],
    })


def fleet_document_version_download(request, version_id):
    if request.method != "GET":
        return _error("METHOD_NOT_ALLOWED", "Este permis doar GET.", 405)
    version = DocumentUtilajVersiune.objects.filter(pk=version_id).first()
    if not version or not version.fisier:
        return _error("NOT_FOUND", "Versiunea documentului nu a fost găsită.", 404)
    return FileResponse(
        version.fisier.open("rb"),
        as_attachment=False,
        filename=version.nume_fisier_original or Path(version.fisier.name).name,
    )


@csrf_exempt
def fleet_maintenance(request, maintenance_id=None):
    if request.method == "GET":
        rows = RevizieUtilaj.objects.select_related("utilaj")
        if request.GET.get("equipment"):
            rows = rows.filter(utilaj_id=request.GET["equipment"])
        if request.GET.get("status"):
            rows = rows.filter(status=request.GET["status"])
        return JsonResponse({"ok": True, "maintenance": [_maintenance_payload(item) for item in rows[:1000]]})
    data = _json_body(request)
    if data is None:
        return _error("INVALID_JSON", "Corpul cererii nu este JSON valid.")
    if request.method == "POST":
        utilaj = Utilaj.objects.filter(pk=data.get("equipment_id"), activ=True).first()
        name = str(data.get("name") or "").strip()
        if not utilaj or not name:
            return _error("INVALID_INPUT", "Utilajul și denumirea reviziei sunt obligatorii.")
        try:
            row = RevizieUtilaj.objects.create(
                utilaj=utilaj,
                denumire=name,
                data_scadenta=_parse_iso_date(data.get("due_date"), "Data reviziei"),
                contor_scadenta=_decimal(data.get("due_counter"), "Contorul reviziei"),
                observatii=str(data.get("notes") or ""),
            )
        except ValueError as exc:
            return _error("INVALID_INPUT", str(exc))
        _audit(request, "revizie_planificata", utilaj, maintenance_id=row.pk, name=row.denumire)
        return JsonResponse({"ok": True, "maintenance": _maintenance_payload(row)}, status=201)
    if request.method in {"PATCH", "PUT"}:
        row = RevizieUtilaj.objects.select_related("utilaj").filter(pk=maintenance_id).first()
        if not row:
            return _error("NOT_FOUND", "Revizia nu a fost găsită.", 404)
        try:
            if "status" in data:
                row.status = str(data.get("status") or "")
            if "notes" in data:
                row.observatii = str(data.get("notes") or "")
            if "cost" in data:
                row.cost = _decimal(data.get("cost"), "Costul reviziei")
            row.finalizata_la = timezone.now() if row.status == RevizieUtilaj.Status.FINALIZATA else None
            row.save()
        except ValueError as exc:
            return _error("INVALID_INPUT", str(exc))
        _audit(request, "revizie_actualizata", row.utilaj, maintenance_id=row.pk, status=row.status)
        return JsonResponse({"ok": True, "maintenance": _maintenance_payload(row)})
    return _error("METHOD_NOT_ALLOWED", "Metodă neacceptată.", 405)


@csrf_exempt
def fleet_defects(request, defect_id=None):
    if request.method == "GET":
        rows = SesizareDefectUtilaj.objects.select_related("utilaj", "raportat_de")
        if request.GET.get("status"):
            rows = rows.filter(status=request.GET["status"])
        if request.GET.get("equipment"):
            rows = rows.filter(utilaj_id=request.GET["equipment"])
        return JsonResponse({"ok": True, "defects": [_defect_payload(item, request) for item in rows[:1000]]})
    if request.method == "POST":
        data = request.POST if request.content_type and request.content_type.startswith("multipart/") else (_json_body(request) or {})
        utilaj = Utilaj.objects.filter(pk=data.get("equipment_id"), activ=True).first()
        description = str(data.get("description") or "").strip()
        if not utilaj or not description:
            return _error("INVALID_INPUT", "Utilajul și descrierea sunt obligatorii.")
        employee = _employee_for_action(request, data)
        defect = SesizareDefectUtilaj.objects.create(
            utilaj=utilaj, raportat_de=employee, descriere=description,
            fotografie=request.FILES.get("photo"), gravitate=data.get("severity") or SesizareDefectUtilaj.Gravitate.MEDIE,
        )
        if defect.gravitate == SesizareDefectUtilaj.Gravitate.GRAVA:
            utilaj.stare = Utilaj.Stare.DEFECT
            utilaj.save(update_fields=("stare", "updated_at"))
        _audit(request, "defect_raportat", utilaj, defect_id=defect.pk, severity=defect.gravitate)
        return JsonResponse({"ok": True, "defect": _defect_payload(defect, request)}, status=201)
    if request.method in {"PATCH", "PUT"}:
        defect = SesizareDefectUtilaj.objects.select_related("utilaj", "raportat_de").filter(pk=defect_id).first()
        if not defect:
            return _error("NOT_FOUND", "Sesizarea nu a fost găsită.", 404)
        data = _json_body(request)
        if data is None:
            return _error("INVALID_JSON", "Corpul cererii nu este JSON valid.")
        for incoming, field in (("status", "status"), ("assignee", "responsabil"), ("resolution_notes", "observatii_rezolvare")):
            if incoming in data:
                setattr(defect, field, str(data.get(incoming) or ""))
        if "repair_cost" in data:
            defect.cost_reparatie = _decimal(data.get("repair_cost"), "Costul reparației")
        if defect.status == SesizareDefectUtilaj.Status.REZOLVAT:
            defect.resolved_at = defect.resolved_at or timezone.now()
        else:
            defect.resolved_at = None
        defect.save()
        if defect.status == SesizareDefectUtilaj.Status.IN_LUCRU:
            Utilaj.objects.filter(pk=defect.utilaj_id).update(stare=Utilaj.Stare.SERVICE, updated_at=timezone.now())
        elif defect.status == SesizareDefectUtilaj.Status.REZOLVAT and not defect.utilaj.defecte.exclude(pk=defect.pk).exclude(status=SesizareDefectUtilaj.Status.REZOLVAT).exists():
            Utilaj.objects.filter(pk=defect.utilaj_id).update(stare=Utilaj.Stare.DISPONIBIL, updated_at=timezone.now())
        _audit(request, "defect_actualizat", defect.utilaj, defect_id=defect.pk, status=defect.status)
        return JsonResponse({"ok": True, "defect": _defect_payload(defect, request)})
    return _error("METHOD_NOT_ALLOWED", "Metodă neacceptată.", 405)


@csrf_exempt
def fleet_fuel(request):
    if request.method != "POST":
        return _error("METHOD_NOT_ALLOWED", "Este permis doar POST.", 405)
    data = _json_body(request)
    if data is None:
        return _error("INVALID_JSON", "Corpul cererii nu este JSON valid.")
    utilaj = Utilaj.objects.filter(pk=data.get("equipment_id"), activ=True).first()
    if not utilaj:
        return _error("INVALID_INPUT", "Utilajul nu există.")
    try:
        liters = _decimal(data.get("liters"), "Litrii")
        cost = _decimal(data.get("cost"), "Costul")
        counter = _decimal(data.get("counter"), "Contorul")
        date = _parse_iso_date(data.get("date"), "Data") or localdate()
    except ValueError as exc:
        return _error("INVALID_INPUT", str(exc))
    if not liters or not cost:
        return _error("INVALID_INPUT", "Litrii și costul trebuie să fie mai mari decât zero.")
    row = AlimentareUtilaj.objects.create(utilaj=utilaj, angajat=_employee_for_action(request, data), data=date,
                                           litri=liters, cost=cost, contor=counter)
    _audit(request, "alimentare_adaugata", utilaj, liters=str(liters), cost=str(cost))
    return JsonResponse({"ok": True, "fuel": _fuel_payload(row)}, status=201)


def fleet_reports(request):
    if request.method != "GET":
        return _error("METHOD_NOT_ALLOWED", "Este permis doar GET.", 405)
    rows = SesiuneUtilaj.objects.select_related("utilaj", "angajat", "santier")
    start = _parse_iso_date(request.GET.get("start"), "Data de început") if request.GET.get("start") else None
    end = _parse_iso_date(request.GET.get("end"), "Data de sfârșit") if request.GET.get("end") else None
    if start: rows = rows.filter(inceput__date__gte=start)
    if end: rows = rows.filter(inceput__date__lte=end)
    if request.GET.get("site"): rows = rows.filter(santier_id=request.GET["site"])
    by_equipment, by_site, by_employee = {}, {}, {}
    total_seconds = 0
    total_cost = Decimal("0")
    for session in rows[:10000]:
        seconds = max(0, int(((session.sfarsit or timezone.now()) - session.inceput).total_seconds()))
        hours = Decimal(seconds) / Decimal(3600)
        cost = hours * (session.utilaj.tarif_intern or Decimal("0"))
        total_seconds += seconds
        total_cost += cost
        for bucket, key, label in (
            (by_equipment, session.utilaj_id, f"{session.utilaj.cod_intern} · {session.utilaj.denumire}"),
            (by_site, session.santier_id or 0, session.santier.name if session.santier else "Fără șantier"),
            (by_employee, session.angajat_id, session.angajat.UserName),
        ):
            item = bucket.setdefault(key, {"id": key, "label": label, "seconds": 0, "cost": Decimal("0"), "sessions": 0, "dates": set()})
            item["seconds"] += seconds; item["cost"] += cost; item["sessions"] += 1; item["dates"].add(timezone.localdate(session.inceput))
    def serialized(bucket):
        result = []
        for source in bucket.values():
            item = dict(source)
            seconds = item.pop("seconds")
            dates = item.pop("dates")
            item.update({"hours": round(seconds / 3600, 2), "days_used": len(dates),
                         "cost": str(item["cost"].quantize(Decimal("0.01")))})
            result.append(item)
        return result
    defect_costs = SesizareDefectUtilaj.objects.filter(status=SesizareDefectUtilaj.Status.REZOLVAT)
    maintenance_costs = RevizieUtilaj.objects.filter(status=RevizieUtilaj.Status.FINALIZATA)
    fuel_rows = AlimentareUtilaj.objects.all()
    if start:
        defect_costs = defect_costs.filter(resolved_at__date__gte=start)
        maintenance_costs = maintenance_costs.filter(finalizata_la__date__gte=start)
        fuel_rows = fuel_rows.filter(data__gte=start)
    if end:
        defect_costs = defect_costs.filter(resolved_at__date__lte=end)
        maintenance_costs = maintenance_costs.filter(finalizata_la__date__lte=end)
        fuel_rows = fuel_rows.filter(data__lte=end)
    if request.GET.get("site"):
        defect_costs = defect_costs.filter(utilaj__santier_curent_id=request.GET["site"])
        maintenance_costs = maintenance_costs.filter(utilaj__santier_curent_id=request.GET["site"])
        fuel_rows = fuel_rows.filter(utilaj__santier_curent_id=request.GET["site"])
    service_cost = sum((item.cost_reparatie or Decimal("0")) for item in defect_costs) + sum(
        (item.cost or Decimal("0")) for item in maintenance_costs
    )
    fuel_cost = sum((item.cost or Decimal("0")) for item in fuel_rows)
    return JsonResponse({
        "ok": True, "totals": {"hours": round(total_seconds / 3600, 2), "usage_cost": str(total_cost.quantize(Decimal("0.01"))),
                                  "service_cost": str(service_cost), "fuel_cost": str(fuel_cost),
                                  "total_cost": str((total_cost + service_cost + fuel_cost).quantize(Decimal("0.01")))},
        "by_equipment": serialized(by_equipment), "by_site": serialized(by_site), "by_employee": serialized(by_employee),
    })


@csrf_exempt
def fleet_qr_detail(request, token):
    utilaj = Utilaj.objects.select_related("santier_curent").filter(token_qr=token, activ=True).first()
    if not utilaj:
        return _error("NOT_FOUND", "Utilajul nu a fost găsit sau nu mai este activ.", 404)
    if request.method == "GET":
        return JsonResponse({"ok": True, "equipment": _utilaj_payload(utilaj, request=request)})
    return _error("METHOD_NOT_ALLOWED", "Este permis doar GET.", 405)


def fleet_document_download(request, token, document_id):
    if request.method != "GET":
        return _error("METHOD_NOT_ALLOWED", "Este permis doar GET.", 405)
    document = DocumentUtilaj.objects.select_related("utilaj").filter(
        pk=document_id,
        utilaj__token_qr=token,
        utilaj__activ=True,
    ).first()
    if not document or not document.fisier:
        return _error("NOT_FOUND", "Documentul nu a fost găsit.", 404)
    filename = document.nume_fisier_original or Path(document.fisier.name).name
    return FileResponse(document.fisier.open("rb"), as_attachment=False, filename=filename)


@csrf_exempt
def fleet_take(request, token):
    if request.method != "POST":
        return _error("METHOD_NOT_ALLOWED", "Este permis doar POST.", 405)
    data = _json_body(request)
    if data is None:
        return _error("INVALID_JSON", "Corpul cererii nu este JSON valid.")
    employee = _employee_for_action(request, data)
    if not employee:
        return _error("AUTH_REQUIRED", "Autentifică-te în aplicație sau introdu PIN-ul corect.", 401)
    now = timezone.now()
    today = localdate(now)
    try:
        counter = _decimal(data.get("counter"), "Contorul")
        lat, lng, accuracy = _gps(data)
    except ValueError as exc:
        return _error("INVALID_INPUT", str(exc))

    with transaction.atomic():
        utilaj = Utilaj.objects.select_for_update().select_related("santier_curent").filter(
            token_qr=token, activ=True
        ).first()
        if not utilaj:
            return _error("NOT_FOUND", "Utilajul nu a fost găsit sau nu mai este activ.", 404)
        attendance = AttendanceSession.objects.select_for_update().filter(
            user_fk=employee,
            work_date=today,
            out_time__isnull=True,
        ).exclude(source__contains=MISSING_EXIT_SOURCE_TAG).order_by("-in_time").first()
        if not attendance:
            return _blocked_attempt(utilaj, employee, "ATTENDANCE_REQUIRED", "Trebuie să fii pontat înainte să iei utilajul.")
        current = SesiuneUtilaj.objects.select_related("angajat", "utilaj").filter(
            Q(utilaj=utilaj) | Q(angajat=employee), sfarsit__isnull=True
        ).first()
        if current:
            if current.angajat_id == employee.pk and current.utilaj_id == utilaj.pk:
                return _blocked_attempt(utilaj, employee, "ALREADY_TAKEN", "Ai deja acest utilaj în lucru.",
                                        session=_session_payload(current))
            if current.utilaj_id == utilaj.pk:
                return _blocked_attempt(utilaj, employee, "EQUIPMENT_BUSY", f"Utilajul este deja folosit de {current.angajat.UserName}.")
            return _blocked_attempt(utilaj, employee, "EMPLOYEE_HAS_EQUIPMENT", f"Ai deja utilajul {current.utilaj.cod_intern} în lucru.")
        if utilaj.stare != Utilaj.Stare.DISPONIBIL:
            return _blocked_attempt(utilaj, employee, "EQUIPMENT_UNAVAILABLE", f"Utilajul este {utilaj.get_stare_display().lower()}.")
        blocked_documents = blocking_equipment_documents(utilaj, today=today)
        if blocked_documents:
            return _blocked_attempt(utilaj, employee, "BLOCKED_DOCUMENTS", "Utilajul nu poate fi folosit: are documente lipsă sau expirate.",
                                    documents=blocked_documents)
        missing_authorizations = missing_employee_authorizations(employee, utilaj, today=today)
        if missing_authorizations:
            return _blocked_attempt(utilaj, employee, "EMPLOYEE_AUTHORIZATION_REQUIRED", "Nu ai toate autorizațiile valabile pentru acest utilaj.",
                                    authorizations=missing_authorizations)
        if utilaj.tip_contor != Utilaj.TipContor.FARA and counter is None:
            return _error("COUNTER_REQUIRED", "Valoarea contorului este obligatorie.")
        if counter is not None and utilaj.contor_curent is not None and counter < utilaj.contor_curent:
            return _error("COUNTER_TOO_SMALL", "Contorul nu poate fi mai mic decât valoarea curentă.", 409)
        try:
            with transaction.atomic():
                session = SesiuneUtilaj.objects.create(
                    angajat=employee,
                    utilaj=utilaj,
                    inceput=now,
                    contor_inceput=counter,
                    gps_latitudine=lat,
                    gps_longitudine=lng,
                    gps_precizie_m=accuracy,
                    attendance_session=attendance,
                    santier=utilaj.santier_curent,
                )
        except IntegrityError:
            return _error("EQUIPMENT_BUSY", "Utilajul sau angajatul are deja o sesiune activă.", 409)
        utilaj.stare = Utilaj.Stare.IN_LUCRU
        if counter is not None:
            utilaj.contor_curent = counter
        utilaj.save(update_fields=("stare", "contor_curent", "updated_at"))
        _audit(request, "utilaj_luat", utilaj, employee=employee.UserName, session_id=session.pk)
    session = SesiuneUtilaj.objects.select_related("angajat").get(pk=session.pk)
    return JsonResponse({"ok": True, "state": "TAKEN", "session": _session_payload(session),
                         "equipment": _utilaj_payload(utilaj, request=request)}, status=201)


@csrf_exempt
def fleet_return(request, token):
    if request.method != "POST":
        return _error("METHOD_NOT_ALLOWED", "Este permis doar POST.", 405)
    data = _json_body(request)
    if data is None:
        return _error("INVALID_JSON", "Corpul cererii nu este JSON valid.")
    employee = _employee_for_action(request, data)
    if not employee:
        return _error("AUTH_REQUIRED", "Autentifică-te în aplicație sau introdu PIN-ul corect.", 401)
    try:
        counter = _decimal(data.get("counter"), "Contorul")
    except ValueError as exc:
        return _error("INVALID_INPUT", str(exc))
    now = timezone.now()
    with transaction.atomic():
        utilaj = Utilaj.objects.select_for_update().select_related("santier_curent").filter(
            token_qr=token, activ=True
        ).first()
        if not utilaj:
            return _error("NOT_FOUND", "Utilajul nu a fost găsit sau nu mai este activ.", 404)
        session = SesiuneUtilaj.objects.select_for_update().select_related("angajat").filter(
            utilaj=utilaj, sfarsit__isnull=True
        ).first()
        if not session:
            return _error("NO_ACTIVE_SESSION", "Utilajul nu are o sesiune activă.", 409)
        if session.angajat_id != employee.pk:
            return _error("NOT_CURRENT_OPERATOR", "Doar angajatul care a luat utilajul îl poate preda.", 403)
        if utilaj.tip_contor != Utilaj.TipContor.FARA and counter is None:
            return _error("COUNTER_REQUIRED", "Valoarea contorului este obligatorie.")
        minimum = session.contor_inceput if session.contor_inceput is not None else utilaj.contor_curent
        if counter is not None and minimum is not None and counter < minimum:
            return _error("COUNTER_TOO_SMALL", "Contorul final nu poate fi mai mic decât cel inițial.", 409)
        session.contor_sfarsit = counter
        session.save(update_fields=("contor_sfarsit",))
        if counter is not None:
            utilaj.contor_curent = counter
        # Helperul este folosit și de depontare/jobul de seară și garantează aceeași tranziție.
        close_open_utilaj_sessions(employee, closed_at=now, reason=SesiuneUtilaj.MotivInchidere.PREDARE)
        utilaj.refresh_from_db()
        utilaj.contor_curent = counter if counter is not None else utilaj.contor_curent
        utilaj.save(update_fields=("contor_curent", "updated_at"))
        _audit(request, "utilaj_predat", utilaj, employee=employee.UserName, session_id=session.pk)
    session.refresh_from_db()
    return JsonResponse({"ok": True, "state": "RETURNED", "session": _session_payload(session),
                         "equipment": _utilaj_payload(utilaj, request=request)})
