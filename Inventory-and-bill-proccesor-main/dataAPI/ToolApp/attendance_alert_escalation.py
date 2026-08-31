import logging
from collections import defaultdict
from datetime import time

from django.conf import settings
from django.db import transaction
from django.db.models import Q
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
    AttendanceLateCheckinReport,
    AttendanceSession,
    EmployeeTeam,
    LeaveDay,
    LeaveRequest,
    TeamAttendanceAlert,
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
LATE_CHECKIN_SUBJECT = "Angajați marcați absenți care s-au pontat ulterior"


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


def current_missing_by_employee(work_date=None):
    return _current_missing_by_employee(work_date or timezone.localdate())


def company_missing_employees(work_date=None):
    """Toți angajații companiei care trebuiau să fie prezenți azi și nu au check-in.

    Spre deosebire de `_current_missing_by_employee`, nu se limitează la echipe:
    include și angajații fără echipă activă, pentru listele globale Nivel 1/Nivel 2.
    """
    work_date = work_date or timezone.localdate()
    employees = Users.objects.filter(
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
    missing = list(
        employees.exclude(pk__in=present_ids)
        .exclude(pk__in=leave_ids)
        .exclude(pk__in=approved_leave_ids)
        .exclude(pk__in=marked_absent_ids)
        .order_by("UserName")
    )
    teams = team_by_employee([employee.pk for employee in missing])
    return [(employee, teams.get(employee.pk)) for employee in missing]


def team_by_employee(employee_ids):
    """Echipa activă a fiecărui angajat, într-un singur query."""
    from ToolApp.models import EmployeeTeamMember

    rows = EmployeeTeamMember.objects.filter(
        employee_id__in=list(employee_ids),
        active=True,
        team__active=True,
    ).select_related("team", "team__leader", "team__supervisor")
    return {row.employee_id: row.team for row in rows}


def level_alert_time(level):
    config = AttendanceAlertEscalationConfig.objects.filter(level=level).first()
    return config.alert_time if config and config.alert_time else DEFAULT_LEVEL_TIMES[level]


def absence_marking_locked(now=None):
    """După ora Nivelului 2 (implicit 08:10) marcarea manuală nu mai este permisă."""
    local_now = timezone.localtime(now or timezone.now())
    return local_now.time().replace(tzinfo=None) >= level_alert_time(AttendanceAlertCase.Level.LEVEL_2)


def ensure_level2_auto_marks(work_date=None, now=None):
    """Trece automat la absent, idempotent, tot ce nu s-a pontat până la ora Nivelului 2."""
    local_now = timezone.localtime(now or timezone.now())
    work_date = work_date or local_now.date()
    if not is_team_working_day(work_date):
        return 0
    if work_date == local_now.date() and not absence_marking_locked(local_now):
        return 0
    missing = _current_missing_by_employee(work_date)
    sync_cases(work_date, AttendanceAlertCase.Level.LEVEL_2, missing)
    cases = list(
        AttendanceAlertCase.objects.filter(
            work_date=work_date,
            level=AttendanceAlertCase.Level.LEVEL_2,
            resolved_at__isnull=True,
        ).select_related("employee", "team")
    )
    if not cases:
        return 0
    marked = _auto_mark_level2_cases(cases, work_date)
    _refresh_escalation_notification(AttendanceAlertCase.Level.LEVEL_2, work_date)
    return marked


@transaction.atomic
def mark_employee_absent(employee, team, actor, source, work_date=None):
    """Marchează persistent absența și escaladează imediat cazul la Nivel 2.

    `source` este o valoare `AttendanceAbsenceMark.Source`. Marcarea este unică pe
    angajat și zi, deci reapelarea nu creează duplicate.
    """
    work_date = work_date or timezone.localdate()
    now = timezone.now()
    LeaveDay.objects.update_or_create(
        user_fk=employee,
        work_date=work_date,
        defaults={
            "reason": LeaveDay.Reason.UNEXCUSED,
            "hours": 8,
            "multiplier": 0,
            "hourly_rate_snapshot": employee.hourly_rate or 0,
            "pay_amount": 0,
            "note": f"Marcat absent de {actor.employee.UserName}" if actor else "Marcat absent",
        },
    )
    mark, created = AttendanceAbsenceMark.objects.get_or_create(
        employee=employee,
        work_date=work_date,
        defaults={
            "team": team,
            "marked_by": actor,
            "source": source,
            "escalation_level": AttendanceAlertCase.Level.LEVEL_2,
            "locked_at": now,
        },
    )
    if not created and not mark.locked_at:
        mark.locked_at = now
        mark.escalation_level = AttendanceAlertCase.Level.LEVEL_2
        mark.save(update_fields=("locked_at", "escalation_level"))

    escalation_source = (
        AttendanceAlertCase.EscalationSource.MARKED_BY_LEVEL_1
        if source == AttendanceAbsenceMark.Source.LEVEL_1
        else AttendanceAlertCase.EscalationSource.MARKED_BY_TEAM_LEADER
    )
    case = escalate_employee_to_level2(employee, team, actor, escalation_source, work_date)
    if not case.marked_absent_at:
        case.marked_absent_at = mark.marked_at
        case.save(update_fields=("marked_absent_at",))

    # Cazurile deschise pe nivelurile inferioare devin rezolvate prin marcarea absenței.
    AttendanceAlertCase.objects.filter(
        employee=employee,
        work_date=work_date,
        resolved_at__isnull=True,
    ).exclude(level=AttendanceAlertCase.Level.LEVEL_2).update(
        resolved_at=now,
        resolution_method=AttendanceAlertCase.ResolutionMethod.MARKED_ABSENT,
        resolved_by=actor,
    )
    for alert in TeamAttendanceAlert.objects.filter(work_date=work_date, missing_employees=employee):
        alert.missing_employees.remove(employee)
    return mark, case


def escalation_levels_for_user(app_user):
    if not app_user:
        return []
    return list(
        AttendanceAlertEscalationConfig.objects.filter(app_user=app_user, active=True)
        .order_by("level")
        .values_list("level", flat=True)
    )


def _refresh_escalation_notification(level, work_date):
    config = AttendanceAlertEscalationConfig.objects.filter(level=level, active=True).select_related("app_user").first()
    if not config or not config.app_user_id:
        return None
    count = AttendanceAlertCase.objects.filter(work_date=work_date, level=level).count()
    notification, _ = AttendanceAlertEscalationNotification.objects.get_or_create(
        recipient=config.app_user,
        work_date=work_date,
        level=level,
        defaults={"case_count": count},
    )
    if notification.case_count != count:
        notification.case_count = count
        notification.save(update_fields=("case_count",))
    return notification


def escalate_employee_to_level2(employee, team, actor, source, work_date=None):
    work_date = work_date or timezone.localdate()
    now = timezone.now()
    case, _ = AttendanceAlertCase.objects.get_or_create(
        employee=employee,
        work_date=work_date,
        level=AttendanceAlertCase.Level.LEVEL_2,
        defaults={
            "team": team,
            "worksite": team.default_worksite or "",
            "escalation_source": source,
            "escalated_at": now,
            "marked_absent_at": now,
            "escalated_by": actor,
        },
    )
    changed = []
    for field, value in (
        ("team", team),
        ("worksite", team.default_worksite or ""),
        ("escalation_source", source),
        ("escalated_by", actor),
    ):
        if getattr(case, field) != value:
            setattr(case, field, value)
            changed.append(field)
    if not case.escalated_at:
        case.escalated_at = now
        changed.append("escalated_at")
    if not case.marked_absent_at:
        case.marked_absent_at = now
        changed.append("marked_absent_at")
    if changed:
        case.save(update_fields=changed)
    _refresh_escalation_notification(AttendanceAlertCase.Level.LEVEL_2, work_date)
    return case


def _auto_mark_level2_cases(cases, work_date):
    now = timezone.now()
    marked = 0
    for case in cases:
        employee = case.employee
        LeaveDay.objects.update_or_create(
            user_fk=employee,
            work_date=work_date,
            defaults={
                "reason": LeaveDay.Reason.UNEXCUSED,
                "hours": 8,
                "multiplier": 0,
                "hourly_rate_snapshot": employee.hourly_rate or 0,
                "pay_amount": 0,
                "note": "Marcat automat absent la escaladarea Nivel 2",
            },
        )
        mark, created = AttendanceAbsenceMark.objects.get_or_create(
            employee=employee,
            work_date=work_date,
            defaults={
                "team": case.team,
                "marked_by": None,
                "source": AttendanceAbsenceMark.Source.AUTOMATIC_LEVEL_2,
                "escalation_level": 2,
                "locked_at": now,
            },
        )
        if created:
            marked += 1
        changed = []
        if not case.escalation_source:
            case.escalation_source = AttendanceAlertCase.EscalationSource.SCHEDULED_0810
            changed.append("escalation_source")
        if not case.escalated_at:
            case.escalated_at = now
            changed.append("escalated_at")
        if not case.marked_absent_at:
            case.marked_absent_at = mark.marked_at
            changed.append("marked_absent_at")
        if changed:
            case.save(update_fields=changed)
        for alert in TeamAttendanceAlert.objects.filter(work_date=work_date, missing_employees=employee):
            alert.missing_employees.remove(employee)
    return marked


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
        if level == AttendanceAlertCase.Level.LEVEL_2:
            _auto_mark_level2_cases(cases, work_date)
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
    if (local_now.hour, local_now.minute) >= (18, 0):
        results.append(send_late_checkin_report(work_date, now=now, send_email=send_email))
    return {"date": work_date.isoformat(), "skipped_non_working_day": False, "results": results}


def _send_late_checkin_email(email, work_date, rows):
    api_key = str(getattr(settings, "SENDGRID_API_KEY", "") or "").strip()
    if not api_key:
        raise RuntimeError("SENDGRID_API_KEY lipsește")
    text_lines = [LATE_CHECKIN_SUBJECT, f"Data: {work_date.strftime('%d.%m.%Y')}", ""]
    html_rows = []
    for mark, session in rows:
        actor = mark.marked_by.employee.UserName if mark.marked_by_id else "Sistem · Nivel 2"
        text_lines.append(
            f"- {mark.employee.UserName} | Pontat la {timezone.localtime(session.in_time).strftime('%H:%M')} | Marcat de: {actor}"
        )
        html_rows.append(
            "<li><strong>{}</strong> · pontat la {} · marcat de {}</li>".format(
                escape(mark.employee.UserName),
                timezone.localtime(session.in_time).strftime("%H:%M"),
                escape(actor),
            )
        )
    from sendgrid import SendGridAPIClient
    from sendgrid.helpers.mail import Mail
    response = SendGridAPIClient(api_key).send(Mail(
        from_email=settings.DEFAULT_FROM_EMAIL,
        to_emails=[email],
        subject=LATE_CHECKIN_SUBJECT,
        plain_text_content="\n".join(text_lines),
        html_content=(
            '<div style="font-family:Arial,sans-serif;color:#142033;line-height:1.5">'
            f"<h2>{escape(LATE_CHECKIN_SUBJECT)}</h2><p>{work_date.strftime('%d.%m.%Y')}</p>"
            f"<ul>{''.join(html_rows)}</ul></div>"
        ),
    ))
    status = int(getattr(response, "status_code", 0) or 0)
    if status < 200 or status >= 300:
        raise RuntimeError(f"SendGrid a răspuns cu status {status}")


def send_late_checkin_report(work_date=None, now=None, send_email=True):
    local_now = timezone.localtime(now or timezone.now())
    work_date = work_date or local_now.date()
    if not is_team_working_day(work_date):
        return {"type": "late_checkin", "status": "skipped_non_working_day", "count": 0}
    if local_now.date() == work_date and (local_now.hour, local_now.minute) < (18, 0):
        return {"type": "late_checkin", "status": "before_report_time", "count": 0}
    config = AttendanceAlertEscalationConfig.objects.filter(level=2, active=True).select_related("app_user").first()
    if not config or not config.app_user_id or not str(config.email or "").strip():
        return {"type": "late_checkin", "status": "missing_recipient", "count": 0}
    rows = []
    marks = AttendanceAbsenceMark.objects.filter(work_date=work_date).select_related(
        "employee", "marked_by", "marked_by__employee"
    )
    for mark in marks:
        session = AttendanceSession.objects.filter(
            user_fk=mark.employee,
            work_date=work_date,
            in_time__gt=mark.marked_at,
        ).order_by("in_time").first()
        if session:
            rows.append((mark, session))
    if not rows:
        return {"type": "late_checkin", "status": "no_late_checkins", "count": 0}
    report, _ = AttendanceLateCheckinReport.objects.get_or_create(
        work_date=work_date,
        defaults={
            "recipient": config.app_user,
            "email": config.email,
            "employee_count": len(rows),
        },
    )
    if report.sent_at:
        return {"type": "late_checkin", "status": "already_sent", "count": report.employee_count}
    report.recipient = config.app_user
    report.email = config.email
    report.employee_count = len(rows)
    if not send_email:
        report.save(update_fields=("recipient", "email", "employee_count", "updated_at"))
        return {"type": "late_checkin", "status": "email_disabled", "count": len(rows)}
    try:
        _send_late_checkin_email(config.email, work_date, rows)
        report.sent_at = timezone.now()
        report.error = ""
        report.save(update_fields=("recipient", "email", "employee_count", "sent_at", "error", "updated_at"))
        return {"type": "late_checkin", "status": "sent", "count": len(rows)}
    except Exception as exc:
        report.error = str(exc)
        report.save(update_fields=("recipient", "email", "employee_count", "error", "updated_at"))
        logger.exception("Raportul de pontări după marcarea absenței a eșuat")
        return {"type": "late_checkin", "status": "error", "count": len(rows), "error": str(exc)}
