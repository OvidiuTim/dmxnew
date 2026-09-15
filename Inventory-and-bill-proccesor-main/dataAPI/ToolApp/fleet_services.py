from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from django.utils.timezone import localdate

from ToolApp.models import DocumentUtilaj, EmployeeDocument, SesiuneUtilaj, Utilaj


def document_status(document, today=None):
    today = today or localdate()
    if document is None:
        return "missing", None
    if not document.data_expirare:
        return "valid", None
    days = (document.data_expirare - today).days
    if days < 0:
        return "expired", days
    if days <= document.tip.zile_avertizare:
        return "warning", days
    return "valid", days


def document_rows(utilaj, request=None, today=None):
    today = today or localdate()
    documents = {item.tip_id: item for item in utilaj.documente.select_related("tip").all()}
    configured = list(utilaj.tipuri_document_necesare.filter(activ=True))
    configured_ids = {item.pk for item in configured}
    extra_types = [item.tip for item in documents.values() if item.tip_id not in configured_ids and item.tip.activ]
    rows = []
    for tip in sorted(configured + extra_types, key=lambda item: item.nume.casefold()):
        item = documents.get(tip.pk)
        status, days = document_status(item, today=today)
        file_url = ""
        if item and item.fisier:
            file_url = f"/api/fleet/qr/{utilaj.token_qr}/documents/{item.pk}/"
            if request:
                file_url = request.build_absolute_uri(file_url)
        rows.append({
            "id": item.pk if item else None,
            "type_id": tip.pk,
            "type": tip.nume,
            "blocking": tip.blocheaza_utilizarea,
            "warning_days": tip.zile_avertizare,
            "expiry_date": item.data_expirare.isoformat() if item and item.data_expirare else None,
            "days_remaining": days,
            "status": status,
            "file_url": file_url,
            "original_file_name": item.nume_fisier_original if item else "",
        })
    return rows


def blocking_equipment_documents(utilaj, today=None):
    return [
        row for row in document_rows(utilaj, today=today)
        if row["blocking"] and row["status"] in {"missing", "expired"}
    ]


def missing_employee_authorizations(employee, utilaj, today=None):
    today = today or localdate()
    required_types = set()
    for tip in utilaj.tipuri_document_necesare.filter(activ=True).prefetch_related("documente_angajat_necesare"):
        required_types.update(tip.documente_angajat_necesare.all())
    missing = []
    for document_type in sorted(required_types, key=lambda item: item.name.casefold()):
        documents = EmployeeDocument.objects.filter(employee=employee, document_type=document_type)
        valid = documents.filter(has_expiry=False).exists() or documents.filter(
            has_expiry=True,
            expiry_date__gte=today,
        ).exists()
        if not valid:
            missing.append({"id": document_type.pk, "name": document_type.name})
    return missing


def close_open_utilaj_sessions(employee, closed_at=None, reason=SesiuneUtilaj.MotivInchidere.DEPONTARE):
    """Close an employee's equipment session; safe to call repeatedly."""
    closed_at = closed_at or timezone.now()
    count = 0
    with transaction.atomic():
        sessions = list(
            SesiuneUtilaj.objects.select_for_update().select_related("utilaj")
            .filter(angajat=employee, sfarsit__isnull=True)
        )
        for session in sessions:
            session.sfarsit = max(session.inceput, closed_at)
            session.motiv_inchidere = reason
            session.save(update_fields=("sfarsit", "motiv_inchidere"))
            Utilaj.objects.filter(
                pk=session.utilaj_id,
                stare=Utilaj.Stare.IN_LUCRU,
            ).update(stare=Utilaj.Stare.DISPONIBIL, updated_at=timezone.now())
            count += 1
    return count


def due_fleet_document_expiry_notifications(reference_date=None):
    today = reference_date or localdate()
    candidates = (
        DocumentUtilaj.objects.select_related("utilaj", "tip")
        .filter(data_expirare__gte=today)
        .order_by("data_expirare", "utilaj__cod_intern", "tip__nume")
    )
    return [
        item for item in candidates
        if item.data_expirare <= today + timedelta(days=item.tip.zile_avertizare)
        and item.expiry_notification_sent_for != item.data_expirare
    ]
