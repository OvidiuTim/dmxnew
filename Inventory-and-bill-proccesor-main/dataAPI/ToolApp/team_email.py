import logging

from django.conf import settings
from django.utils.html import escape


logger = logging.getLogger(__name__)


def send_worker_request_email(item):
    recipient = str(item.source_team.leader.email or "").strip()
    if not recipient:
        logger.warning("Cererea de personal #%s nu a fost trimisă prin email: șeful nu are email.", item.pk)
        return False

    api_key = str(getattr(settings, "SENDGRID_API_KEY", "") or "").strip()
    if not api_key:
        logger.warning("Cererea de personal #%s nu a fost trimisă prin email: SENDGRID_API_KEY lipsește.", item.pk)
        return False

    from sendgrid import SendGridAPIClient
    from sendgrid.helpers.mail import Mail

    request_label = "permanent" if item.request_type == item.RequestType.PERMANENT else "temporar"
    period_text = (
        "Transfer permanent"
        if item.request_type == item.RequestType.PERMANENT
        else f"{item.start_date.strftime('%d.%m.%Y')} – {item.end_date.strftime('%d.%m.%Y')}"
    )
    notifications_url = f"{settings.FRONTEND_BASE_URL}/pontaj/notificari"
    subject = f"Solicitare {request_label}ă pentru {item.employee.UserName}"
    text = (
        f"Ai primit o solicitare de transfer {request_label} pentru {item.employee.UserName}.\n"
        f"Echipa sursă: {item.source_team.name}\n"
        f"Echipa solicitantă: {item.requester_team.name}\n"
        f"Perioadă: {period_text}\n"
        f"Motiv: {item.reason or '-'}\n\n"
        f"Vezi și soluționează cererea: {notifications_url}"
    )
    html = f"""
        <div style="font-family:Arial,sans-serif;color:#142033;line-height:1.55">
          <h2 style="margin:0 0 16px">Solicitare de personal</h2>
          <p>Ai primit o solicitare de transfer <strong>{escape(request_label)}</strong> pentru
             <strong>{escape(item.employee.UserName)}</strong>.</p>
          <p><strong>Din:</strong> {escape(item.source_team.name)}<br>
             <strong>Către:</strong> {escape(item.requester_team.name)}<br>
             <strong>Perioadă:</strong> {escape(period_text)}<br>
             <strong>Motiv:</strong> {escape(item.reason or '-')}</p>
          <p><a href="{escape(notifications_url)}" style="display:inline-block;padding:11px 16px;border-radius:8px;background:#1c9d69;color:white;text-decoration:none">Deschide notificările</a></p>
        </div>
    """
    message = Mail(
        from_email=settings.DEFAULT_FROM_EMAIL,
        to_emails=[recipient],
        subject=subject,
        plain_text_content=text,
        html_content=html,
    )
    try:
        response = SendGridAPIClient(api_key).send(message)
    except Exception:
        logger.exception("Trimiterea emailului pentru cererea de personal #%s a eșuat.", item.pk)
        return False
    return 200 <= int(getattr(response, "status_code", 0) or 0) < 300
