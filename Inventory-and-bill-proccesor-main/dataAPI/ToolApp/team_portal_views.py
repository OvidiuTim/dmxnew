import json
from datetime import date, time

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
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
    AttendanceAlertEscalationNotification,
    AttendanceSession,
    EmployeeTeam,
    EmployeeTeamMember,
    LeaveDay,
    LeaveRequest,
    PortalTeamTransferRequest,
    TeamPortalNotification,
    TeamAttendanceAlert,
    TeamAttendanceAlertRecipient,
    Users,
)
from ToolApp.module_access import app_user_has_module, app_user_roles
from ToolApp.leave_email import send_leave_approval_email, send_leave_request_email
from ToolApp.mobile_services import build_inventory, build_leave_summary, serialize_leave_request
from ToolApp.security import get_app_user_from_request
from ToolApp.team_attendance_notifications import (
    ALERT_HOUR,
    ALERT_MINUTE,
    _missing_members,
    ensure_team_attendance_alerts_due,
)
from ToolApp.team_organization_sync import sync_team_to_organization
from ToolApp.views import nfc_scan
from ToolApp.worksites import ACCEPTED_WORKSITES


def _error(message, status=400, details=None):
    payload = {"error": message}
    if details:
        payload["details"] = details
    return JsonResponse(payload, status=status)


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


def _led_teams(app_user):
    return EmployeeTeam.objects.filter(active=True, leader_id=app_user.employee_id).select_related(
        "leader", "supervisor"
    ).prefetch_related("memberships__employee")


def _supervised_teams(app_user):
    return EmployeeTeam.objects.filter(active=True, supervisor_id=app_user.employee_id).select_related(
        "leader", "supervisor"
    ).prefetch_related("memberships__employee")


def _is_supervisor(app_user):
    return _supervised_teams(app_user).exists()


def _account_for_employee(employee_id):
    return AppUser.objects.select_related("employee").filter(employee_id=employee_id, is_active=True).first()


def _create_request_notification(*, recipient, kind, request_id, leave=None, transfer=None, stage=""):
    if not recipient or not recipient.is_active:
        return None
    requester_id = leave.employee_id if leave else transfer.requested_by_id
    if leave:
        requester = _account_for_employee(requester_id)
        if requester and requester.pk == recipient.pk and kind == TeamPortalNotification.Kind.LEAVE_APPROVAL:
            return None
    elif transfer and requester_id == recipient.pk and kind == TeamPortalNotification.Kind.TRANSFER_APPROVAL:
        return None
    key = f"{kind}:{request_id}:{recipient.pk}:{stage or 'event'}"
    notification, _ = TeamPortalNotification.objects.get_or_create(
        dedupe_key=key,
        defaults={
            "recipient": recipient,
            "kind": kind,
            "leave_request": leave,
            "transfer_request": transfer,
        },
    )
    return notification


def _notify_leave_approver(item):
    supervisor = item.team.effective_supervisor if item.team_id else item.assigned_leader
    recipient = _account_for_employee(supervisor.pk) if supervisor else None
    return _create_request_notification(
        recipient=recipient,
        kind=TeamPortalNotification.Kind.LEAVE_APPROVAL,
        request_id=item.pk,
        leave=item,
        stage="approval",
    )


def _transfer_current_stage(item):
    if item.source_team_id and item.source_approval == item.ApprovalStatus.PENDING:
        return "source", item.source_team.effective_supervisor
    if (
        item.source_approval in {item.ApprovalStatus.APPROVED, item.ApprovalStatus.NOT_REQUIRED}
        and item.destination_approval == item.ApprovalStatus.PENDING
    ):
        return "destination", item.destination_team.effective_supervisor
    return "", None


def _notify_transfer_current_approver(item):
    stage, supervisor = _transfer_current_stage(item)
    recipient = _account_for_employee(supervisor.pk) if supervisor else None
    if not stage:
        return None
    return _create_request_notification(
        recipient=recipient,
        kind=TeamPortalNotification.Kind.TRANSFER_APPROVAL,
        request_id=item.pk,
        transfer=item,
        stage=stage,
    )


def _notify_request_result(item, kind):
    if isinstance(item, LeaveRequest):
        recipient = _account_for_employee(item.employee_id)
        return _create_request_notification(
            recipient=recipient,
            kind=kind,
            request_id=item.pk,
            leave=item,
            stage=item.status,
        )
    return _create_request_notification(
        recipient=item.requested_by,
        kind=kind,
        request_id=item.pk,
        transfer=item,
        stage=item.status,
    )


def _initial_alert_available(now=None):
    local_now = timezone.localtime(now or timezone.now())
    return local_now.time().replace(tzinfo=None) >= time(ALERT_HOUR, ALERT_MINUTE)


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
        "serie": employee.UserSerie,
        "company": employee.Company or "",
        "trade": employee.trade or "",
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
    levels = _escalation_levels(app_user)
    day = timezone.localdate()
    ensure_level2_auto_marks(day)
    ensure_team_attendance_alerts_due()
    own_reviewed = LeaveRequest.objects.filter(employee_id=app_user.employee_id).exclude(
        status=LeaveRequest.Status.PENDING
    ).filter(employee_seen_at__isnull=True).count()
    unread = _current_portal_unread_count(app_user)
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
        "initial_alert_time": f"{ALERT_HOUR:02d}:{ALERT_MINUTE:02d}",
        "initial_alert_available": _initial_alert_available(),
        "pending_requests_count": 0,
    }
    if "supervisor" in roles:
        supervised_ids = list(_supervised_teams(app_user).values_list("pk", flat=True))
        pending_transfers = PortalTeamTransferRequest.objects.select_related(
            "source_team__leader", "source_team__supervisor",
            "destination_team__leader", "destination_team__supervisor",
        ).filter(status=PortalTeamTransferRequest.Status.PENDING).filter(
            Q(source_team_id__in=supervised_ids) | Q(destination_team_id__in=supervised_ids)
        ).distinct()
        payload["pending_requests_count"] = (
            LeaveRequest.objects.filter(team_id__in=supervised_ids, status=LeaveRequest.Status.PENDING)
            .exclude(employee_id=app_user.employee_id)
            .count()
            + sum(bool(_transfer_payload(item, app_user)["can_approve"]) for item in pending_transfers)
        )
    payload["personal_notifications_count"] = own_reviewed
    if 1 in levels:
        available = _level_1_list_available()
        payload["missing_today_count"] = len(company_missing_employees(day)) if available else 0
        payload["missing_available_from"] = level_alert_time(AttendanceAlertCase.Level.LEVEL_1).strftime("%H:%M")
        payload["missing_before_alert_time"] = not available
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
    equipment, tools = build_inventory(employee)
    return JsonResponse({
        "employee": {"id": employee.pk, "name": employee.UserName},
        "total_salary_ron": str(employee.total_salary_ron or "0.00"),
        "salary_advance_ron": str(employee.salary_advance_ron or "0.00"),
        "salary_remainder_ron": str(employee.salary_remainder_ron or "0.00"),
        "meal_vouchers_ron": str(employee.meal_vouchers_ron or "0.00"),
        "leave_balance": build_leave_summary(employee, timezone.localdate()),
        "tools": tools,
        "equipment": equipment,
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
    teams = list(_led_teams(app_user))
    if not teams:
        return _error("Această pagină este disponibilă numai șefilor de echipă.", 403)
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
        "can_mark_absent": _initial_alert_available() and not absence_marking_locked(),
        "mark_available_from": f"{ALERT_HOUR:02d}:{ALERT_MINUTE:02d}",
    })


def _portal_team_payload(team, statuses):
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
    return {
        "id": team.pk,
        "name": team.name,
        "worksite": team.default_worksite or "",
        "leader": _employee_summary(team.leader, statuses.get(team.leader_id, "absent")),
        "members": members,
    }


@csrf_exempt
def portal_supervised_teams(request):
    if request.method != "GET":
        return _error("Metodă nepermisă.", 405)
    app_user = _portal_actor(request)
    if not app_user or not _is_supervisor(app_user):
        return _error("Această pagină este disponibilă numai supervisorilor.", 403)
    teams = list(_supervised_teams(app_user))
    employee_ids = {
        membership.employee_id
        for team in teams
        for membership in team.memberships.filter(active=True, employee__active=True)
    }
    employee_ids.update(team.leader_id for team in teams)
    statuses = _presence_status(employee_ids)
    return JsonResponse({
        "teams": [_portal_team_payload(team, statuses) for team in teams],
        "can_mark_absent": _initial_alert_available() and not absence_marking_locked(),
        "mark_available_from": f"{ALERT_HOUR:02d}:{ALERT_MINUTE:02d}",
        "locked": absence_marking_locked(),
        "lock_time": level_alert_time(AttendanceAlertCase.Level.LEVEL_2).strftime("%H:%M"),
    })


def _active_membership(employee_id):
    return EmployeeTeamMember.objects.select_related(
        "team", "team__leader", "team__supervisor"
    ).filter(
        employee_id=employee_id,
        active=True,
        team__active=True,
    ).first()


def _transfer_payload(item, app_user=None):
    source_supervisor_id = item.source_team.effective_supervisor.pk if item.source_team_id else None
    destination_supervisor_id = item.destination_team.effective_supervisor.pk
    can_decide_source = bool(
        app_user and source_supervisor_id == app_user.employee_id
        and item.source_approval == item.ApprovalStatus.PENDING
    )
    can_decide_destination = bool(
        app_user and destination_supervisor_id == app_user.employee_id
        and item.source_approval in {item.ApprovalStatus.APPROVED, item.ApprovalStatus.NOT_REQUIRED}
        and item.destination_approval == item.ApprovalStatus.PENDING
    )
    approvals_received = []
    approvals_missing = []
    if item.source_team_id:
        source_label = f"{item.source_team.name} · Supervisor"
        (approvals_received if item.source_approval == item.ApprovalStatus.APPROVED else approvals_missing).append(source_label)
    destination_label = f"{item.destination_team.name} · Supervisor"
    (approvals_received if item.destination_approval == item.ApprovalStatus.APPROVED else approvals_missing).append(destination_label)
    return {
        "id": item.pk,
        "employee": _employee_summary(item.employee, "absent"),
        "source_team": ({"id": item.source_team_id, "name": item.source_team.name} if item.source_team_id else None),
        "destination_team": {"id": item.destination_team_id, "name": item.destination_team.name},
        "requested_by": {
            "id": item.requested_by_id,
            "name": item.requested_by.employee.UserName,
        },
        "requester_role": item.requester_role,
        "reason": item.reason,
        "source_approval": item.source_approval,
        "destination_approval": item.destination_approval,
        "status": item.status,
        "status_label": item.get_status_display(),
        "created_at": item.created_at.isoformat(),
        "approvals_received": approvals_received,
        "approvals_missing": approvals_missing,
        "can_approve": item.status == item.Status.PENDING and (can_decide_source or can_decide_destination),
        "can_reject": item.status == item.Status.PENDING and (can_decide_source or can_decide_destination),
    }


def _execute_portal_transfer(item):
    if (
        item.source_approval != item.ApprovalStatus.APPROVED
        or item.destination_approval != item.ApprovalStatus.APPROVED
    ):
        return False
    memberships = list(
        EmployeeTeamMember.objects.select_for_update().filter(employee=item.employee)
    )
    for membership in memberships:
        if membership.active and membership.team_id != item.destination_team_id:
            membership.active = False
            membership.save(update_fields=("active",))
    target, _ = EmployeeTeamMember.objects.get_or_create(
        employee=item.employee,
        team=item.destination_team,
    )
    if not target.active:
        target.active = True
        target.save(update_fields=("active",))
    now = timezone.now()
    item.status = item.Status.APPROVED
    item.completed_at = now
    item.save(update_fields=("status", "completed_at", "updated_at"))
    PortalTeamTransferRequest.objects.filter(
        employee=item.employee,
        status=PortalTeamTransferRequest.Status.PENDING,
    ).exclude(pk=item.pk).update(status=PortalTeamTransferRequest.Status.CANCELLED, updated_at=now)
    if item.source_team_id:
        sync_team_to_organization(item.source_team)
    sync_team_to_organization(item.destination_team)
    return True


@csrf_exempt
def portal_personnel(request):
    if request.method != "GET":
        return _error("Metodă nepermisă.", 405)
    app_user = _portal_actor(request)
    if not app_user or not _is_supervisor(app_user):
        return _error("Această pagină este disponibilă numai supervisorilor.", 403)
    memberships = {
        row.employee_id: row.team
        for row in EmployeeTeamMember.objects.select_related("team").filter(active=True, team__active=True)
    }
    employees = Users.objects.filter(
        active=True,
        employment_status=Users.EmploymentStatus.ACTIVE,
        person_type=Users.PersonType.EMPLOYEE,
    ).order_by("UserName")
    statuses = _presence_status(list(employees.values_list("pk", flat=True)))
    rows = []
    for employee in employees:
        team = memberships.get(employee.pk)
        row = _employee_summary(employee, statuses.get(employee.pk, "absent"))
        row["team"] = ({"id": team.pk, "name": team.name} if team else None)
        rows.append(row)
    return JsonResponse({
        "employees": rows,
        "teams": [{"id": team.pk, "name": team.name} for team in _supervised_teams(app_user)],
    })


@csrf_exempt
def portal_member_candidates(request):
    if request.method != "GET":
        return _error("Metodă nepermisă.", 405)
    app_user = _portal_actor(request)
    if not app_user:
        return _error("Acces interzis.", 403)
    try:
        team_id = int(request.GET.get("team_id") or 0)
    except ValueError:
        return _error("Echipa este invalidă.")
    team = EmployeeTeam.objects.filter(pk=team_id, active=True).first()
    if not team or app_user.employee_id not in {team.leader_id, team.supervisor_id}:
        return _error("Poți adăuga membri numai în echipele coordonate.", 403)
    memberships = {
        row.employee_id: row.team
        for row in EmployeeTeamMember.objects.select_related("team").filter(active=True, team__active=True)
    }
    role_holder_ids = {
        employee_id
        for active_team in EmployeeTeam.objects.filter(active=True)
        for employee_id in (active_team.leader_id, active_team.supervisor_id)
        if employee_id
    }
    employees = Users.objects.filter(
        active=True,
        employment_status=Users.EmploymentStatus.ACTIVE,
        person_type=Users.PersonType.EMPLOYEE,
    ).exclude(pk__in=role_holder_ids).order_by("UserName")
    existing_ids = set(team.memberships.filter(active=True).values_list("employee_id", flat=True))
    return JsonResponse({
        "team": {"id": team.pk, "name": team.name},
        "employees": [
            {
                **_employee_summary(employee, "absent"),
                "team": ({"id": memberships[employee.pk].pk, "name": memberships[employee.pk].name} if employee.pk in memberships else None),
            }
            for employee in employees
            if employee.pk not in existing_ids
        ],
    })


@csrf_exempt
@transaction.atomic
def portal_transfer_requests(request):
    app_user = _portal_actor(request)
    if not app_user:
        return _error("Acces interzis.", 403)
    if request.method == "GET":
        if not _is_supervisor(app_user):
            return _error("Această pagină este disponibilă numai supervisorilor.", 403)
        supervised_ids = list(_supervised_teams(app_user).values_list("pk", flat=True))
        rows = PortalTeamTransferRequest.objects.select_related(
            "employee", "source_team__leader", "source_team__supervisor",
            "destination_team__leader", "destination_team__supervisor", "requested_by__employee",
        ).filter(
            Q(source_team_id__in=supervised_ids) | Q(destination_team_id__in=supervised_ids)
        ).distinct()
        return JsonResponse({"requests": [_transfer_payload(item, app_user) for item in rows]})
    if request.method != "POST":
        return _error("Metodă nepermisă.", 405)
    try:
        data = json.loads(request.body or "{}")
        employee_id = int(data.get("employee_id"))
        destination_team_id = int(data.get("destination_team_id"))
    except (TypeError, ValueError, json.JSONDecodeError):
        return _error("Angajatul și echipa destinație sunt obligatorii.")
    destination = EmployeeTeam.objects.select_related("leader", "supervisor").filter(
        pk=destination_team_id, active=True
    ).first()
    employee = Users.objects.select_for_update().filter(
        pk=employee_id,
        active=True,
        employment_status=Users.EmploymentStatus.ACTIVE,
        person_type=Users.PersonType.EMPLOYEE,
    ).first()
    if not destination or not employee:
        return _error("Angajatul sau echipa nu există ori este inactivă.", 404)
    is_destination_leader = destination.leader_id == app_user.employee_id
    is_destination_supervisor = destination.supervisor_id == app_user.employee_id
    if not is_destination_leader and not is_destination_supervisor:
        return _error("Poți solicita membri numai pentru o echipă pe care o coordonezi.", 403)
    if employee.pk in {
        value
        for team in EmployeeTeam.objects.filter(active=True)
        for value in (team.leader_id, team.supervisor_id)
        if value
    }:
        return _error("Un șef de echipă sau supervisor nu poate fi mutat ca membru.", 409)
    source_membership = _active_membership(employee.pk)
    source = source_membership.team if source_membership else None
    if source and source.pk == destination.pk:
        return _error("Angajatul face deja parte din această echipă.", 409)
    if not destination.supervisor_id:
        return _error(
            "Echipa destinație nu are un supervisor configurat pentru aprobare.",
            409,
        )
    if source and not source.supervisor_id:
        return _error(
            "Echipa sursă nu are un supervisor configurat pentru aprobare.",
            409,
        )
    if PortalTeamTransferRequest.objects.filter(
        employee=employee,
        status=PortalTeamTransferRequest.Status.PENDING,
    ).exists():
        return _error("Există deja un transfer activ pentru acest angajat.", 409)

    # Supervisorul poate aloca direct o persoană fără echipă.
    if not source and is_destination_supervisor:
        target, _ = EmployeeTeamMember.objects.get_or_create(team=destination, employee=employee)
        if not target.active:
            target.active = True
            target.save(update_fields=("active",))
        sync_team_to_organization(destination)
        return JsonResponse({"assigned": True, "employee_id": employee.pk, "team_id": destination.pk}, status=201)

    source_approval = PortalTeamTransferRequest.ApprovalStatus.NOT_REQUIRED
    if source:
        source_approval = (
            PortalTeamTransferRequest.ApprovalStatus.APPROVED
            if source.effective_supervisor.pk == app_user.employee_id
            else PortalTeamTransferRequest.ApprovalStatus.PENDING
        )
    destination_approval = (
        PortalTeamTransferRequest.ApprovalStatus.APPROVED
        if is_destination_supervisor
        else PortalTeamTransferRequest.ApprovalStatus.PENDING
    )
    if not source:
        source_approval = PortalTeamTransferRequest.ApprovalStatus.APPROVED
    try:
        item = PortalTeamTransferRequest.objects.create(
            employee=employee,
            source_team=source,
            destination_team=destination,
            requested_by=app_user,
            requester_role=(
                PortalTeamTransferRequest.RequesterRole.SUPERVISOR
                if is_destination_supervisor
                else PortalTeamTransferRequest.RequesterRole.TEAM_LEADER
            ),
            reason=str(data.get("reason") or "").strip()[:500],
            source_approval=source_approval,
            destination_approval=destination_approval,
            source_decided_by=(app_user if source_approval == PortalTeamTransferRequest.ApprovalStatus.APPROVED else None),
            destination_decided_by=(app_user if destination_approval == PortalTeamTransferRequest.ApprovalStatus.APPROVED else None),
            source_decided_at=(timezone.now() if source_approval == PortalTeamTransferRequest.ApprovalStatus.APPROVED else None),
            destination_decided_at=(timezone.now() if destination_approval == PortalTeamTransferRequest.ApprovalStatus.APPROVED else None),
        )
        transferred = _execute_portal_transfer(item)
        if not transferred:
            _notify_transfer_current_approver(item)
    except (ValidationError, IntegrityError) as exc:
        details = exc.message_dict if hasattr(exc, "message_dict") else {"non_field_errors": getattr(exc, "messages", [str(exc)])}
        return _error("Solicitarea nu a putut fi creată.", 409, details)
    return JsonResponse({"request": _transfer_payload(item, app_user), "transferred": transferred}, status=201)


@csrf_exempt
@transaction.atomic
def portal_transfer_decision(request, request_id):
    if request.method != "POST":
        return _error("Metodă nepermisă.", 405)
    app_user = _portal_actor(request)
    if not app_user or not _is_supervisor(app_user):
        return _error("Numai un supervisor poate soluționa transferul.", 403)
    try:
        data = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return _error("JSON invalid.")
    action = str(data.get("action") or "").strip().lower()
    if action not in {"approve", "reject"}:
        return _error("Acțiunea trebuie să fie approve sau reject.")
    item = PortalTeamTransferRequest.objects.select_for_update().select_related(
        "employee", "source_team__leader", "source_team__supervisor",
        "destination_team__leader", "destination_team__supervisor", "requested_by__employee",
    ).filter(pk=request_id).first()
    if not item:
        return _error("Solicitarea nu există.", 404)
    if item.status != item.Status.PENDING:
        return _error("Solicitarea a fost deja soluționată.", 409)
    now = timezone.now()
    controls_source = bool(item.source_team_id and item.source_team.effective_supervisor.pk == app_user.employee_id)
    controls_destination = item.destination_team.effective_supervisor.pk == app_user.employee_id
    pending_source = controls_source and item.source_approval == item.ApprovalStatus.PENDING
    pending_destination = (
        controls_destination
        and item.source_approval in {item.ApprovalStatus.APPROVED, item.ApprovalStatus.NOT_REQUIRED}
        and item.destination_approval == item.ApprovalStatus.PENDING
    )
    if not pending_source and not pending_destination:
        return _error("Nu poți soluționa această solicitare.", 403)
    decision = item.ApprovalStatus.APPROVED if action == "approve" else item.ApprovalStatus.REJECTED
    update_fields = []
    if pending_source:
        item.source_approval = decision
        item.source_decided_by = app_user
        item.source_decided_at = now
        update_fields.extend(("source_approval", "source_decided_by", "source_decided_at"))
    if pending_destination:
        item.destination_approval = decision
        item.destination_decided_by = app_user
        item.destination_decided_at = now
        update_fields.extend(("destination_approval", "destination_decided_by", "destination_decided_at"))
    if action == "reject":
        item.status = item.Status.REJECTED
        item.completed_at = now
        update_fields.extend(("status", "completed_at"))
    item.save(update_fields=tuple(dict.fromkeys(update_fields + ["updated_at"])))
    transferred = _execute_portal_transfer(item) if action == "approve" else False
    if action == "approve" and not transferred:
        _notify_transfer_current_approver(item)
    if item.status in {item.Status.APPROVED, item.Status.REJECTED}:
        _notify_request_result(item, TeamPortalNotification.Kind.TRANSFER_RESULT)
    TeamPortalNotification.objects.filter(
        recipient=app_user,
        transfer_request=item,
        kind=TeamPortalNotification.Kind.TRANSFER_APPROVAL,
        read_at__isnull=True,
    ).update(read_at=timezone.now())
    return JsonResponse({"request": _transfer_payload(item, app_user), "transferred": transferred})


def _own_leave_team(employee):
    membership = _active_membership(employee.pk)
    if membership:
        return membership.team
    return EmployeeTeam.objects.select_related("leader", "supervisor").filter(
        active=True,
    ).filter(Q(leader=employee) | Q(supervisor=employee)).first()


@csrf_exempt
@transaction.atomic
def portal_own_leave_requests(request):
    app_user = _portal_actor(request)
    if not app_user:
        return _error("Acces interzis.", 403)
    employee = app_user.employee
    if request.method == "GET":
        items = list(LeaveRequest.objects.filter(employee=employee).select_related("team"))
        LeaveRequest.objects.filter(
            employee=employee,
            employee_seen_at__isnull=True,
        ).exclude(status=LeaveRequest.Status.PENDING).update(employee_seen_at=timezone.now())
        return JsonResponse({
            "leave_requests": [serialize_leave_request(item) for item in items],
            "leave_balance": build_leave_summary(employee, timezone.localdate()),
        })
    if request.method != "POST":
        return _error("Metodă nepermisă.", 405)
    try:
        data = json.loads(request.body or "{}")
        start_date = date.fromisoformat(str(data.get("start_date") or ""))
        end_date = date.fromisoformat(str(data.get("end_date") or ""))
    except (ValueError, json.JSONDecodeError):
        return _error("Datele trebuie completate în format YYYY-MM-DD.")
    leave_type = str(data.get("leave_type") or LeaveRequest.LeaveType.PAID_LEAVE).strip()
    if leave_type not in LeaveRequest.LeaveType.values:
        return _error("Tipul concediului nu este valid.")
    team = _own_leave_team(employee)
    if not team:
        return _error("Cererea nu poate fi trimisă deoarece nu ești asociat unei echipe active.", 409)
    item = LeaveRequest(
        employee=employee,
        team=team,
        assigned_leader=team.effective_supervisor,
        leave_type=leave_type,
        start_date=start_date,
        end_date=end_date,
        reason=str(data.get("reason") or "").strip()[:2000],
    )
    try:
        item.save()
    except ValidationError as exc:
        details = exc.message_dict if hasattr(exc, "message_dict") else {"non_field_errors": exc.messages}
        return _error("Cererea nu a putut fi trimisă.", 400, details)
    _notify_leave_approver(item)
    send_leave_request_email(item)
    return JsonResponse({
        "leave_request": serialize_leave_request(item),
        "leave_balance": build_leave_summary(employee, timezone.localdate()),
    }, status=201)


def _supervisor_leave_payload(item, app_user):
    return {
        "id": item.pk,
        "kind": "leave",
        "employee": _employee_summary(item.employee, "leave"),
        "source_team": None,
        "destination_team": ({"id": item.team_id, "name": item.team.name} if item.team_id else None),
        "requested_by": {"id": item.employee_id, "name": item.employee.UserName},
        "leave_type": item.leave_type,
        "leave_type_label": item.get_leave_type_display(),
        "start_date": item.start_date.isoformat(),
        "end_date": item.end_date.isoformat(),
        "reason": item.reason,
        "status": item.status,
        "status_label": item.get_status_display(),
        "created_at": item.created_at.isoformat(),
        "days": (item.end_date - item.start_date).days + 1,
        "can_approve": item.status == item.Status.PENDING and item.employee_id != app_user.employee_id,
        "can_reject": item.status == item.Status.PENDING and item.employee_id != app_user.employee_id,
    }


@csrf_exempt
def portal_supervisor_requests(request):
    if request.method != "GET":
        return _error("Metodă nepermisă.", 405)
    app_user = _portal_actor(request)
    if not app_user or not _is_supervisor(app_user):
        return _error("Această pagină este disponibilă numai supervisorilor.", 403)
    supervised_ids = list(_supervised_teams(app_user).values_list("pk", flat=True))
    leaves = LeaveRequest.objects.select_related("employee", "team").filter(team_id__in=supervised_ids)
    transfers = PortalTeamTransferRequest.objects.select_related(
        "employee", "source_team__leader", "source_team__supervisor",
        "destination_team__leader", "destination_team__supervisor", "requested_by__employee",
    ).filter(Q(source_team_id__in=supervised_ids) | Q(destination_team_id__in=supervised_ids)).distinct()
    rows = (
        [_supervisor_leave_payload(item, app_user) for item in leaves]
        + [{"kind": "transfer", **_transfer_payload(item, app_user)} for item in transfers]
    )
    rows.sort(key=lambda item: item["created_at"], reverse=True)
    return JsonResponse({"requests": rows})


@csrf_exempt
def portal_supervisor_request_summary(request):
    if request.method != "GET":
        return _error("Metodă nepermisă.", 405)
    app_user = _portal_actor(request)
    if not app_user or not _is_supervisor(app_user):
        return _error("Această pagină este disponibilă numai supervisorilor.", 403)
    supervised_ids = list(_supervised_teams(app_user).values_list("pk", flat=True))
    leave_count = LeaveRequest.objects.filter(
        team_id__in=supervised_ids,
        status=LeaveRequest.Status.PENDING,
    ).exclude(employee_id=app_user.employee_id).count()
    transfer_items = PortalTeamTransferRequest.objects.select_related(
        "source_team__leader", "source_team__supervisor",
        "destination_team__leader", "destination_team__supervisor",
    ).filter(
        status=PortalTeamTransferRequest.Status.PENDING,
    ).filter(Q(source_team_id__in=supervised_ids) | Q(destination_team_id__in=supervised_ids)).distinct()
    transfer_count = sum(bool(_transfer_payload(item, app_user)["can_approve"]) for item in transfer_items)
    return JsonResponse({
        "leave_pending_count": leave_count,
        "transfer_pending_count": transfer_count,
        "pending_count": leave_count + transfer_count,
    })


@csrf_exempt
def portal_supervisor_leave_requests(request):
    if request.method != "GET":
        return _error("Metodă nepermisă.", 405)
    app_user = _portal_actor(request)
    if not app_user or not _is_supervisor(app_user):
        return _error("Această pagină este disponibilă numai supervisorilor.", 403)
    supervised_ids = list(_supervised_teams(app_user).values_list("pk", flat=True))
    items = LeaveRequest.objects.select_related("employee", "team").filter(
        team_id__in=supervised_ids,
    ).order_by("-created_at")
    return JsonResponse({"requests": [_supervisor_leave_payload(item, app_user) for item in items]})


@csrf_exempt
def portal_supervisor_transfer_requests(request):
    if request.method != "GET":
        return _error("Metodă nepermisă.", 405)
    app_user = _portal_actor(request)
    if not app_user or not _is_supervisor(app_user):
        return _error("Această pagină este disponibilă numai supervisorilor.", 403)
    supervised_ids = list(_supervised_teams(app_user).values_list("pk", flat=True))
    items = PortalTeamTransferRequest.objects.select_related(
        "employee", "source_team__leader", "source_team__supervisor",
        "destination_team__leader", "destination_team__supervisor", "requested_by__employee",
    ).filter(
        Q(source_team_id__in=supervised_ids) | Q(destination_team_id__in=supervised_ids)
    ).distinct().order_by("-created_at")
    return JsonResponse({"requests": [_transfer_payload(item, app_user) for item in items]})


@csrf_exempt
@transaction.atomic
def portal_leave_decision(request, request_id):
    if request.method != "POST":
        return _error("Metodă nepermisă.", 405)
    app_user = _portal_actor(request)
    if not app_user or not _is_supervisor(app_user):
        return _error("Numai un supervisor poate soluționa concediul.", 403)
    try:
        data = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return _error("JSON invalid.")
    action = str(data.get("action") or "").strip().lower()
    if action not in {"approve", "reject"}:
        return _error("Acțiunea trebuie să fie approve sau reject.")
    supervised_ids = list(_supervised_teams(app_user).values_list("pk", flat=True))
    item = LeaveRequest.objects.select_for_update().select_related("employee", "team").filter(
        pk=request_id,
        team_id__in=supervised_ids,
    ).first()
    if not item:
        return _error("Cererea nu există sau nu aparține echipelor supervizate.", 404)
    if item.employee_id == app_user.employee_id:
        return _error("Nu îți poți aproba sau respinge propria cerere.", 403)
    if item.status != item.Status.PENDING:
        return _error("Cererea a fost deja soluționată.", 409)
    now = timezone.now()
    item.status = item.Status.APPROVED if action == "approve" else item.Status.REJECTED
    item.reviewed_at = now
    item.approved_at = now if action == "approve" else None
    item.reviewed_by_app_user = app_user
    item.employee_seen_at = None
    try:
        item.save()
    except ValidationError as exc:
        details = exc.message_dict if hasattr(exc, "message_dict") else {"non_field_errors": exc.messages}
        return _error("Cererea nu a putut fi soluționată.", 400, details)
    if action == "approve":
        send_leave_approval_email(item, app_user.employee.UserName)
    _notify_request_result(item, TeamPortalNotification.Kind.LEAVE_RESULT)
    TeamPortalNotification.objects.filter(
        recipient=app_user,
        leave_request=item,
        kind=TeamPortalNotification.Kind.LEAVE_APPROVAL,
        read_at__isnull=True,
    ).update(read_at=timezone.now())
    return JsonResponse({"request": _supervisor_leave_payload(item, app_user)})


def _sync_global_alert_recipients(app_user, day=None):
    """Nivel 1/Nivel 2 primesc în aplicație alertele tuturor echipelor, nu doar ale lor.

    Constrângerea unică (alertă, angajat) previne dublurile la reapelare.
    """
    day = day or timezone.localdate()
    for alert in TeamAttendanceAlert.objects.filter(work_date=day):
        TeamAttendanceAlertRecipient.objects.get_or_create(alert=alert, employee_id=app_user.employee_id)


def _notification_query(app_user):
    # Notificările inițiale de la 07:40 rămân strict în echipele coordonate.
    # Rolurile Nivel 1/Nivel 2 sunt adăugate separat, la pragurile lor, astfel
    # încât un utilizator cu roluri combinate să nu își piardă drepturile de bază.
    return TeamAttendanceAlertRecipient.objects.filter(
        employee_id=app_user.employee_id,
        alert__team__in=_coordinated_teams(app_user),
    ).distinct()


def _level_1_list_available(now=None):
    """Lista „Vezi nepontați” devine vizibilă abia la ora configurată pentru Nivel 1."""
    local_now = timezone.localtime(now or timezone.now())
    return local_now.time().replace(tzinfo=None) >= level_alert_time(AttendanceAlertCase.Level.LEVEL_1)


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
        "can_mark_absent": bool(can_mark),
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
        elif mark.source == AttendanceAbsenceMark.Source.SUPERVISOR:
            category = AttendanceAlertCase.EscalationSource.MARKED_BY_SUPERVISOR
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


def _global_notification_payloads(app_user, day=None):
    """Notificările globale respectă ora fiecărui nivel, nu ora alertei inițiale.

    Nivelul 1 vede nepontații numai după ora sa configurată (implicit 07:55).
    Nivelul 2 vede înainte de ora sa doar cazurile escaladate printr-o marcare
    manuală; nepontații obișnuiți apar abia după ora Nivelului 2 (implicit 08:10).
    """
    day = day or timezone.localdate()
    levels = _escalation_levels(app_user)
    items = []

    def build_item(level, rows):
        if not rows:
            return None
        notification, _ = AttendanceAlertEscalationNotification.objects.get_or_create(
            recipient=app_user,
            work_date=day,
            level=level,
            defaults={"case_count": len(rows)},
        )
        previous_count = notification.case_count
        if previous_count != len(rows):
            notification.case_count = len(rows)
            update_fields = ["case_count"]
            if len(rows) > previous_count and notification.read_at is not None:
                notification.read_at = None
                update_fields.append("read_at")
            notification.save(update_fields=update_fields)
        return {
            "id": notification.pk,
            "kind": "escalation",
            "level": level,
            "team": {"id": None, "name": f"Nivel {level} · Toată compania"},
            "status": "absent",
            "date": day.isoformat(),
            "checked_at": notification.created_at.isoformat(),
            "is_read": notification.read_at is not None,
            "employees": [
                {
                    "id": row["id"],
                    "name": row["name"],
                    "phone": row.get("phone", ""),
                }
                for row in rows
            ],
        }

    if AttendanceAlertCase.Level.LEVEL_1 in levels and _level_1_list_available():
        level_1_rows = [
            _missing_row(employee, team, False)
            for employee, team in company_missing_employees(day)
        ]
        item = build_item(AttendanceAlertCase.Level.LEVEL_1, level_1_rows)
        if item:
            items.append(item)

    if AttendanceAlertCase.Level.LEVEL_2 in levels:
        # _absent_today_rows păstrează intenționat logica paginii „Lipsă azi”:
        # înainte de 08:10 conține numai marcările manuale, iar după prag toate
        # cazurile Nivelului 2.
        if absence_marking_locked():
            ensure_level2_auto_marks(day)
        level_2_rows = _absent_today_rows(day)
        item = build_item(AttendanceAlertCase.Level.LEVEL_2, level_2_rows)
        if item:
            items.append(item)

    return items


@csrf_exempt
def portal_missing_today(request):
    """Vezi nepontați · Nivel 1: toți angajații companiei fără check-in astăzi."""
    if request.method != "GET":
        return _error("Metodă nepermisă.", 405)
    app_user = _portal_actor(request)
    if not app_user:
        return _error("Acces interzis.", 403)
    levels = _escalation_levels(app_user)
    if not levels.intersection({1, 2}):
        return _error("Această listă este disponibilă doar pentru Nivel 1 și Nivel 2.", 403)
    day = timezone.localdate()
    available_from = level_alert_time(AttendanceAlertCase.Level.LEVEL_1).strftime("%H:%M")
    if not _level_1_list_available():
        # Înainte de ora Nivelului 1 nimeni nu este considerat lipsă: angajații
        # au încă timp să se ponteze, deci lista rămâne goală.
        return JsonResponse({
            "date": day.isoformat(),
            "locked": False,
            "lock_time": level_alert_time(AttendanceAlertCase.Level.LEVEL_2).strftime("%H:%M"),
            "available_from": available_from,
            "before_alert_time": True,
            "employees": [],
            "count": 0,
        })
    ensure_team_attendance_alerts_due()
    refresh_resolutions(day)
    locked = absence_marking_locked()
    rows_by_employee = {
        employee.pk: _missing_row(employee, team, not locked)
        for employee, team in company_missing_employees(day)
    }
    # Păstrăm marcările Nivelului 1 în listă după refresh, astfel încât acțiunea
    # să rămână vizibilă și auditabilă fără să repoziționăm utilizatorul.
    marks = AttendanceAbsenceMark.objects.filter(
        work_date=day,
    ).filter(
        Q(source=AttendanceAbsenceMark.Source.LEVEL_1) | Q(marked_by=app_user)
    ).select_related("employee", "team", "team__leader", "marked_by", "marked_by__employee")
    for mark in marks:
        actor_name = mark.marked_by.employee.UserName if mark.marked_by_id else "Nivel 1"
        rows_by_employee[mark.employee_id] = {
            **_missing_row(mark.employee, mark.team, False),
            "status": "marked_absent",
            "marked_by": actor_name,
            "marked_at": timezone.localtime(mark.marked_at).isoformat(),
            "source": mark.source,
        }
    rows = sorted(rows_by_employee.values(), key=lambda item: item["name"].casefold())
    return JsonResponse({
        "date": day.isoformat(),
        "locked": locked,
        "lock_time": level_alert_time(AttendanceAlertCase.Level.LEVEL_2).strftime("%H:%M"),
        "available_from": available_from,
        "before_alert_time": False,
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
    current_missing = _missing_members(alert.team, alert.work_date)
    return {
        "id": recipient.pk,
        "kind": "team",
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
            for employee in current_missing
        ],
    }


def _team_notification_payloads(app_user):
    if not _coordinated_teams(app_user).exists():
        return []
    query = _notification_query(app_user).select_related("alert__team")
    return [
        payload
        for item in query.order_by("-alert__created_at")
        if (payload := _notification_payload(item))["employees"]
    ]


def _personal_notification_payloads(app_user):
    return [
        {
            "id": item.pk,
            "kind": "personal_leave",
            "team": {"id": item.team_id, "name": "Cerere concediu"},
            "status": item.status,
            "status_label": item.get_status_display(),
            "leave_type": item.leave_type,
            "start_date": item.start_date.isoformat(),
            "end_date": item.end_date.isoformat(),
            "date": item.created_at.date().isoformat(),
            "checked_at": (item.reviewed_at or item.created_at).isoformat(),
            "is_read": item.employee_seen_at is not None,
            "employees": [{
                "id": app_user.employee_id,
                "name": app_user.employee.UserName,
                "phone": "",
            }],
        }
        for item in LeaveRequest.objects.filter(employee_id=app_user.employee_id)
        .exclude(
            portal_notifications__recipient=app_user,
            portal_notifications__kind=TeamPortalNotification.Kind.LEAVE_RESULT,
        )
        .exclude(status=LeaveRequest.Status.PENDING)
        .order_by("-reviewed_at", "-created_at")
    ]


def _pending_approval_payloads(app_user):
    """Cererile la care utilizatorul curent nu a răspuns încă.

    Se construiesc direct din cereri, nu din notificările salvate: o cerere
    creată pe alt drum (aplicația mobilă, zona de administrare) sau înainte de
    introducerea notificărilor trebuie să apară totuși aici. Rămân marcate
    urgent până sunt soluționate.
    """
    supervised_ids = list(_supervised_teams(app_user).values_list("pk", flat=True))
    if not supervised_ids:
        return []
    payloads = []
    leaves = LeaveRequest.objects.select_related("employee", "team").filter(
        team_id__in=supervised_ids,
        status=LeaveRequest.Status.PENDING,
    ).exclude(employee_id=app_user.employee_id).order_by("-created_at")
    for item in leaves:
        payloads.append({
            "id": item.pk,
            "kind": TeamPortalNotification.Kind.LEAVE_APPROVAL,
            "request_kind": "leave",
            "request_id": item.pk,
            "urgent": True,
            "team": {"id": item.team_id, "name": item.team.name if item.team_id else ""},
            "status": item.status,
            "status_label": item.get_status_display(),
            "leave_type": item.leave_type,
            "leave_type_label": item.get_leave_type_display(),
            "start_date": item.start_date.isoformat(),
            "end_date": item.end_date.isoformat(),
            "date": item.created_at.date().isoformat(),
            "checked_at": item.created_at.isoformat(),
            "is_read": False,
            "target_path": f"/team-dashboard/cereri-concediu?request={item.pk}",
            "employees": [{
                "id": item.employee_id,
                "name": item.employee.UserName,
                "phone": item.employee.phone_number or "",
            }],
        })
    transfers = PortalTeamTransferRequest.objects.select_related(
        "employee", "source_team__leader", "source_team__supervisor",
        "destination_team__leader", "destination_team__supervisor", "requested_by__employee",
    ).filter(status=PortalTeamTransferRequest.Status.PENDING).filter(
        Q(source_team_id__in=supervised_ids) | Q(destination_team_id__in=supervised_ids)
    ).distinct().order_by("-created_at")
    for item in transfers:
        # Aceeași regulă ca pe pagina „Cereri de transfer”: contează doar
        # etapa de aprobare care îi revine acum utilizatorului.
        if not _transfer_payload(item, app_user).get("can_approve"):
            continue
        payloads.append({
            "id": item.pk,
            "kind": TeamPortalNotification.Kind.TRANSFER_APPROVAL,
            "request_kind": "transfer",
            "request_id": item.pk,
            "urgent": True,
            "team": {"id": item.destination_team_id, "name": item.destination_team.name},
            "status": item.status,
            "status_label": item.get_status_display(),
            "date": item.created_at.date().isoformat(),
            "checked_at": item.created_at.isoformat(),
            "is_read": False,
            "target_path": f"/team-dashboard/cereri-transfer?request={item.pk}",
            "employees": [{
                "id": item.employee_id,
                "name": item.employee.UserName,
                "phone": item.employee.phone_number or "",
            }],
        })
    return payloads


def _request_notification_payloads(app_user):
    items = TeamPortalNotification.objects.select_related(
        "leave_request__employee", "leave_request__team",
        "transfer_request__employee", "transfer_request__source_team",
        "transfer_request__destination_team", "transfer_request__requested_by__employee",
    ).filter(recipient=app_user)
    payloads = []
    for item in items:
        if item.leave_request_id:
            request_item = item.leave_request
            is_result = item.kind == TeamPortalNotification.Kind.LEAVE_RESULT
            # O cerere de aprobat rămâne vizibilă până este soluționată, chiar
            # dacă a fost deschisă; un rezultat dispare după ce a fost văzut.
            # Aprobările sunt construite din cereri în _pending_approval_payloads.
            if not is_result:
                continue
            if item.read_at:
                continue
            target_path = (
                "/team-dashboard/cerere-concediu"
                if is_result
                else f"/team-dashboard/cereri-concediu?request={request_item.pk}"
            )
            payloads.append({
                "id": item.pk,
                "kind": item.kind,
                "request_kind": "leave",
                "request_id": request_item.pk,
                "team": {"id": request_item.team_id, "name": request_item.team.name if request_item.team_id else ""},
                "status": request_item.status,
                "status_label": request_item.get_status_display(),
                "leave_type": request_item.leave_type,
                "leave_type_label": request_item.get_leave_type_display(),
                "start_date": request_item.start_date.isoformat(),
                "end_date": request_item.end_date.isoformat(),
                "date": item.created_at.date().isoformat(),
                "checked_at": item.created_at.isoformat(),
                "is_read": item.read_at is not None,
                "target_path": target_path,
                "employees": [{
                    "id": request_item.employee_id,
                    "name": request_item.employee.UserName,
                    "phone": request_item.employee.phone_number or "",
                }],
            })
            continue
        request_item = item.transfer_request
        is_approval = item.kind == TeamPortalNotification.Kind.TRANSFER_APPROVAL
        if is_approval:
            continue
        if item.read_at:
            continue
        target_path = (
            f"/team-dashboard/cereri-transfer?request={request_item.pk}"
            if is_approval
            else "/team-dashboard/cereri"
        )
        payloads.append({
            "id": item.pk,
            "kind": item.kind,
            "request_kind": "transfer",
            "request_id": request_item.pk,
            "team": {"id": request_item.destination_team_id, "name": request_item.destination_team.name},
            "status": request_item.status,
            "status_label": request_item.get_status_display(),
            "date": item.created_at.date().isoformat(),
            "checked_at": item.created_at.isoformat(),
            "is_read": item.read_at is not None,
            "target_path": target_path,
            "employees": [{
                "id": request_item.employee_id,
                "name": request_item.employee.UserName,
                "phone": request_item.employee.phone_number or "",
            }],
        })
    return payloads


def _open_request_notifications(app_user):
    """Notificările de cereri care mai au sens: aprobări încă în așteptare și rezultate."""
    return TeamPortalNotification.objects.filter(recipient=app_user).exclude(
        Q(kind=TeamPortalNotification.Kind.LEAVE_APPROVAL)
        & ~Q(leave_request__status=LeaveRequest.Status.PENDING)
    ).exclude(
        Q(kind=TeamPortalNotification.Kind.TRANSFER_APPROVAL)
        & ~Q(transfer_request__status=PortalTeamTransferRequest.Status.PENDING)
    )


def _mark_notifications_seen(app_user, attendance_items, personal_items, result_ids):
    """Stinge notificările pur informative imediat ce au fost afișate o dată.

    Alertele de absență și rezultatele cererilor dispar după ce au fost văzute;
    cererile de aprobat rămân, fiindcă ele dispar abia când sunt soluționate.
    """
    now = timezone.now()
    team_ids = [item["id"] for item in attendance_items if item["kind"] == "team"]
    if team_ids:
        _notification_query(app_user).filter(pk__in=team_ids, read_at__isnull=True).update(read_at=now)
    escalation_ids = [item["id"] for item in attendance_items if item["kind"] == "escalation"]
    if escalation_ids:
        AttendanceAlertEscalationNotification.objects.filter(
            recipient=app_user, pk__in=escalation_ids, read_at__isnull=True
        ).update(read_at=now)
    personal_ids = [item["id"] for item in personal_items]
    if personal_ids:
        LeaveRequest.objects.filter(
            employee_id=app_user.employee_id, pk__in=personal_ids, employee_seen_at__isnull=True
        ).update(employee_seen_at=now)
    if result_ids:
        TeamPortalNotification.objects.filter(
            recipient=app_user, pk__in=result_ids, read_at__isnull=True
        ).update(read_at=now)


def _current_portal_unread_count(app_user):
    personal = LeaveRequest.objects.filter(
        employee_id=app_user.employee_id,
        employee_seen_at__isnull=True,
    ).exclude(
        portal_notifications__recipient=app_user,
        portal_notifications__kind=TeamPortalNotification.Kind.LEAVE_RESULT,
    ).exclude(status=LeaveRequest.Status.PENDING).count()
    items = _team_notification_payloads(app_user)
    if _escalation_levels(app_user):
        items += _global_notification_payloads(app_user)
    attendance = sum(not item["is_read"] for item in items)
    pending_approvals = len(_pending_approval_payloads(app_user))
    results = TeamPortalNotification.objects.filter(
        recipient=app_user,
        read_at__isnull=True,
        kind__in=(
            TeamPortalNotification.Kind.LEAVE_RESULT,
            TeamPortalNotification.Kind.TRANSFER_RESULT,
        ),
    ).count()
    return personal + attendance + pending_approvals + results


@csrf_exempt
def portal_notification_summary(request):
    if request.method != "GET":
        return _error("Metodă nepermisă.", 405)
    app_user = _portal_actor(request)
    if not app_user:
        return _error("Acces interzis.", 403)
    return JsonResponse({"unread_count": _current_portal_unread_count(app_user)})


@csrf_exempt
def portal_notifications(request):
    app_user = _portal_actor(request)
    if not app_user:
        return _error("Acces interzis.", 403)
    levels = _escalation_levels(app_user)
    if request.method == "GET":
        ensure_team_attendance_alerts_due()
        attendance_items = _team_notification_payloads(app_user)
        if levels:
            attendance_items += _global_notification_payloads(app_user)
        # Absențele deja văzute nu se mai afișează.
        attendance_items = [item for item in attendance_items if not item["is_read"]]
        personal_items = [item for item in _personal_notification_payloads(app_user) if not item["is_read"]]
        request_items = _pending_approval_payloads(app_user) + _request_notification_payloads(app_user)
        result_ids = [
            item["id"]
            for item in request_items
            if item["kind"] in (
                TeamPortalNotification.Kind.LEAVE_RESULT,
                TeamPortalNotification.Kind.TRANSFER_RESULT,
            )
        ]
        items = attendance_items + personal_items + request_items
        items.sort(key=lambda item: item["checked_at"], reverse=True)
        _mark_notifications_seen(app_user, attendance_items, personal_items, result_ids)
        return JsonResponse({
            "notifications": items,
            "unread_count": _current_portal_unread_count(app_user),
        })
    if request.method != "POST":
        return _error("Metodă nepermisă.", 405)
    try:
        data = json.loads(request.body or "{}")
        raw_ids = data.get("notification_ids", [])
        notification_ids = [int(value) for value in raw_ids]
    except (TypeError, ValueError, json.JSONDecodeError):
        return _error("Lista notificărilor este invalidă.")
    notification_kind = data.get("notification_kind")
    if notification_kind in set(TeamPortalNotification.Kind.values) | {"request"}:
        query = TeamPortalNotification.objects.filter(
            recipient=app_user,
            pk__in=notification_ids,
            read_at__isnull=True,
        )
        if notification_kind != "request":
            query = query.filter(kind=notification_kind)
        updated = query.update(read_at=timezone.now())
        return JsonResponse({"updated": updated, "unread_count": _current_portal_unread_count(app_user)})
    if notification_kind == "personal_leave":
        updated = LeaveRequest.objects.filter(
            employee_id=app_user.employee_id,
            pk__in=notification_ids,
            employee_seen_at__isnull=True,
        ).exclude(status=LeaveRequest.Status.PENDING).update(employee_seen_at=timezone.now())
        return JsonResponse({"updated": updated, "unread_count": _current_portal_unread_count(app_user)})
    if notification_kind == "escalation":
        updated = AttendanceAlertEscalationNotification.objects.filter(
            recipient=app_user,
            pk__in=notification_ids,
            read_at__isnull=True,
        ).update(read_at=timezone.now())
        unread_count = _current_portal_unread_count(app_user)
        return JsonResponse({"updated": updated, "unread_count": unread_count})
    query = _notification_query(app_user)
    updated = query.filter(pk__in=notification_ids, read_at__isnull=True).update(read_at=timezone.now())
    return JsonResponse({
        "updated": updated,
        "unread_count": _current_portal_unread_count(app_user),
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
    try:
        request_data = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        request_data = {}
    requested_context = str(request_data.get("actor_context") or "").strip().lower()
    team = _coordinated_teams(app_user).filter(
        memberships__employee_id=employee_id,
        memberships__active=True,
    ).distinct().first()
    if not team and not is_level_1:
        return _error("Poți marca absent doar un membru al echipei coordonate.", 403)
    if team and not _initial_alert_available():
        return _error(
            f"Marcarea ca absent devine disponibilă după ora {ALERT_HOUR:02d}:{ALERT_MINUTE:02d}.",
            409,
        )
    if not team and is_level_1 and not _level_1_list_available():
        return _error(
            "Marcarea ca absent nu este disponibilă înainte de ora Nivelului 1.",
            409,
        )
    if is_level_1 and requested_context == "level_1":
        source = AttendanceAbsenceMark.Source.LEVEL_1
    elif team and team.leader_id == app_user.employee_id:
        source = AttendanceAbsenceMark.Source.TEAM_LEADER
    elif team and team.supervisor_id == app_user.employee_id:
        source = AttendanceAbsenceMark.Source.SUPERVISOR
    else:
        source = AttendanceAbsenceMark.Source.LEVEL_1
    if not team:
        # Nivel 1 marchează pe toată compania: echipa se ia de la angajat.
        team = team_by_employee([employee_id]).get(int(employee_id))
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
