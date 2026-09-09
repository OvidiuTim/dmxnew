import csv
import io
import json
from datetime import date
from decimal import Decimal
from functools import wraps

from django.db import IntegrityError, transaction
from django.http import JsonResponse, HttpResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from ToolApp.models import ConstructionSite, SiteAttendancePoint, SiteExpense, SiteAuditLog
from ToolApp.security import request_has_admin, get_app_user_from_request, app_user_has_route
from ToolApp.module_access import app_user_has_module
from ToolApp.site_costs import bucket, cost_report, finish, money
from ToolApp.site_serializers import SiteWriteSerializer, ExpenseWriteSerializer
from ToolApp.worksites import ACCEPTED_WORKSITES, ATTENDANCE_WORKSITES, ATTENDANCE_WORKSITE_BY_NAME


def access(request):
    if request_has_admin(request):
        return True, True, "Administrator"
    user = getattr(request, "app_user", None) or get_app_user_from_request(request)
    allowed = bool(user and app_user_has_module(user, "construction_sites"))
    return allowed, bool(allowed and app_user_has_route(user, "/santiere")), f"app_user:{user.pk} · {user.username}" if user else ""


def endpoint(methods):
    def decorate(view):
        @csrf_exempt
        @require_http_methods(methods)
        @wraps(view)
        def wrapped(request, *args, **kwargs):
            allowed, can_manage, actor = access(request)
            if not allowed or (request.method != "GET" and not can_manage):
                return JsonResponse({"error": "Nu ai permisiunea de a administra șantierele."}, status=403)
            request.site_actor = actor
            request.site_can_manage = can_manage
            try:
                if request.method != "GET":
                    request.site_body = json.loads(request.body or "{}")
                    if not isinstance(request.site_body, dict):
                        raise ValueError("Trimite un obiect JSON.")
                return view(request, *args, **kwargs)
            except (ValueError, TypeError) as exc:
                return JsonResponse({"error": str(exc) or "Date invalide."}, status=400)
            except (ConstructionSite.DoesNotExist, SiteExpense.DoesNotExist):
                return JsonResponse({"error": "Înregistrarea nu există."}, status=404)
            except IntegrityError:
                return JsonResponse({"error": "Codul sau punctul de pontaj este deja asociat. Reîncarcă datele."}, status=409)
        return wrapped
    return decorate


def period(request):
    start = date.fromisoformat(request.GET["start"]) if request.GET.get("start") else None
    end = date.fromisoformat(request.GET["end"]) if request.GET.get("end") else None
    if start and end and start > end:
        raise ValueError("Data de început trebuie să fie înaintea datei finale.")
    return start, end


def site_data(site):
    return {"id": site.pk, **{key: getattr(site, key) for key in (
        "code", "name", "status", "client", "manager", "address", "latitude", "longitude", "notes", "version")},
        "start_date": str(site.start_date) if site.start_date else None,
        "end_date": str(site.end_date) if site.end_date else None,
        "budget": str(site.budget) if site.budget is not None else None,
        "points": list(site.attendance_points.values_list("name", flat=True)),
        "updated_at": site.updated_at.isoformat()}


def expense_data(expense):
    return {"id": expense.pk, "site_id": expense.site_id, "date": str(expense.date),
            **{key: getattr(expense, key) for key in ("category", "description", "supplier", "reference", "notes", "cancellation_reason", "created_by")},
            "amount": str(expense.amount), "request_id": str(expense.request_id),
            "cancelled_at": expense.cancelled_at.isoformat() if expense.cancelled_at else None,
            "created_at": expense.created_at.isoformat()}


def audit(site, action, actor, before, after):
    SiteAuditLog.objects.create(site=site, action=action, actor=actor, before=before, after=after)


def point_catalog():
    primary_names = {point["name"] for point in ATTENDANCE_WORKSITES}
    assignments = {point.name: point for point in SiteAttendancePoint.objects.select_related("site")}
    return [{"name": name, "is_primary": name in primary_names, "latitude": ATTENDANCE_WORKSITE_BY_NAME.get(name, {}).get("latitude"),
             "longitude": ATTENDANCE_WORKSITE_BY_NAME.get(name, {}).get("longitude"),
             "site_id": assignments[name].site_id if name in assignments else None,
             "site_name": assignments[name].site.name if name in assignments else None}
            for name in ACCEPTED_WORKSITES]


@endpoint(["GET", "POST"])
def sites_collection(request):
    if request.method == "POST":
        serializer = SiteWriteSerializer(data=request.site_body)
        if not serializer.is_valid():
            return JsonResponse({"error": "Verifică datele șantierului.", "details": serializer.errors}, status=400)
        data = dict(serializer.validated_data)
        points = data.pop("points", [])
        data.pop("version", None)
        with transaction.atomic():
            site = ConstructionSite.objects.create(**data)
            SiteAttendancePoint.objects.bulk_create([SiteAttendancePoint(site=site, name=name) for name in points])
            result = site_data(site)
            audit(site, "created", request.site_actor, {}, result)
        return JsonResponse({"site": result}, status=201)
    start, end = period(request)
    current, lifetime, total = cost_report(start, end)
    sites = []
    for site in ConstructionSite.objects.prefetch_related("attendance_points"):
        # Use the prefetched objects rather than one query per cost centre.
        result = {"id": site.pk, **{key: getattr(site, key) for key in ("code", "name", "status", "client", "manager", "address", "latitude", "longitude", "notes", "version")},
                  "start_date": site.start_date, "end_date": site.end_date, "budget": site.budget,
                  "points": [point.name for point in site.attendance_points.all()], "updated_at": site.updated_at}
        result["costs"] = current.get(site.pk, finish(bucket()))
        life = lifetime.get(site.pk, finish(bucket()))
        result["lifetime_cost"] = life["total_cost"]
        result["budget_remaining"] = money(site.budget - Decimal(life["total_cost"])) if site.budget is not None else None
        sites.append(result)
    histories = {point["name"]: point for costs in lifetime.values() for point in costs["points"]}
    points = [{**point, "history": histories.get(point["name"])} for point in point_catalog()]
    return JsonResponse({"sites": sites, "totals": total, "unallocated": current.get(0, finish(bucket())),
                         "unallocated_lifetime": lifetime.get(0, finish(bucket())),
                         "points": points, "can_manage": request.site_can_manage,
                         "categories": [{"value": key, "label": label} for key, label in SiteExpense.Category.choices],
                         "start": start, "end": end})


@endpoint(["PATCH"])
def site_detail(request, site_id):
    with transaction.atomic():
        site = ConstructionSite.objects.select_for_update().get(pk=site_id)
        if request.site_body.get("version") != site.version:
            return JsonResponse({"error": "Șantierul a fost modificat între timp. Reîncarcă înainte de salvare."}, status=409)
        serializer = SiteWriteSerializer(site, data=request.site_body, partial=True)
        if not serializer.is_valid():
            return JsonResponse({"error": "Verifică datele șantierului.", "details": serializer.errors}, status=400)
        before = site_data(site)
        data = dict(serializer.validated_data)
        points = data.pop("points", None)
        data.pop("version", None)
        for key, value in data.items():
            setattr(site, key, value)
        site.version += 1
        site.save()
        if points is not None:
            site.attendance_points.exclude(name__in=points).delete()
            existing = set(site.attendance_points.values_list("name", flat=True))
            SiteAttendancePoint.objects.bulk_create([SiteAttendancePoint(site=site, name=name) for name in points if name not in existing])
        result = site_data(site)
        audit(site, "updated", request.site_actor, before, result)
    return JsonResponse({"site": result})


@endpoint(["POST"])
def sites_import(request):
    """Idempotently create one centre for each unassigned official GPS point."""
    created = []
    with transaction.atomic():
        for index, point in enumerate(ATTENDANCE_WORKSITES, start=1):
            if SiteAttendancePoint.objects.filter(name=point["name"]).exists():
                continue
            code = f"S-{index:03d}"
            suffix = 1
            while ConstructionSite.objects.filter(code=code).exists():
                suffix += 1
                code = f"S-{index:03d}-{suffix}"
            site = ConstructionSite.objects.create(code=code, name=point["name"], latitude=point["latitude"], longitude=point["longitude"])
            SiteAttendancePoint.objects.create(site=site, name=point["name"])
            audit(site, "imported", request.site_actor, {}, site_data(site))
            created.append(site.pk)
    return JsonResponse({"created_count": len(created), "ids": created}, status=201)


@endpoint(["GET", "POST"])
def site_expenses(request, site_id):
    site = ConstructionSite.objects.get(pk=site_id)
    if request.method == "POST":
        serializer = ExpenseWriteSerializer(data=request.site_body)
        if not serializer.is_valid():
            return JsonResponse({"error": "Verifică datele cheltuielii.", "details": serializer.errors}, status=400)
        with transaction.atomic():
            # Serialize writes for a site (including archive and double submission).
            site = ConstructionSite.objects.select_for_update().get(pk=site_id)
            data = dict(serializer.validated_data)
            existing = SiteExpense.objects.filter(request_id=data["request_id"]).first()
            if existing:
                if existing.site_id != site.pk or any(getattr(existing, key) != value for key, value in data.items()):
                    return JsonResponse({"error": "Identificatorul cererii a fost deja folosit pentru altă cheltuială."}, status=409)
                return JsonResponse({"expense": expense_data(existing)})
            if site.status == ConstructionSite.Status.ARCHIVED:
                raise ValueError("Reactivează șantierul înainte de a adăuga cheltuieli.")
            expense = SiteExpense.objects.create(site=site, created_by=request.site_actor, **data)
            audit(site, "expense_created", request.site_actor, {}, expense_data(expense))
        return JsonResponse({"expense": expense_data(expense)}, status=201)
    start, end = period(request)
    page = max(1, int(request.GET.get("page", 1)))
    query = site.expenses.all()
    if start:
        query = query.filter(date__gte=start)
    if end:
        query = query.filter(date__lte=end)
    if request.GET.get("format") == "csv":
        output = io.StringIO()
        writer = csv.writer(output, delimiter=";")
        writer.writerow(["Șantier", "Dată", "Categorie", "Descriere", "Furnizor", "Document", "Sumă RON fără TVA", "Status", "Motiv anulare", "Note"])
        def safe(value):
            text = str(value or "")
            return "'" + text if text.lstrip().startswith(("=", "+", "-", "@")) else text
        for expense in query.iterator(chunk_size=2000):
            writer.writerow([safe(site.name), str(expense.date), expense.get_category_display(), safe(expense.description),
                             safe(expense.supplier), safe(expense.reference), str(expense.amount),
                             "Anulată" if expense.cancelled_at else "Înregistrată", safe(expense.cancellation_reason), safe(expense.notes)])
        response = HttpResponse("\ufeff" + output.getvalue(), content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = f'attachment; filename="santier-{site.pk}-cheltuieli.csv"'
        return response
    return JsonResponse({"expenses": [expense_data(expense) for expense in query[(page - 1) * 50:page * 50]], "count": query.count(), "page": page, "page_size": 50})


@endpoint(["POST"])
def expense_cancel(request, site_id, expense_id):
    reason = str(request.site_body.get("reason") or "").strip()
    if not reason or len(reason) > 300:
        raise ValueError("Completează motivul anulării (maximum 300 de caractere).")
    with transaction.atomic():
        expense = SiteExpense.objects.select_for_update().select_related("site").get(pk=expense_id, site_id=site_id)
        if not expense.cancelled_at:
            before = expense_data(expense)
            expense.cancelled_at = timezone.now()
            expense.cancellation_reason = reason
            expense.save(update_fields=["cancelled_at", "cancellation_reason"])
            audit(expense.site, "expense_cancelled", request.site_actor, before, expense_data(expense))
    return JsonResponse({"expense": expense_data(expense)})


@endpoint(["GET"])
def site_audit(request, site_id):
    site = ConstructionSite.objects.get(pk=site_id)
    page = max(1, int(request.GET.get("page", 1)))
    query = site.audit_logs.all()
    return JsonResponse({"events": list(query.values("id", "action", "actor", "before", "after", "created_at")[(page - 1) * 50:page * 50]), "count": query.count(), "page": page})
