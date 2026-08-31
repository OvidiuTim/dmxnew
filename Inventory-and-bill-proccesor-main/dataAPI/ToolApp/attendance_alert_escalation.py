import logging
from collections import defaultdict
from datetime import time

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from django.utils.html import escape

from ToolApp.models import (
    AppUser,
    AttendanceAbsenceMark,
    AttendanceAlertCase,
    AttendanceAlertDispatch,
    AttendanceAlertEscalationConfig,
    AttendanceAlertEscalationNotification,
    AttendanceAlertRunLog,
    AttendanceSession,
    EmployeeTeam,
    LeaveDay,
    Users,
)
from ToolApp.team_attendance_notifications import (
    ALERT_HOUR,
    ALERT_MINUTE,
    _missing_members,
    create_team_attendance_alerts,
    is_team_working_day,
)


logger = logging.getLogger(__name__)
DEFAULT_LEVEL_TIMES = {1: time(7, 55), 2: time(8, 10)}
EMAIL_SUBJECTS = {
    1: "Persoane care nu s-au pontat încă astăzi",
    2: "Absenți astăzi",
}


def ensure_default_configs():
    configs = []
    for level, alert_time in DEFAULT_LEVEL_TIMES.items():
        config, _ = AttendanceAlertEscalationConfig.objects.get_or_create(
            level=level,
            defaults={
                "role_name": f"Nivel {level}",
                "alert_time": alert_time,
                "active": True,
            },
        )
        configs.append(config)
    return configs


def _current_missing_by_employee(work_date):
    result = {}
    teams = EmployeeTeam.objects.filter(active=True).select_related("leader", "supervisor").order_by("name")
    for team in teams:
        for employee in _missing_members(team, work_date):
            result.setdefault(employee.pk, (employee, team))
    return result


def _resolution_for(case):
    employee = case.employee
    if AttendanceSession.objects.filter(user_fk=employee, work_date=case.work_date, in_time__isnull=False).exists():
        return AttendanceAlertCase.ResolutionMethod.CHECK_IN, None
    mark = AttendanceAbsenceMark.objects.filter(employee=employee, work_date=case.work_date).select_related("marked_by").first()
    if mark:
        return AttendanceAlertCase.ResolutionMethod.MARKED_ABSENT, mark.marked_by
    if LeaveDay.objects.filter(user_fk=employee, work_date=case.work_date).exists():
        return AttendanceAlertCase.ResolutionMethod.LEAVE, None
    if employee.attendance_exempt:
        return AttendanceAlertCase.ResolutionMethod.NOT_REQUIRED, None
    if (
        not employee.active
        or employee.employment_status != Users.EmploymentStatus.ACTIVE
        or employee.person_type != Users.PersonType.EMPLOYEE
    ):
        return AttendanceAlertCase.ResolutionMethod.INACTIVE, None
    return AttendanceAlertCase.ResolutionMethod.NO_LONGER_ELIGIBLE, None


def sync_cases(work_date, level, missing=None):
    missing = missing if missing is not None else _current_missing_by_employee(work_date)
    now = timezone.now()
    active_ids = set(missing)
    unresolved = AttendanceAlertCase.objects.filter(work_date=work_date, resolved_at__isnull=True)
    for case in unresolved.exclude(employee_id__in=active_ids).select_related("employee"):
        method, resolver = _resolution_for(case)
        case.resolved_at = now
        case.resolution_method = method
        case.resolved_by = resolver
        case.save(update_fields=("resolved_at", "resolution_method", "resolved_by"))

    created = []
    for employee, team in missing.values():
        case, was_created = AttendanceAlertCase.objects.get_or_create(
            employee=employee,
            work_date=work_date,
            level=level,
            defaults={"team": team, "worksite": team.default_worksite or ""},
        )
        if was_created:
            created.append(case)
    return created


def refresh_resolutions(work_date):
    missing = _current_missing_by_employee(work_date)
    active_ids = set(missing)
    now = timezone.now()
    updated = 0
    for case in (
        AttendanceAlertCase.objects.filter(work_date=work_date, resolved_at__isnull=True)
        .exclude(employee_id__in=active_ids)
        .select_related("employee")
    ):
        method, resolver = _resolution_for(case)
        case.resolved_at = now
        case.resolution_method = method
        case.resolved_by = resolver
        case.save(update_fields=("resolved_at", "resolution_method", "resolved_by"))
        updated += 1
    return updated


def sync_initial_alert_cases(work_date):
    return sync_cases(work_date, AttendanceAlertCase.Level.INITIAL)


def _grouped_payload(cases):
    grouped = defaultdict(lambda: defaultdict(list))
    for case in cases:
        site = case.worksite or "Fără șantier asignat"
        grouped[case.team.name][site].append(case)
    return grouped


def _send_central_email(level, work_date, email, cases):
    api_key = str(getattr(settings, "SENDGRID_API_KEY", "") or "").strip()
    if not api_key:
        raise RuntimeError("SENDGRID_API_KEY lipsește")
    grouped = _grouped_payload(cases)
    text_lines = [EMAIL_SUBJECTS[level], f"Data: {work_date.strftime('%d.%m.%Y')}", ""]
    html_sections = []
    for team_name, sites in grouped.items():
        text_lines.append(f"Echipa: {team_name}")
        site_sections = []
        for site_name, rows in sites.items():
            text_lines.append(f"  Șantier: {site_name}")
            items = []
            for case in rows:
                employee = case.employee
                leader = case.team.leader.UserName
                phone = employee.phone_number or "—"
                text_lines.append(f"    - {employee.UserName} | Șef: {leader} | Telefon: {phone}")
                items.append(
                    "<li><strong>{}</strong><br>Echipă: {} · Șef: {} · Telefon: {}</li>".format(
                        escape(employee.UserName), escape(team_name), escape(leader), escape(phone)
                    )
                )
            site_sections.append(f"<h4>{escape(site_name)}</h4><ul>{''.join(items)}</ul>")
        html_sections.append(f"<h3>{escape(team_name)}</h3>{''.join(site_sections)}")

    from sendgrid import SendGridAPIClient
    from sendgrid.helpers.mail import Mail

    response = SendGridAPIClient(api_key).send(Mail(
        from_email=settings.DEFAULT_FROM_EMAIL,
        to_emails=[email],
        subject=EMAIL_SUBJECTS[level],
        plain_text_content="\n".join(text_lines),
        html_content=(
            '<div style="font-family:Arial,sans-serif;color:#142033;line-height:1.5">'
            f"<h2>{escape(EMAIL_SUBJECTS[level])}</h2><p>{work_date.strftime('%d.%m.%Y')}</p>"
            f"{''.join(html_sections)}</div>"
        ),
    ))
    status = int(getattr(response, "status_code", 0) or 0)
    if status < 200 or status >= 300:
        raise RuntimeError(f"SendGrid a răspuns cu status {status}")


def process_escalation_level(level, work_date=None, now=None, send_email=True):
    local_now = timezone.localtime(now or timezone.now())
    work_date = work_date or local_now.date()
    config = next((row for row in ensure_default_configs() if row.level == level), None)
    run = AttendanceAlertRunLog.objects.create(work_date=work_date, level=level)
    errors = []
    emails_sent = []
    recipients = []
    try:
        if not is_team_working_day(work_date):
            run.status = "skipped_non_working_day"
            return {"status": run.status, "level": level, "count": 0}
        if not config or not config.active:
            run.status = "disabled"
            return {"status": run.status, "level": level, "count": 0}
        if local_now.time().replace(tzinfo=None) < config.alert_time:
            run.status = "before_alert_time"
            return {"status": run.status, "level": level, "count": 0}

        missing = _current_missing_by_employee(work_date)
        sync_cases(work_date, level, missing)
        cases = list(
            AttendanceAlertCase.objects.filter(work_date=work_date, level=level, resolved_at__isnull=True)
            .select_related("employee", "team", "team__leader")
            .order_by("team__name", "worksite", "employee__UserName")
        )
        run.case_count = len(cases)
        if not cases:
            run.status = "no_active_alerts"
            return {"status": run.status, "level": level, "count": 0}
        if not config.app_user_id:
            run.status = "missing_recipient"
            errors.append("Nu este selectată persoana destinatară.")
            return {"status": run.status, "level": level, "count": len(cases)}

        recipients = [config.app_user.username]
        with transaction.atomic():
            notification, _ = AttendanceAlertEscalationNotification.objects.get_or_create(
                recipient=config.app_user,
                work_date=work_date,
                level=level,
                defaults={"case_count": len(cases)},
            )
            if notification.case_count != len(cases):
                notification.case_count = len(cases)
                notification.save(update_fields=("case_count",))
            dispatch, _ = AttendanceAlertDispatch.objects.get_or_create(
                work_date=work_date,
                level=level,
                defaults={
                    "recipient": config.app_user,
                    "role_name": config.role_name,
                    "email": config.email,
                },
            )
            changed = []
            if not dispatch.email_sent_at:
                for field, value in (
                    ("recipient", config.app_user),
                    ("role_name", config.role_name),
                    ("email", config.email),
                ):
                    if getattr(dispatch, field) != value:
                        setattr(dispatch, field, value)
                        changed.append(field)
            if not dispatch.notification_sent_at:
                dispatch.notification_sent_at = timezone.now()
                changed.append("notification_sent_at")
            if changed:
                dispatch.save(update_fields=tuple(changed) + ("updated_at",))

        email = str(config.email or "").strip()
        if send_email and email and not dispatch.email_sent_at:
            try:
                _send_central_email(level, work_date, email, cases)
                dispatch.email_sent_at = timezone.now()
                dispatch.error = ""
                dispatch.save(update_fields=("email_sent_at", "error", "updated_at"))
                emails_sent.append(email)
            except Exception as exc:
                message = str(exc)
                errors.append(message)
                dispatch.error = message
                dispatch.save(update_fields=("error", "updated_at"))
                logger.exception("Escaladarea de pontaj nivel %s a eșuat", level)
        run.status = "completed_with_errors" if errors else "completed"
        return {"status": run.status, "level": level, "count": len(cases), "emails": emails_sent}
    finally:
        run.finished_at = timezone.now()
        run.recipients = recipients
        run.emails_sent = emails_sent
        run.errors = errors
        run.save(update_fields=("finished_at", "status", "case_count", "recipients", "emails_sent", "errors"))


def process_due_attendance_alerts(now=None, send_email=True, send_push=True):
    local_now = timezone.localtime(now or timezone.now())
    work_date = local_now.date()
    results = []
    if not is_team_working_day(work_date):
        return {"date": work_date.isoformat(), "skipped_non_working_day": True, "results": results}
    if (local_now.hour, local_now.minute) >= (ALERT_HOUR, ALERT_MINUTE):
        run = AttendanceAlertRunLog.objects.create(work_date=work_date, level=0)
        try:
            initial = create_team_attendance_alerts(work_date, send_email=send_email, send_push=send_push)
            sync_initial_alert_cases(work_date)
            run.case_count = AttendanceAlertCase.objects.filter(work_date=work_date, level=0).count()
            run.recipients = list(
                AppUser.objects.filter(
                    employee__received_attendance_alerts__alert__work_date=work_date
                ).values_list("username", flat=True).distinct()
            )
            run.status = "completed"
        except Exception as exc:
            run.status = "failed"
            run.errors = [str(exc)]
            raise
        finally:
            run.finished_at = timezone.now()
            run.save(update_fields=("finished_at", "status", "case_count", "recipients", "errors"))
        results.append({"level": 0, **initial})
    for config in ensure_default_configs():
        if local_now.time().replace(tzinfo=None) >= config.alert_time:
            results.append(process_escalation_level(config.level, work_date, now=now, send_email=send_email))
    return {"date": work_date.isoformat(), "skipped_non_working_day": False, "results": results}
