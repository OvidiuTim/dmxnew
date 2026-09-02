import json
from datetime import date

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Q
from django.http import JsonResponse
from django.utils import timezone
from django.utils.timezone import localdate
from django.views.decorators.csrf import csrf_exempt

from ToolApp.mobile_services import (
    build_inventory,
    build_leave_summary,
    build_monthly_attendance,
    build_salary_payments,
    build_team,
    calculate_payroll,
    dashboard_salary_period,
    first_payment_date,
    normalize_trade_code,
    employee_effective_hire_date,
    salary_period_payment_month,
    salary_period_is_eligible,
    seniority_months,
    serialize_leave_request,
)
from ToolApp.leave_email import send_leave_request_email
from ToolApp.models import (
    AppPagePermission,
    AppUser,
    AttendanceSession,
    EmployeeSalaryProfile,
    EmployeeTeam,
    EmployeeTeamMember,
    LeaveRequest,
    LeaveDay,
    MobileDevice,
    TeamAttendanceAlertRecipient,
    TemporaryWorkerRequest,
    Users,
)
from ToolApp.team_attendance_notifications import is_team_working_day
from ToolApp.module_access import TEAM_SCHEDULE_ROUTES, app_user_roles, effective_module_codes
from ToolApp import team_portal_views
from ToolApp.views import _find_user_by_pin, _log_pin_attempt, _pin_is_blocked


def _mobile_portal_request(request, target, *, method="GET", target_args=(), query=None):
    """Run a Team Dashboard view with the identity resolved by the mobile session.

    The portal views remain the single authorization and business-logic layer.  A
    mobile client only exchanges its PIN/device session for the corresponding
    ``AppUser`` and is then subject to the exact same module, role, team and time
    restrictions as the web portal.
    """
    data, employee, error = _mobile_post(request)
    if error:
        return error
    app_user = AppUser.objects.select_related("employee").filter(
        employee=employee,
        is_active=True,
    ).first()
    if not app_user:
        return _error(
            "TEAM_DASHBOARD_ACCOUNT_REQUIRED",
            "Contul angajatului nu este activat pentru Team Dashboard.",
            403,
        )

    request.app_user = app_user
    request.method = method
    if query:
        mobile_query = request.GET.copy()
        for key, value in query.items():
            mobile_query[key] = str(value)
        request.GET = mobile_query
    return target(request, *target_args)


def _error(error_code, message, status):
    return JsonResponse({"success": False, "error_code": error_code, "error": message}, status=status)


def _json_body(request):
    try:
        value = json.loads(request.body or "{}")
    except (TypeError, ValueError, UnicodeDecodeError):
        return None
    return value if isinstance(value, dict) else None


def resolve_mobile_employee(request, data):
    pin = str(data.get("pin") or "").strip()
    device_key = str(data.get("device_key") or "").strip()
    if not device_key or len(device_key) > 64:
        return None, _error("INVALID_DEVICE_KEY", "device_key este obligatoriu și trebuie să aibă maximum 64 de caractere.", 400)
    blocked, retry_after = _pin_is_blocked(request, device_key=device_key, uid="MANUAL")
    if blocked:
        response = _error("PIN_TEMPORARILY_BLOCKED", "Prea multe încercări greșite. Încearcă din nou mai târziu.", 429)
        response["Retry-After"] = str(retry_after)
        return None, response
    if not pin:
        _log_pin_attempt(request, success=False, reason="missing_pin", device_key=device_key, uid="MANUAL")
        return None, _error("PIN_REQUIRED", "PIN-ul este obligatoriu.", 400)
    employee = _find_user_by_pin(pin)
    if not employee:
        _log_pin_attempt(request, success=False, reason="invalid_pin", device_key=device_key, uid="MANUAL")
        return None, _error("INVALID_PIN", "Nu există niciun angajat pentru PIN-ul introdus.", 404)
    _log_pin_attempt(request, success=True, reason="mobile_ok", device_key=device_key, uid="MANUAL")
    return employee, None


def _mobile_post(request):
    if request.method != "POST":
        return None, None, _error("METHOD_NOT_ALLOWED", "Este permis doar POST.", 405)
    data = _json_body(request)
    if data is None:
        return None, None, _error("INVALID_JSON", "Corpul cererii nu este JSON valid.", 400)
    employee, error = resolve_mobile_employee(request, data)
    return data, employee, error


@csrf_exempt
def attendance_status(request):
    """Return the current employee state used by Android attendance reminders."""
    data, employee, error = _mobile_post(request)
    if error:
        return error

    day = localdate()
    sessions = AttendanceSession.objects.filter(
        user_fk=employee,
        work_date=day,
        in_time__isnull=False,
    )
    open_session = sessions.filter(out_time__isnull=True).exclude(
        source__contains="|missing_exit",
    ).order_by("-in_time").first()
    last_session = open_session or sessions.order_by("-in_time").first()
    on_leave = (
        LeaveDay.objects.filter(user_fk=employee, work_date=day).exists()
        or LeaveRequest.objects.filter(
            employee=employee,
            status=LeaveRequest.Status.APPROVED,
            start_date__lte=day,
            end_date__gte=day,
        ).exists()
    )
    attendance_required = not employee.attendance_exempt and (
        employee.hire_date is None or employee.hire_date <= day
    )
    payload = {
        "ok": True,
        "active": open_session is not None,
        "state": "ENTER" if open_session else "EXIT" if last_session else "NONE",
        "attendance_required": attendance_required,
        "is_working_day": is_team_working_day(day),
        "on_leave": on_leave,
        "employment_status": employee.employment_status,
        "user": {
            "id": employee.UserId,
            "name": employee.UserName,
            "serie": employee.UserSerie,
            "company": employee.Company,
        },
    }
    if last_session:
        elapsed_seconds = 0
        if open_session:
            elapsed_seconds = max(0, int((timezone.now() - open_session.in_time).total_seconds()))
        payload["session"] = {
            "work_date": str(last_session.work_date),
            "in_time": timezone.localtime(last_session.in_time).isoformat(),
            "elapsed_seconds": elapsed_seconds,
            "worksite": last_session.worksite,
        }
    return JsonResponse(payload)


def _coordinated_teams(employee):
    return EmployeeTeam.objects.filter(active=True).filter(
        Q(leader=employee) | Q(supervisor=employee)
    ).select_related("leader", "supervisor").prefetch_related("memberships__employee").distinct()


def mobile_access_context(employee):
    app_user = AppUser.objects.filter(employee=employee, is_active=True).first()
    roles = []
    modules = []
    permissions = set()
    if app_user:
        roles = app_user_roles(app_user)
        modules = effective_module_codes(app_user)
        permissions.update(AppPagePermission.objects.filter(
            app_user=app_user,
            can_access=True,
        ).values_list("route", flat=True))
    else:
        if EmployeeTeam.objects.filter(active=True, leader=employee).exists():
            roles.append("team_leader")
        if EmployeeTeam.objects.filter(active=True, supervisor=employee).exists():
            roles.append("supervisor")
    team_roles = set(roles).intersection({"team_leader", "supervisor"})
    if team_roles:
        permissions.update(TEAM_SCHEDULE_ROUTES)
        if "teams_schedule" not in modules:
            modules.append("teams_schedule")
    from ToolApp.module_access import MODULE_DEFINITIONS
    for module_code in modules:
        permissions.update(route["path"] for route in MODULE_DEFINITIONS[module_code]["routes"])
    teams = list(_coordinated_teams(employee))
    coordinated_team_ids = [team.pk for team in teams]
    unread = TeamAttendanceAlertRecipient.objects.filter(employee=employee, read_at__isnull=True).count()
    unread += TemporaryWorkerRequest.objects.filter(
        source_team_id__in=coordinated_team_ids,
        seen_at__isnull=True,
    ).count()
    unread += LeaveRequest.objects.filter(
        team_id__in=coordinated_team_ids,
        seen_at__isnull=True,
    ).filter(
        Q(team__supervisor=employee) | Q(team__supervisor__isnull=True, team__leader=employee)
    ).count()
    return {
        "roles": roles,
        "modules": modules,
        "is_storekeeper": "storekeeper" in roles,
        "can_access_tools": "tools" in modules,
        "effective_permissions": sorted(permissions),
        "coordinated_teams": [
            {
                "id": team.pk,
                "name": team.name,
                "worksite": team.default_worksite,
                "is_leader": team.leader_id == employee.pk,
                "is_supervisor": (team.supervisor_id or team.leader_id) == employee.pk,
            }
            for team in teams
        ],
        "unread_notifications": unread,
        "is_team_coordinator": bool(team_roles),
    }


def _mobile_team_payload(team, current_employee):
    members = []
    for membership in team.memberships.filter(
        active=True,
        employee__active=True,
        employee__employment_status=Users.EmploymentStatus.ACTIVE,
    ).select_related("employee").order_by("employee__UserName"):
        employee = membership.employee
        members.append({
            "employee_id": employee.pk,
            "display_name": employee.UserName,
            "trade": employee.trade or "",
            "photo": employee.photo,
            "is_team_leader": employee.pk == team.leader_id,
            "is_supervisor": employee.pk == (team.supervisor_id or team.leader_id),
            "is_current_user": employee.pk == current_employee.pk,
        })
    return {
        "id": team.pk,
        "name": team.name,
        "worksite": team.default_worksite,
        "leader": {"id": team.leader_id, "name": team.leader.UserName},
        "supervisor": {"id": team.effective_supervisor.pk, "name": team.effective_supervisor.UserName},
        "members": members,
    }


@csrf_exempt
def employee_dashboard(request):
    data, employee, error = _mobile_post(request)
    if error:
        return error
    today = localdate()
    effective_hire_date = employee_effective_hire_date(employee, today)
    profile = EmployeeSalaryProfile.objects.filter(employee=employee).first()
    salary_year, salary_month = dashboard_salary_period(today, effective_hire_date)
    payroll = calculate_payroll(employee, profile, salary_year, salary_month)
    eligible = salary_period_is_eligible(effective_hire_date, salary_year, salary_month)
    payment_year, payment_month = salary_period_payment_month(salary_year, salary_month)
    salary_payments = (
        build_salary_payments(profile, payroll, payment_year, payment_month)
        if eligible
        else []
    )
    equipment, tools = build_inventory(employee)
    payload = {
        "success": True,
        "profile": {
            "display_name": employee.UserName,
            "role_code": normalize_trade_code(employee.trade),
            "role": employee.trade,
            "company": employee.Company,
            "hire_date": effective_hire_date.isoformat(),
            "hire_date_source": "manual" if employee.hire_date else (
                "first_attendance" if AttendanceSession.objects.filter(user_fk=employee).exists() else "year_start_fallback"
            ),
            "seniority_months": seniority_months(effective_hire_date, today),
            "housing_location": employee.housing_location,
        },
        "total_salary_ron": f"{employee.total_salary_ron or 0:.2f}",
        "salary_advance_ron": f"{employee.salary_advance_ron or 0:.2f}",
        "salary_remainder_ron": f"{employee.salary_remainder_ron or 0:.2f}",
        "meal_vouchers_ron": f"{employee.meal_vouchers_ron or 0:.2f}",
        "attendance": build_monthly_attendance(employee, today.year, today.month),
        "payroll": payroll,
        "salary_payments": salary_payments,
        "leave_summary": build_leave_summary(employee, today),
        "equipment": equipment,
        "tools": tools,
        "team": build_team(employee),
        "access": mobile_access_context(employee),
    }
    first_date = first_payment_date(effective_hire_date)
    if first_date and today < first_date:
        payload.update({
            "first_payment_date": first_date.isoformat(),
            "message_code": "first_salary_after_full_month",
        })
    return JsonResponse(payload)


@csrf_exempt
def access_context(request):
    data, employee, error = _mobile_post(request)
    if error:
        return error
    return JsonResponse({"success": True, "access": mobile_access_context(employee)})


@csrf_exempt
def coordinated_teams(request):
    data, employee, error = _mobile_post(request)
    if error:
        return error
    access = mobile_access_context(employee)
    if not access["is_team_coordinator"]:
        return _error("TEAM_ROLE_REQUIRED", "Doar șefii de echipă și supervisorii pot accesa echipele coordonate.", 403)
    teams = list(_coordinated_teams(employee))
    return JsonResponse({
        "success": True,
        "teams": [_mobile_team_payload(team, employee) for team in teams],
        "access": access,
    })


def _attendance_notification_payload(recipient):
    alert = recipient.alert
    return {
        "id": 1000000 + recipient.pk,
        "type": "missing_attendance",
        "title": f"Angajați fără pontaj · {alert.team.name}",
        "message": ", ".join(alert.missing_employees.order_by("UserName").values_list("UserName", flat=True)),
        "team": {"id": alert.team_id, "name": alert.team.name},
        "worksite": alert.worksite,
        "date": alert.work_date.isoformat(),
        "is_read": recipient.read_at is not None,
        "created_at": recipient.created_at.isoformat(),
        "employees": [
            {"id": item.pk, "name": item.UserName, "trade": item.trade or ""}
            for item in alert.missing_employees.order_by("UserName")
        ],
    }


def _transfer_notification_payload(item):
    return {
        "id": 2000000 + item.pk,
        "type": "team_transfer_request",
        "title": f"Solicitare {item.get_request_type_display().lower()}",
        "message": f"{item.requester_team.name} solicită pe {item.employee.UserName} din {item.source_team.name}.",
        "team": {"id": item.source_team_id, "name": item.source_team.name},
        "worksite": item.source_team.default_worksite,
        "date": item.created_at.date().isoformat(),
        "is_read": item.seen_at is not None,
        "created_at": item.created_at.isoformat(),
        "employees": [{"id": item.employee_id, "name": item.employee.UserName, "trade": item.employee.trade or ""}],
    }


def _leave_mobile_notification_payload(item):
    return {
        "id": 3000000 + item.pk,
        "type": "leave_request",
        "title": "Cerere de concediu",
        "message": f"{item.employee.UserName}: {item.start_date.isoformat()} – {item.end_date.isoformat()} ({item.get_status_display()}).",
        "team": {"id": item.team_id, "name": item.team.name} if item.team_id else None,
        "worksite": item.team.default_worksite if item.team_id else "",
        "date": item.created_at.date().isoformat(),
        "is_read": item.seen_at is not None,
        "created_at": item.created_at.isoformat(),
        "employees": [{"id": item.employee_id, "name": item.employee.UserName, "trade": item.employee.trade or ""}],
    }


@csrf_exempt
def mobile_notifications(request):
    data, employee, error = _mobile_post(request)
    if error:
        return error
    recipients = TeamAttendanceAlertRecipient.objects.filter(employee=employee).select_related(
        "alert__team"
    ).prefetch_related("alert__missing_employees")
    team_ids = list(_coordinated_teams(employee).values_list("pk", flat=True))
    transfers = TemporaryWorkerRequest.objects.filter(source_team_id__in=team_ids).select_related(
        "source_team", "requester_team", "employee"
    )
    leaves = LeaveRequest.objects.filter(team_id__in=team_ids).filter(
        Q(team__supervisor=employee) | Q(team__supervisor__isnull=True, team__leader=employee)
    ).select_related("team", "employee")
    items = (
        [_attendance_notification_payload(item) for item in recipients]
        + [_transfer_notification_payload(item) for item in transfers]
        + [_leave_mobile_notification_payload(item) for item in leaves]
    )
    items.sort(key=lambda item: item["created_at"], reverse=True)
    return JsonResponse({
        "success": True,
        "notifications": items,
        "unread_count": sum(not item["is_read"] for item in items),
    })


@csrf_exempt
def mobile_notifications_read(request):
    data, employee, error = _mobile_post(request)
    if error:
        return error
    raw_ids = data.get("notification_ids")
    try:
        encoded_ids = [int(value) for value in raw_ids] if isinstance(raw_ids, list) else []
    except (TypeError, ValueError):
        return _error("INVALID_NOTIFICATION_IDS", "notification_ids trebuie să conțină doar ID-uri numerice.", 400)
    now = timezone.now()
    team_ids = list(_coordinated_teams(employee).values_list("pk", flat=True))
    attendance_ids = [value - 1000000 for value in encoded_ids if 1000000 <= value < 2000000]
    transfer_ids = [value - 2000000 for value in encoded_ids if 2000000 <= value < 3000000]
    leave_ids = [value - 3000000 for value in encoded_ids if value >= 3000000]
    if not isinstance(raw_ids, list):
        attendance_ids = list(TeamAttendanceAlertRecipient.objects.filter(employee=employee, read_at__isnull=True).values_list("pk", flat=True))
        transfer_ids = list(TemporaryWorkerRequest.objects.filter(source_team_id__in=team_ids, seen_at__isnull=True).values_list("pk", flat=True))
        leave_ids = list(LeaveRequest.objects.filter(team_id__in=team_ids, seen_at__isnull=True).filter(
            Q(team__supervisor=employee) | Q(team__supervisor__isnull=True, team__leader=employee)
        ).values_list("pk", flat=True))
    updated = TeamAttendanceAlertRecipient.objects.filter(employee=employee, pk__in=attendance_ids, read_at__isnull=True).update(read_at=now)
    updated += TemporaryWorkerRequest.objects.filter(source_team_id__in=team_ids, pk__in=transfer_ids, seen_at__isnull=True).update(seen_at=now)
    updated += LeaveRequest.objects.filter(team_id__in=team_ids, pk__in=leave_ids, seen_at__isnull=True).filter(
        Q(team__supervisor=employee) | Q(team__supervisor__isnull=True, team__leader=employee)
    ).update(seen_at=now)
    unread = mobile_access_context(employee)["unread_notifications"]
    return JsonResponse({"success": True, "updated": updated, "unread_count": unread})


@csrf_exempt
@transaction.atomic
def mobile_device_token(request):
    data, employee, error = _mobile_post(request)
    if error:
        return error
    token = str(data.get("push_token") or "").strip()
    if not token or len(token) > 512:
        return _error("INVALID_PUSH_TOKEN", "push_token este obligatoriu și trebuie să aibă maximum 512 caractere.", 400)
    device_key = str(data.get("device_key") or "").strip()
    MobileDevice.objects.filter(employee=employee, device_key=device_key).exclude(push_token=token).delete()
    device, _ = MobileDevice.objects.update_or_create(
        push_token=token,
        defaults={
            "employee": employee,
            "device_key": device_key,
            "platform": str(data.get("platform") or "android")[:20],
            "active": bool(data.get("active", True)),
            "invalidated_at": None,
        },
    )
    return JsonResponse({"success": True, "device_id": device.pk, "active": device.active})


@csrf_exempt
def leave_balance(request):
    data, employee, error = _mobile_post(request)
    if error:
        return error
    return JsonResponse({
        "success": True,
        "leave_balance": build_leave_summary(employee, localdate()),
    })


@csrf_exempt
def leave_request_create(request):
    data, employee, error = _mobile_post(request)
    if error:
        return error
    leave_type = str(data.get("leave_type") or "").strip()
    if leave_type not in LeaveRequest.LeaveType.values:
        return _error("INVALID_LEAVE_TYPE", "Tipul de concediu nu este valid.", 400)
    try:
        start_date = date.fromisoformat(str(data.get("start_date") or ""))
        end_date = date.fromisoformat(str(data.get("end_date") or ""))
    except ValueError:
        return _error("INVALID_DATE", "Datele trebuie trimise în format YYYY-MM-DD.", 400)
    reason = str(
        data.get("reason")
        or data.get("notes")
        or data.get("observations")
        or data.get("observatii")
        or ""
    ).strip()
    if len(reason) > 2000:
        return _error("REASON_TOO_LONG", "Motivul sau observațiile pot avea maximum 2000 de caractere.", 400)
    membership = (
        EmployeeTeamMember.objects.select_related("team__leader", "team__supervisor")
        .filter(employee=employee, active=True, team__active=True)
        .first()
    )
    team = membership.team if membership else EmployeeTeam.objects.select_related("leader", "supervisor").filter(
        leader=employee,
        active=True,
    ).first()
    if not team:
        return _error(
            "EMPLOYEE_WITHOUT_ACTIVE_TEAM",
            "Cererea nu poate fi trimisă deoarece angajatul nu aparține unei echipe active.",
            409,
        )
    item = LeaveRequest(
        employee=employee,
        team=team,
        assigned_leader=team.effective_supervisor,
        leave_type=leave_type,
        start_date=start_date,
        end_date=end_date,
        reason=reason,
    )
    try:
        item.save()
    except ValidationError as exc:
        message = "; ".join(exc.messages)
        code = "OVERLAPPING_LEAVE_REQUEST" if "suprapune" in message else "INVALID_DATE_RANGE"
        return _error(code, message, 400)
    send_leave_request_email(item)
    return JsonResponse({
        "success": True,
        "leave_request": serialize_leave_request(item),
        "leave_balance": build_leave_summary(employee, localdate()),
    }, status=201)


@csrf_exempt
def leave_request_list(request):
    data, employee, error = _mobile_post(request)
    if error:
        return error
    items = LeaveRequest.objects.filter(employee=employee)
    return JsonResponse({
        "success": True,
        "leave_requests": [serialize_leave_request(item) for item in items],
        "leave_balance": build_leave_summary(employee, localdate()),
    })


@csrf_exempt
def leave_request_cancel(request, request_id):
    return _mobile_portal_request(
        request,
        team_portal_views.portal_own_leave_cancel,
        method="POST",
        target_args=(request_id,),
    )


# Team Dashboard mobile facade -------------------------------------------------
#
# Every function below delegates to the web portal view after resolving the
# mobile identity.  Keeping these wrappers intentionally small prevents Android
# from acquiring a second set of business rules.


@csrf_exempt
def team_dashboard(request):
    return _mobile_portal_request(request, team_portal_views.portal_dashboard)


@csrf_exempt
def team_dashboard_led_teams(request):
    return _mobile_portal_request(request, team_portal_views.portal_teams)


@csrf_exempt
def team_dashboard_supervised_teams(request):
    return _mobile_portal_request(request, team_portal_views.portal_supervised_teams)


@csrf_exempt
def team_dashboard_personnel(request):
    return _mobile_portal_request(request, team_portal_views.portal_personnel)


@csrf_exempt
def team_dashboard_member_candidates(request, team_id):
    return _mobile_portal_request(
        request,
        team_portal_views.portal_member_candidates,
        query={"team_id": team_id},
    )


@csrf_exempt
def team_dashboard_transfer_requests(request):
    return _mobile_portal_request(
        request,
        team_portal_views.portal_transfer_requests,
        method="POST",
    )


@csrf_exempt
def team_dashboard_transfer_request_list(request):
    return _mobile_portal_request(request, team_portal_views.portal_transfer_requests)


@csrf_exempt
def team_dashboard_own_transfer_requests(request):
    return _mobile_portal_request(request, team_portal_views.portal_own_transfer_requests)


@csrf_exempt
def team_dashboard_transfer_decision(request, request_id):
    return _mobile_portal_request(
        request,
        team_portal_views.portal_transfer_decision,
        method="POST",
        target_args=(request_id,),
    )


@csrf_exempt
def team_dashboard_leave_requests(request):
    return _mobile_portal_request(
        request,
        team_portal_views.portal_own_leave_requests,
        method="POST",
    )


@csrf_exempt
def team_dashboard_leave_request_list(request):
    return _mobile_portal_request(request, team_portal_views.portal_own_leave_requests)


@csrf_exempt
def team_dashboard_request_summary(request):
    return _mobile_portal_request(request, team_portal_views.portal_supervisor_request_summary)


@csrf_exempt
def team_dashboard_leave_approvals(request):
    return _mobile_portal_request(request, team_portal_views.portal_supervisor_leave_requests)


@csrf_exempt
def team_dashboard_transfer_approvals(request):
    return _mobile_portal_request(request, team_portal_views.portal_supervisor_transfer_requests)


@csrf_exempt
def team_dashboard_leave_decision(request, request_id):
    return _mobile_portal_request(
        request,
        team_portal_views.portal_leave_decision,
        method="POST",
        target_args=(request_id,),
    )


@csrf_exempt
def team_dashboard_missing_today(request):
    return _mobile_portal_request(request, team_portal_views.portal_missing_today)


@csrf_exempt
def team_dashboard_absent_today(request):
    return _mobile_portal_request(request, team_portal_views.portal_absent_today)


@csrf_exempt
def team_dashboard_mark_absent(request, employee_id):
    return _mobile_portal_request(
        request,
        team_portal_views.portal_mark_absent,
        method="POST",
        target_args=(employee_id,),
    )


@csrf_exempt
def team_dashboard_notifications(request):
    return _mobile_portal_request(request, team_portal_views.portal_notifications)


@csrf_exempt
def team_dashboard_notifications_read(request):
    return _mobile_portal_request(
        request,
        team_portal_views.portal_notifications,
        method="POST",
    )


@csrf_exempt
def team_dashboard_worksites(request):
    return _mobile_portal_request(request, team_portal_views.portal_worksites)
