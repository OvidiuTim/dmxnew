import json

from django.db.models import Q
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

from ToolApp.attendance_alert_escalation import (
    absence_marking_locked,
    company_missing_employees,
    ensure_default_configs,
    ensure_level2_auto_marks,
    escalation_levels_for_user,
    level_alert_time,
    mark_employee_absent,
    refresh_resolutions,
    team_by_employee,
)
from ToolApp.models import (
    AppUser,
    AttendanceAbsenceMark,
    AttendanceAlertCase,
    AttendanceSession,
    EmployeeTeam,
    LeaveDay,
    TeamAttendanceAlert,
    TeamAttendanceAlertRecipient,
    Users,
)
from ToolApp.module_access import app_user_has_module, app_user_roles
from ToolApp.security import get_app_user_from_request
from ToolApp.team_attendance_notifications import ensure_team_attendance_alerts_due
from ToolApp.views import nfc_scan
from ToolApp.worksites import ACCEPTED_WORKSITES


def _error(message, status=400):
    return JsonResponse({"error": message}, status=status)


def _portal_actor(request):
    app_user = getattr(request, "app_user", None) or get_app_user_from_request(request)
    if not app_user or not app_user.is_active:
        return None
    if not app_user_has_module(app_user, "team_dashboard"):
        return None
    return app_user


def _escalation_levels(app_user):
    return set(escalation_levels_for_user(app_user))


def _has_global_absence_access(app_user):
    """Nivel 1 și Nivel 2 văd toți angajații companiei, indiferent de echipele lor."""
    return bool(_escalation_levels(app_user).intersection({1, 2}))


def _role_labels(app_user):
    """Denumirile configurate pentru nivelurile de alertă ale utilizatorului."""
    levels = _escalation_levels(app_user)
    labels = {}
    for config in ensure_default_configs():
        if config.level in levels:
            labels[config.level] = (config.role_name or f"Nivel {config.level}").strip()
    return labels


def _coordinated_teams(app_user):
    return EmployeeTeam.objects.filter(active=True).filter(
        Q(leader_id=app_user.employee_id) | Q(supervisor_id=app_user.employee_id)
    ).select_related("leader", "supervisor").prefetch_related("memberships__employee").distinct()


def _presence_status(employee_ids, day=None):
    day = day or timezone.localdate()
    not_required_ids = set(Users.objects.filter(
        pk__in=employee_ids,
    ).filter(
        Q(attendance_exempt=True) | Q(hire_date__gt=day)
    ).values_list("pk", flat=True))
    leave_rows = dict(LeaveDay.objects.filter(
        work_date=day,
        user_fk_id__in=employee_ids,
    ).values_list("user_fk_id", "reason"))
    attendance_ids = set(AttendanceSession.objects.filter(
        work_date=day,
        user_fk_id__in=employee_ids,
        in_time__isnull=False,
    ).values_list("user_fk_id", flat=True))
    return {
        employee_id: (
            "marked_absent" if leave_rows.get(employee_id) == LeaveDay.Reason.UNEXCUSED
            else "leave" if employee_id in leave_rows
            else "present" if employee_id in attendance_ids
            else "not_required" if employee_id in not_required_ids
            else "absent"
        )
        for employee_id in employee_ids
    }


def _employee_summary(employee, status):
    return {
        "id": employee.pk,
        "name": employee.UserName,
        "phone": employee.phone_number or "",
        "photo": employee.photo or None,
        "status": status,
    }


@csrf_exempt
def portal_dashboard(request):
    if request.method != "GET":
        return _error("Metodă nepermisă.", 405)
    app_user = _portal_actor(request)
    if not app_user:
        return _error("Nu ai acces la Team Dashboard.", 403)
    teams = list(_coordinated_teams(app_user))
    own_status = _presence_status([app_user.employee_id]).get(app_user.employee_id, "absent")
    ensure_team_attendance_alerts_due()
    levels = _escalation_levels(app_user)
    day = timezone.localdate()
    ensure_level2_auto_marks(day)
    if levels:
        _sync_global_alert_recipients(app_user, day)
    unread = _notification_query(app_user).filter(read_at__isnull=True).count()
    roles = app_user_roles(app_user)
    labels = _role_labels(app_user)
    payload = {
        "employee": {
            "id": app_user.employee_id,
            "name": app_user.employee.UserName,
            "photo": app_user.employee.photo or None,
        },
        "roles": roles,
        "role_labels": {str(level): label for level, label in labels.items()},
        "is_team_leader": "team_leader" in roles,
        "is_supervisor": "supervisor" in roles,
        "alert_level_1": 1 in levels,
        "alert_level_2": 2 in levels,
        "status": own_status,
        "teams": [{"id": team.pk, "name": team.name} for team in teams],
        "unread_notifications": unread,
        "absence_marking_locked": absence_marking_locked(),
        "lock_time": level_alert_time(AttendanceAlertCase.Level.LEVEL_2).strftime("%H:%M"),
    }
    if 1 in levels:
        payload["missing_today_count"] = len(company_missing_employees(day))
    if 2 in levels:
        payload["absent_today_count"] = len(_absent_today_rows(day))
    return JsonResponse(payload)


@csrf_exempt
def portal_salary(request):
    if request.method != "GET":
        return _error("Metodă nepermisă.", 405)
    app_user = _portal_actor(request)
    if not app_user:
        return _error("Acces interzis.", 403)
    employee = app_user.employee
    return JsonResponse({
        "employee": {"id": employee.pk, "name": employee.UserName},
        "total_salary_ron": str(employee.total_salary_ron or "0.00"),
        "salary_advance_ron": str(employee.salary_advance_ron or "0.00"),
        "salary_remainder_ron": str(employee.salary_remainder_ron or "0.00"),
    })


@csrf_exempt
def portal_teams(request):
    if request.method != "GET":
        return _error("Metodă nepermisă.", 405)
    app_user = _portal_actor(request)
    if not app_user:
        return _error("Acces interzis.", 403)
    day = timezone.localdate()
    ensure_level2_auto_marks(day)
    teams = list(_coordinated_teams(app_user))
    member_ids = {
        membership.employee_id
        for team in teams
        for membership in team.memberships.filter(
            active=True,
            employee__active=True,
            employee__employment_status=Users.EmploymentStatus.ACTIVE,
        )
    }
    statuses = _presence_status(member_ids)
    payload = []
    for team in teams:
        members = []
        seen = set()
        for membership in team.memberships.filter(
            active=True,
            employee__active=True,
            employee__employment_status=Users.EmploymentStatus.ACTIVE,
        ).select_related("employee"):
            if membership.employee_id in seen:
                continue
            seen.add(membership.employee_id)
            members.append(_employee_summary(
                membership.employee,
                statuses.get(membership.employee_id, "absent"),
            ))
        members.sort(key=lambda item: (item["status"] != "absent", item["name"].casefold()))
        payload.append({"id": team.pk, "name": team.name, "members": members})
    return JsonResponse({
        "teams": payload,
        "locked": absence_marking_locked(),
        "lock_time": level_alert_time(AttendanceAlertCase.Level.LEVEL_2).strftime("%H:%M"),
    })


def _sync_global_alert_recipients(app_user, day=None):
    """Nivel 1/Nivel 2 primesc în aplicație alertele tuturor echipelor, nu doar ale lor.

    Constrângerea unică (alertă, angajat) previne dublurile la reapelare.
    """
    day = day or timezone.localdate()
    for alert in TeamAttendanceAlert.objects.filter(work_date=day):
        TeamAttendanceAlertRecipient.objects.get_or_create(alert=alert, employee_id=app_user.employee_id)


def _notification_query(app_user):
    query = TeamAttendanceAlertRecipient.objects.filter(employee_id=app_user.employee_id)
    if not _has_global_absence_access(app_user):
        query = query.filter(alert__team__in=_coordinated_teams(app_user))
    return query.filter(
        alert__missing_employees__active=True,
        alert__missing_employees__employment_status=Users.EmploymentStatus.ACTIVE,
        alert__missing_employees__attendance_exempt=False,
    ).filter(
        Q(alert__missing_employees__hire_date__isnull=True)
        | Q(alert__missing_employees__hire_date__lte=timezone.localdate())
    ).distinct()


def _team_summary(team):
    if not team:
        return {
            "id": None,
            "name": "Fără echipă",
            "leader_name": "",
            "leader_phone": "",
            "worksite": "",
        }
    leader = team.leader
    return {
        "id": team.pk,
        "name": team.name,
        "leader_name": leader.UserName if leader else "",
        "leader_phone": (leader.phone_number or "") if leader else "",
        "worksite": team.default_worksite or "",
    }


def _missing_row(employee, team, can_mark):
    return {
        "id": employee.pk,
        "name": employee.UserName,
        "phone": employee.phone_number or "",
        "photo": employee.photo or None,
        "status": "absent",
        "team": _team_summary(team),
        "can_mark_absent": bool(can_mark and team),
    }


def _absent_today_rows(day=None):
    """Absenții zilei pentru Nivel 2: nepontați după ora limită + marcați manual."""
    day = day or timezone.localdate()
    rows = {}
    marks = AttendanceAbsenceMark.objects.filter(work_date=day).select_related(
        "employee", "team", "team__leader", "marked_by", "marked_by__employee"
    )
    cases = {
        case.employee_id: case
        for case in AttendanceAlertCase.objects.filter(
            work_date=day, level=AttendanceAlertCase.Level.LEVEL_2
        ).select_related("escalated_by", "escalated_by__employee")
    }
    for mark in marks:
        case = cases.get(mark.employee_id)
        if mark.source == AttendanceAbsenceMark.Source.LEVEL_1:
            category = AttendanceAlertCase.EscalationSource.MARKED_BY_LEVEL_1
        elif mark.source == AttendanceAbsenceMark.Source.TEAM_LEADER:
            category = AttendanceAlertCase.EscalationSource.MARKED_BY_TEAM_LEADER
        else:
            category = AttendanceAlertCase.EscalationSource.SCHEDULED_0810
        if case and case.escalation_source:
            category = case.escalation_source
        actor = mark.marked_by.employee.UserName if mark.marked_by_id else "Automat · Nivel 2"
        rows[mark.employee_id] = {
            **_missing_row(mark.employee, mark.team, False),
            "status": "marked_absent",
            "category": category,
            "category_label": AttendanceAlertCase.EscalationSource(category).label,
            "marked_by": actor,
            "marked_at": timezone.localtime(mark.marked_at).isoformat(),
            "locked": bool(mark.locked_at),
            "checked_in_after_mark": AttendanceSession.objects.filter(
                user_fk_id=mark.employee_id, work_date=day, in_time__gt=mark.marked_at
            ).exists(),
        }
    if absence_marking_locked():
        for employee, team in company_missing_employees(day):
            if employee.pk in rows:
                continue
            rows[employee.pk] = {
                **_missing_row(employee, team, False),
                "category": AttendanceAlertCase.EscalationSource.SCHEDULED_0810,
                "category_label": AttendanceAlertCase.EscalationSource.SCHEDULED_0810.label,
                "marked_by": "Automat · Nivel 2",
                "marked_at": None,
                "locked": True,
                "checked_in_after_mark": False,
            }
    return sorted(rows.values(), key=lambda item: item["name"].casefold())


@csrf_exempt
def portal_missing_today(request):
    """Vezi lipsă · Nivel 1: toți angajații companiei fără check-in astăzi."""
    if request.method != "GET":
        return _error("Metodă nepermisă.", 405)
    app_user = _portal_actor(request)
    if not app_user:
        return _error("Acces interzis.", 403)
    levels = _escalation_levels(app_user)
    if not levels.intersection({1, 2}):
        return _error("Această listă este disponibilă doar pentru Nivel 1 și Nivel 2.", 403)
    day = timezone.localdate()
    ensure_team_attendance_alerts_due()
    refresh_resolutions(day)
    locked = absence_marking_locked()
    rows = [_missing_row(employee, team, not locked) for employee, team in company_missing_employees(day)]
    return JsonResponse({
        "date": day.isoformat(),
        "locked": locked,
        "lock_time": level_alert_time(AttendanceAlertCase.Level.LEVEL_2).strftime("%H:%M"),
        "employees": rows,
        "count": len(rows),
    })


@csrf_exempt
def portal_absent_today(request):
    """Lipsă azi · Nivel 2: nepontații după ora limită plus marcările manuale."""
    if request.method != "GET":
        return _error("Metodă nepermisă.", 405)
    app_user = _portal_actor(request)
    if not app_user:
        return _error("Acces interzis.", 403)
    if 2 not in _escalation_levels(app_user):
        return _error("Această listă este disponibilă doar pentru Nivel 2.", 403)
    day = timezone.localdate()
    ensure_team_attendance_alerts_due()
    ensure_level2_auto_marks(day)
    refresh_resolutions(day)
    rows = _absent_today_rows(day)
    return JsonResponse({
        "date": day.isoformat(),
        "lock_time": level_alert_time(AttendanceAlertCase.Level.LEVEL_2).strftime("%H:%M"),
        "employees": rows,
        "count": len(rows),
    })


def _notification_payload(recipient):
    alert = recipient.alert
    return {
        "id": recipient.pk,
        "team": {"id": alert.team_id, "name": alert.team.name},
        "status": "absent",
        "date": alert.work_date.isoformat(),
        "checked_at": alert.created_at.isoformat(),
        "is_read": recipient.read_at is not None,
        "employees": [
            {
                "id": employee.pk,
                "name": employee.UserName,
                "phone": employee.phone_number or "",
            }
            for employee in alert.missing_employees.filter(
                active=True,
                employment_status=Users.EmploymentStatus.ACTIVE,
                attendance_exempt=False,
            ).filter(
                Q(hire_date__isnull=True) | Q(hire_date__lte=alert.work_date)
            ).order_by("UserName")
        ],
    }


@csrf_exempt
def portal_notifications(request):
    app_user = _portal_actor(request)
    if not app_user:
        return _error("Acces interzis.", 403)
    if request.method == "GET":
        ensure_team_attendance_alerts_due()
        if _has_global_absence_access(app_user):
            _sync_global_alert_recipients(app_user)
    query = _notification_query(app_user).select_related("alert__team").prefetch_related("alert__missing_employees")
    if request.method == "GET":
        items = [_notification_payload(item) for item in query.order_by("-alert__created_at")]
        return JsonResponse({
            "notifications": items,
            "unread_count": sum(not item["is_read"] for item in items),
        })
    if request.method != "POST":
        return _error("Metodă nepermisă.", 405)
    try:
        data = json.loads(request.body or "{}")
        raw_ids = data.get("notification_ids", [])
        notification_ids = [int(value) for value in raw_ids]
    except (TypeError, ValueError, json.JSONDecodeError):
        return _error("Lista notificărilor este invalidă.")
    updated = query.filter(pk__in=notification_ids, read_at__isnull=True).update(read_at=timezone.now())
    return JsonResponse({
        "updated": updated,
        "unread_count": query.filter(read_at__isnull=True).count(),
    })


@csrf_exempt
def portal_mark_absent(request, employee_id):
    if request.method != "POST":
        return _error("Metodă nepermisă.", 405)
    app_user = _portal_actor(request)
    if not app_user:
        return _error("Acces interzis.", 403)
    day = timezone.localdate()
    levels = _escalation_levels(app_user)
    is_level_1 = 1 in levels
    team = _coordinated_teams(app_user).filter(
        memberships__employee_id=employee_id,
        memberships__active=True,
    ).distinct().first()
    if not team and not is_level_1:
        return _error("Poți marca absent doar un membru al echipei coordonate.", 403)
    source = (
        AttendanceAbsenceMark.Source.TEAM_LEADER
        if team
        else AttendanceAbsenceMark.Source.LEVEL_1
    )
    if not team:
        # Nivel 1 marchează pe toată compania: echipa se ia de la angajat.
        team = team_by_employee([employee_id]).get(int(employee_id))
        if not team:
            return _error("Angajatul nu are o echipă activă și nu poate fi marcat lipsă.", 409)
    if absence_marking_locked():
        return _error(
            "După ora {} absențele sunt trecute automat de sistem și nu mai pot fi modificate.".format(
                level_alert_time(AttendanceAlertCase.Level.LEVEL_2).strftime("%H:%M")
            ),
            409,
        )
    employee = Users.objects.filter(
        pk=employee_id,
        active=True,
        employment_status=Users.EmploymentStatus.ACTIVE,
        attendance_exempt=False,
    ).filter(Q(hire_date__isnull=True) | Q(hire_date__lte=day)).first()
    if not employee:
        return _error("Angajatul nu există sau este inactiv.", 404)
    if AttendanceSession.objects.filter(user_fk=employee, work_date=day).exists():
        return _error("Angajatul are deja pontaj în ziua curentă.", 409)
    existing_leave = LeaveDay.objects.filter(user_fk=employee, work_date=day).first()
    if existing_leave and existing_leave.reason != LeaveDay.Reason.UNEXCUSED:
        return _error("Angajatul are deja un concediu înregistrat pentru ziua curentă.", 409)
    mark, case = mark_employee_absent(employee, team, app_user, source, day)
    return JsonResponse({
        "employee_id": employee.pk,
        "status": "marked_absent",
        "status_label": "Absent",
        "work_date": day.isoformat(),
        "marked_at": timezone.localtime(mark.marked_at).isoformat(),
        "marked_by": {"id": app_user.employee_id, "name": app_user.employee.UserName},
        "source": mark.source,
        "escalated_to_level": case.level,
        "escalation_source": case.escalation_source,
        "escalated_at": timezone.localtime(case.escalated_at).isoformat() if case.escalated_at else None,
    })


@csrf_exempt
def portal_worksites(request):
    if request.method != "GET":
        return _error("Metodă nepermisă.", 405)
    if not _portal_actor(request):
        return _error("Acces interzis.", 403)
    return JsonResponse({"worksites": list(ACCEPTED_WORKSITES)})


@csrf_exempt
def portal_attendance(request):
    """Pontaj manual exclusiv pentru angajatul asociat sesiunii AppUser."""
    if request.method != "POST":
        return _error("Metodă nepermisă.", 405)
    app_user = _portal_actor(request)
    if not app_user:
        return _error("Acces interzis.", 403)
    try:
        data = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return _error("JSON invalid.")
    raw_consent = data.get("data_processing_consent")
    consent = raw_consent is True or str(raw_consent).strip().lower() in {"1", "true", "yes"}
    if not consent:
        return JsonResponse({
            "error": "Este necesar acordul pentru prelucrarea datelor înainte de pontaj.",
            "error_code": "DATA_PROCESSING_CONSENT_REQUIRED",
        }, status=400)
    if not str(data.get("attendance_photo") or "").strip():
        return JsonResponse({
            "error": "Selfie-ul confirmat este obligatoriu pentru pontaj.",
            "error_code": "ATTENDANCE_PHOTO_REQUIRED",
        }, status=400)
    # Identitatea transmisă de browser nu este niciodată folosită. Backendul
    # impune angajatul legat de cookie-ul HttpOnly autentificat.
    data.update({
        "uid": "MANUAL",
        "tag_type": "manual",
        "content": str(app_user.employee.UserPin),
        "mode": "manual",
        "device_key": f"team-portal-{app_user.AppUserId}",
    })
    request._body = json.dumps(data).encode("utf-8")
    return nfc_scan(request)
