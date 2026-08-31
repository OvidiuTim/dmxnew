import logging
from datetime import date

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from django.utils.html import escape

from ToolApp.models import (
    AttendanceAbsenceMark,
    AttendanceSession,
    EmployeeTeam,
    LeaveDay,
    LeaveRequest,
    TeamAttendanceAlert,
    TeamAttendanceAlertRecipient,
    Users,
)
from ToolApp.push_notifications import send_employee_push


logger = logging.getLogger(__name__)
ALERT_HOUR = 7
ALERT_MINUTE = 40


def _configured_non_working_dates():
    values = getattr(settings, "TEAM_ALERT_NON_WORKING_DATES", ()) or ()
    parsed = set()
    for value in values:
        try:
            parsed.add(date.fromisoformat(str(value)))
        except ValueError:
            logger.warning("Data nelucrătoare ignorată: %s", value)
    return parsed


def is_team_working_day(work_date):
    non_working_weekdays = set(getattr(settings, "TEAM_ALERT_NON_WORKING_WEEKDAYS", (7,)) or (7,))
    return work_date.isoweekday() not in non_working_weekdays and work_date not in _configured_non_working_dates()


def _missing_members(team, work_date):
    employees = Users.objects.filter(
        team_memberships__team=team,
        team_memberships__active=True,
        person_type=Users.PersonType.EMPLOYEE,
        employment_status=Users.EmploymentStatus.ACTIVE,
        active=True,
        attendance_exempt=False,
    ).filter(Q(hire_date__isnull=True) | Q(hire_date__lte=work_date)).distinct()
    present_ids = AttendanceSession.objects.filter(
        work_date=work_date,
        user_fk__in=employees,
        in_time__isnull=False,
    ).values_list("user_fk_id", flat=True)
    leave_ids = LeaveDay.objects.filter(
        work_date=work_date,
        user_fk__in=employees,
    ).values_list("user_fk_id", flat=True)
    approved_leave_ids = LeaveRequest.objects.filter(
        employee__in=employees,
        status=LeaveRequest.Status.APPROVED,
        start_date__lte=work_date,
        end_date__gte=work_date,
    ).values_list("employee_id", flat=True)
    marked_absent_ids = AttendanceAbsenceMark.objects.filter(
        work_date=work_date,
        employee__in=employees,
    ).values_list("employee_id", flat=True)
    return list(
        employees.exclude(pk__in=present_ids)
        .exclude(pk__in=leave_ids)
        .exclude(pk__in=approved_leave_ids)
        .exclude(pk__in=marked_absent_ids)
        .order_by("UserName")
    )


def _send_email(alert, recipients):
    addresses = sorted({str(employee.email or "").strip().lower() for employee in recipients if employee.email})
    if not addresses:
        return False
    api_key = str(getattr(settings, "SENDGRID_API_KEY", "") or "").strip()
    if not api_key:
        logger.warning("Email alertă pontaj #%s netrimis: SENDGRID_API_KEY lipsește.", alert.pk)
        return False
    names = list(alert.missing_employees.order_by("UserName").values_list("UserName", flat=True))
    worksite = alert.worksite or "Fără șantier asignat"
    rows = "".join(f"<li>{escape(name)}</li>" for name in names)
    title = f"Lipsă pontaj · {alert.team.name} · {alert.work_date.strftime('%d.%m.%Y')}"
    text = (
        f"Echipă: {alert.team.name}\nȘantier: {worksite}\nData: {alert.work_date.isoformat()}\n"
        "Angajați fără check-in:\n- " + "\n- ".join(names)
    )
    html = f"""
      <div style="font-family:Arial,sans-serif;color:#142033;line-height:1.5">
        <h2>{escape(title)}</h2>
        <p><strong>Echipă:</strong> {escape(alert.team.name)}<br>
           <strong>Șantier:</strong> {escape(worksite)}<br>
           <strong>Data:</strong> {alert.work_date.strftime('%d.%m.%Y')}</p>
        <p><strong>Angajați fără check-in la 07:40:</strong></p><ul>{rows}</ul>
      </div>
    """
    try:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail
        response = SendGridAPIClient(api_key).send(Mail(
            from_email=settings.DEFAULT_FROM_EMAIL,
            to_emails=addresses,
            subject=title,
            plain_text_content=text,
            html_content=html,
        ))
        return 200 <= int(getattr(response, "status_code", 0) or 0) < 300
    except Exception:
        logger.exception("Emailul alertei de pontaj #%s a eșuat.", alert.pk)
        return False


def create_team_attendance_alerts(work_date=None, send_email=True, send_push=True):
    work_date = work_date or timezone.localdate()
    summary = {"date": work_date.isoformat(), "created": 0, "duplicates": 0, "teams_without_missing": 0, "emails": 0, "push": 0, "skipped_non_working_day": False}
    if not is_team_working_day(work_date):
        summary["skipped_non_working_day"] = True
        logger.info("Alertele de pontaj au fost omise pentru ziua nelucrătoare %s.", work_date)
        return summary

    teams = EmployeeTeam.objects.filter(active=True).select_related("leader", "supervisor").order_by("name")
    for team in teams:
        missing = _missing_members(team, work_date)
        if not missing:
            summary["teams_without_missing"] += 1
            continue
        with transaction.atomic():
            alert, created = TeamAttendanceAlert.objects.get_or_create(
                team=team,
                work_date=work_date,
                defaults={"worksite": team.default_worksite or ""},
            )
            if not created:
                summary["duplicates"] += 1
                existing_ids = set(alert.missing_employees.values_list("pk", flat=True))
                alert.missing_employees.add(*[employee for employee in missing if employee.pk not in existing_ids])
            else:
                alert.missing_employees.set(missing)
            recipients = {team.leader_id: team.leader}
            supervisor = team.effective_supervisor
            recipients[supervisor.pk] = supervisor
            recipient_rows = [
                TeamAttendanceAlertRecipient.objects.get_or_create(alert=alert, employee=employee)[0]
                for employee in recipients.values()
            ]
        if not created:
            continue
        summary["created"] += 1
        if send_email and _send_email(alert, list(recipients.values())):
            now = timezone.now()
            TeamAttendanceAlertRecipient.objects.filter(pk__in=[row.pk for row in recipient_rows]).update(email_sent_at=now)
            summary["emails"] += 1
        if send_push:
            names = ", ".join(employee.UserName for employee in missing)
            push_result = send_employee_push(
                recipients.keys(),
                "Angajați fără pontaj",
                f"{team.name}: {names}",
                {"route": "notifications", "alert_id": alert.pk, "type": "missing_attendance"},
            )
            if push_result["sent"]:
                now = timezone.now()
                TeamAttendanceAlertRecipient.objects.filter(pk__in=[row.pk for row in recipient_rows]).update(push_sent_at=now)
            summary["push"] += push_result["sent"]
        logger.info("Alertă pontaj creată pentru echipa=%s data=%s lipsă=%s", team.pk, work_date, len(missing))
    # Păstrează un caz auditabil per angajat pentru pagina centrală „Alerte”.
    # Importul local evită dependența circulară dintre serviciul inițial și escaladări.
    from ToolApp.attendance_alert_escalation import sync_initial_alert_cases
    sync_initial_alert_cases(work_date)
    return summary


def ensure_team_attendance_alerts_due(now=None, send_email=True, send_push=True):
    """Creează idempotent alertele numai după 07:40 în fusul orar Django."""
    local_now = timezone.localtime(now or timezone.now())
    if (local_now.hour, local_now.minute) < (ALERT_HOUR, ALERT_MINUTE):
        return {
            "date": local_now.date().isoformat(),
            "created": 0,
            "duplicates": 0,
            "before_alert_time": True,
        }
    result = create_team_attendance_alerts(
        work_date=local_now.date(),
        send_email=send_email,
        send_push=send_push,
    )
    result["before_alert_time"] = False
    return result
