from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from django.utils.timezone import localdate

from ToolApp.models import (
    DocumentUtilaj,
    EmployeeDocument,
    FleetRecommendationSubmission,
    FleetTechnicalRecommendation,
    SesiuneUtilaj,
    Utilaj,
)


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


def technical_recommendation_state(recommendation, now=None):
    """Starea operațională a unei recomandări, inclusiv regula de 15 minute."""
    now = now or timezone.now()
    today = timezone.localdate(now)
    approved = recommendation.verificari.filter(
        status=FleetRecommendationSubmission.Status.APPROVED,
    ).order_by("-reviewed_at", "-submitted_at").first()
    if approved:
        completed_at = approved.reviewed_at or approved.submitted_at
        due_date = timezone.localdate(completed_at) + timedelta(days=recommendation.interval_days)
    else:
        due_date = recommendation.prima_scadenta
    due = today >= due_date
    pending = recommendation.verificari.filter(
        status=FleetRecommendationSubmission.Status.PENDING,
    ).select_related("employee").order_by("-submitted_at").first()
    latest = recommendation.verificari.select_related("employee", "reviewed_by__employee").first()
    grace_ends_at = None
    can_use = True
    block_reason = ""
    if due and recommendation.importanta == FleetTechnicalRecommendation.Importance.MEDIUM:
        if pending:
            grace_ends_at = pending.submitted_at + timedelta(minutes=15)
            can_use = now >= grace_ends_at
            if not can_use:
                block_reason = "Așteaptă aprobarea responsabilului tehnic sau expirarea celor 15 minute."
        else:
            can_use = False
            block_reason = "Execută recomandarea și trimite fotografia înainte de utilizare."
    elif due and recommendation.importanta == FleetTechnicalRecommendation.Importance.HIGH:
        can_use = False
        block_reason = "Recomandarea trebuie aprobată de responsabilul tehnic înainte de utilizare."
    return {
        "due": due,
        "due_date": due_date,
        "approved": approved,
        "pending": pending,
        "latest": latest,
        "grace_ends_at": grace_ends_at,
        "can_use": can_use,
        "block_reason": block_reason,
    }


def blocking_technical_recommendations(utilaj, now=None):
    blocked = []
    for recommendation in utilaj.recomandari_tehnice.filter(activ=True):
        state = technical_recommendation_state(recommendation, now=now)
        if state["due"] and not state["can_use"]:
            blocked.append({
                "id": recommendation.pk,
                "title": recommendation.titlu,
                "importance": recommendation.importanta,
                "importance_label": recommendation.get_importanta_display(),
                "due_date": state["due_date"].isoformat(),
                "reason": state["block_reason"],
                "pending_since": state["pending"].submitted_at.isoformat() if state["pending"] else None,
                "grace_ends_at": state["grace_ends_at"].isoformat() if state["grace_ends_at"] else None,
            })
    return blocked


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
