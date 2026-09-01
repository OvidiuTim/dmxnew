import logging

from django.conf import settings
from django.utils.html import escape


logger = logging.getLogger(__name__)
LEAVE_REQUEST_OFFICE_EMAIL = "office@dmxconstruction.ro"
SUPERVISOR_PERSONAL_LEAVE_EMAIL = "dan@dmxconstruction.ro"


def leave_request_recipients(item):
    recipients = [LEAVE_REQUEST_OFFICE_EMAIL]
    leader_email = str(getattr(item.assigned_leader, "email", "") or "").strip().lower()
    if leader_email and leader_email not in recipients:
        recipients.insert(0, leader_email)
    if item.employee.supervised_employee_teams.filter(active=True).exists():
        if SUPERVISOR_PERSONAL_LEAVE_EMAIL not in recipients:
            recipients.append(SUPERVISOR_PERSONAL_LEAVE_EMAIL)
    return recipients


def send_leave_request_email(item):
    recipients = leave_request_recipients(item)
    api_key = str(getattr(settings, "SENDGRID_API_KEY", "") or "").strip()
    if not api_key:
        logger.warning(
            "Cererea de concediu #%s nu a fost trimisă prin email: SENDGRID_API_KEY lipsește.",
            item.pk,
        )
        return False

    notifications_url = f"{settings.FRONTEND_BASE_URL}/pontaj/concedii"
    period = f"{item.start_date.strftime('%d.%m.%Y')} – {item.end_date.strftime('%d.%m.%Y')}"
    leave_type = item.get_leave_type_display()
    supervisor = item.assigned_leader.UserName if item.assigned_leader_id else "Neatribuit"
    subject = f"Cerere nouă de concediu – {item.employee.UserName}"
    text = (
        f"Cerere nouă de concediu\n\n"
        f"Angajat: {item.employee.UserName}\n"
        f"Tip: {leave_type}\n"
        f"Perioadă: {period}\n"
        f"Motiv / observații: {item.reason or '-'}\n"
        f"Supervisor: {supervisor}\n\n"
        f"Vezi cererea: {notifications_url}"
    )
    html = f"""
      <div style="font-family:Arial,sans-serif;color:#142033;line-height:1.55">
        <h2 style="margin:0 0 16px">Cerere nouă de concediu</h2>
        <p><strong>Angajat:</strong> {escape(item.employee.UserName)}<br>
           <strong>Tip:</strong> {escape(leave_type)}<br>
           <strong>Perioadă:</strong> {escape(period)}<br>
           <strong>Motiv / observații:</strong> {escape(item.reason or '-')}<br>
           <strong>Supervisor:</strong> {escape(supervisor)}</p>
        <p><a href="{escape(notifications_url)}" style="display:inline-block;padding:11px 16px;border-radius:8px;background:#1c9d69;color:white;text-decoration:none">Deschide cererile</a></p>
      </div>
    """
    try:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail

        response = SendGridAPIClient(api_key).send(Mail(
            from_email=settings.DEFAULT_FROM_EMAIL,
            to_emails=recipients,
            subject=subject,
            plain_text_content=text,
            html_content=html,
        ))
    except Exception:
        logger.exception("Trimiterea emailului pentru cererea de concediu #%s a eșuat.", item.pk)
        return False
    return 200 <= int(getattr(response, "status_code", 0) or 0) < 300


def leave_approval_message(item, approver_name):
    period = f"{item.start_date.strftime('%d.%m.%Y')} – {item.end_date.strftime('%d.%m.%Y')}"
    return (
        f"{approver_name} a aprobat cererea de concediu pentru "
        f"{item.employee.UserName}, pentru perioada {period}."
    )


def send_leave_approval_email(item, approver_name):
    api_key = str(getattr(settings, "SENDGRID_API_KEY", "") or "").strip()
    if not api_key:
        logger.warning(
            "Aprobarea cererii de concediu #%s nu a fost trimisă prin email: SENDGRID_API_KEY lipsește.",
            item.pk,
        )
        return False

    message = leave_approval_message(item, approver_name)
    subject = f"Cerere de concediu aprobată – {item.employee.UserName}"
    html = f"""
      <div style="font-family:Arial,sans-serif;color:#142033;line-height:1.55">
        <h2 style="margin:0 0 16px">Cerere de concediu aprobată</h2>
        <p>{escape(message)}</p>
      </div>
    """
    try:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail

        response = SendGridAPIClient(api_key).send(Mail(
            from_email=settings.DEFAULT_FROM_EMAIL,
            to_emails=[LEAVE_REQUEST_OFFICE_EMAIL],
            subject=subject,
            plain_text_content=message,
            html_content=html,
        ))
    except Exception:
        logger.exception("Trimiterea aprobării pentru cererea de concediu #%s a eșuat.", item.pk)
        return False
    return 200 <= int(getattr(response, "status_code", 0) or 0) < 300
