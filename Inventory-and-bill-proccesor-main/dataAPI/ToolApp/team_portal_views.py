import json

from django.db.models import Q
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

from ToolApp.models import (
    AppUser,
    AttendanceAbsenceMark,
    AttendanceSession,
    EmployeeTeam,
    LeaveDay,
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
    unread = TeamAttendanceAlertRecipient.objects.filter(
        employee_id=app_user.employee_id,
        read_at__isnull=True,
        alert__missing_employees__active=True,
        alert__missing_employees__employment_status=Users.EmploymentStatus.ACTIVE,
        alert__missing_employees__attendance_exempt=False,
    ).filter(
        Q(alert__missing_employees__hire_date__isnull=True)
        | Q(alert__missing_employees__hire_date__lte=timezone.localdate())
    ).distinct().count()
    return JsonResponse({
        "employee": {
            "id": app_user.employee_id,
            "name": app_user.employee.UserName,
            "photo": app_user.employee.photo or None,
        },
        "roles": app_user_roles(app_user),
        "status": own_status,
        "teams": [{"id": team.pk, "name": team.name} for team in teams],
        "unread_notifications": unread,
    })


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
    return JsonResponse({"teams": payload})


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
    query = TeamAttendanceAlertRecipient.objects.filter(
        employee_id=app_user.employee_id,
        alert__team__in=_coordinated_teams(app_user),
        alert__missing_employees__active=True,
        alert__missing_employees__employment_status=Users.EmploymentStatus.ACTIVE,
        alert__missing_employees__attendance_exempt=False,
    ).filter(
        Q(alert__missing_employees__hire_date__isnull=True)
        | Q(alert__missing_employees__hire_date__lte=timezone.localdate())
    ).distinct().select_related("alert__team").prefetch_related("alert__missing_employees")
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
    team = _coordinated_teams(app_user).filter(
        memberships__employee_id=employee_id,
        memberships__active=True,
    ).distinct().first()
    if not team:
        return _error("Poți marca absent doar un membru al echipei coordonate.", 403)
    day = timezone.localdate()
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
    leave, _ = LeaveDay.objects.update_or_create(
        user_fk=employee,
        work_date=day,
        defaults={
            "reason": LeaveDay.Reason.UNEXCUSED,
            "hours": 8,
            "multiplier": 0,
            "hourly_rate_snapshot": employee.hourly_rate or 0,
            "pay_amount": 0,
            "note": f"Marcat absent de {app_user.employee.UserName}",
        },
    )
    mark, _ = AttendanceAbsenceMark.objects.get_or_create(
        employee=employee,
        work_date=day,
        defaults={"team": team, "marked_by": app_user},
    )
    for alert in team.attendance_alerts.filter(work_date=day):
        alert.missing_employees.remove(employee)
    return JsonResponse({
        "employee_id": employee.pk,
        "status": "marked_absent",
        "status_label": "Absent",
        "work_date": day.isoformat(),
        "marked_at": mark.marked_at.isoformat(),
        "marked_by": {"id": app_user.employee_id, "name": app_user.employee.UserName},
        "leave_day_id": leave.pk,
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
