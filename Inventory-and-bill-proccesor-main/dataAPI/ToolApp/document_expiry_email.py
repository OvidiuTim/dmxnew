import logging
import os
from datetime import timedelta
from html import escape

from django.conf import settings
from django.utils import timezone
from django.utils.timezone import localdate

from ToolApp.models import EmployeeDocument


logger = logging.getLogger(__name__)

DOCUMENT_EXPIRY_RECIPIENTS = (
    "info@novarion.ro",
    "achizitii2@dmxconstruction.ro",
    "hr@xuxinvestment.ro",
)


def due_document_expiry_notifications(reference_date=None):
    """Documente care expiră în maximum 14 zile și nu au fost anunțate pentru data curentă."""
    today = reference_date or localdate()
    deadline = today + timedelta(days=14)
    candidates = (
        EmployeeDocument.objects
        .select_related("employee", "document_type")
        .filter(has_expiry=True, expiry_date__gte=today, expiry_date__lte=deadline)
        .order_by("expiry_date", "employee__UserName", "document_type__name")
    )
    return [item for item in candidates if item.expiry_notification_sent_for != item.expiry_date]


def build_document_expiry_email(documents, reference_date=None):
    today = reference_date or localdate()
    rows = []
    text_lines = ["Documente care expiră în următoarele 14 zile", ""]
    for item in documents:
        employee = str(item.employee.UserName or "-")
        document_type = str(item.document_type.name or "-")
        expiry = item.expiry_date.strftime("%d.%m.%Y")
        days = max(0, (item.expiry_date - today).days)
        text_lines.extend([
            f"Angajat: {employee}",
            f"Tip document: {document_type}",
            f"Data expirării: {expiry} ({days} zile)",
            "",
        ])
        rows.append(
            "<tr>"
            f'<td style="padding:10px;border:1px solid #d9dee7">{escape(employee)}</td>'
            f'<td style="padding:10px;border:1px solid #d9dee7">{escape(document_type)}</td>'
            f'<td style="padding:10px;border:1px solid #d9dee7">{escape(expiry)}</td>'
            f'<td style="padding:10px;border:1px solid #d9dee7;text-align:center">{days}</td>'
            "</tr>"
        )

    count = len(documents)
    subject = f"Avertizare expirare documente – {count} document{'e' if count != 1 else ''}"
    html = f"""
      <div style="font-family:Arial,sans-serif;color:#142033;line-height:1.55">
        <h2 style="margin:0 0 12px">Documente care expiră în următoarele 14 zile</h2>
        <p>Următoarele documente ale angajaților necesită verificare:</p>
        <table style="border-collapse:collapse;width:100%;max-width:800px">
          <thead><tr>
            <th style="padding:10px;border:1px solid #d9dee7;text-align:left">Angajat</th>
            <th style="padding:10px;border:1px solid #d9dee7;text-align:left">Tip document</th>
            <th style="padding:10px;border:1px solid #d9dee7;text-align:left">Data expirării</th>
            <th style="padding:10px;border:1px solid #d9dee7;text-align:center">Zile rămase</th>
          </tr></thead>
          <tbody>{''.join(rows)}</tbody>
        </table>
        <p style="margin-top:18px;color:#607086">Mesaj generat automat de bloom-in.</p>
      </div>
    """
    return subject, "\n".join(text_lines), html


def send_document_expiry_email(documents, recipients=None, reference_date=None):
    recipients = list(recipients or DOCUMENT_EXPIRY_RECIPIENTS)
    api_key = str(os.environ.get("SENDGRID_API_KEY") or getattr(settings, "SENDGRID_API_KEY", "") or "").strip()
    from_email = str(os.environ.get("DEFAULT_FROM_EMAIL") or getattr(settings, "DEFAULT_FROM_EMAIL", "") or "no-reply@dmxconstruction.ro").strip()
    if not api_key:
        raise RuntimeError("SENDGRID_API_KEY lipsește din environment/settings.")

    subject, text, html = build_document_expiry_email(documents, reference_date=reference_date)
    from sendgrid import SendGridAPIClient
    from sendgrid.helpers.mail import Mail

    response = SendGridAPIClient(api_key).send(Mail(
        from_email=from_email,
        to_emails=recipients,
        subject=subject,
        plain_text_content=text,
        html_content=html,
    ))
    status_code = int(getattr(response, "status_code", 0) or 0)
    if not 200 <= status_code < 300:
        raise RuntimeError(f"SendGrid a răspuns cu status {status_code}.")
    return response


def process_due_document_expiry_notifications(reference_date=None, recipients=None, dry_run=False):
    documents = due_document_expiry_notifications(reference_date=reference_date)
    if not documents or dry_run:
        return documents

    send_document_expiry_email(documents, recipients=recipients, reference_date=reference_date)
    sent_at = timezone.now()
    for item in documents:
        EmployeeDocument.objects.filter(pk=item.pk).update(
            expiry_notification_sent_for=item.expiry_date,
            expiry_notification_sent_at=sent_at,
        )
    logger.info("Au fost trimise notificări pentru %s documente care expiră.", len(documents))
    return documents
