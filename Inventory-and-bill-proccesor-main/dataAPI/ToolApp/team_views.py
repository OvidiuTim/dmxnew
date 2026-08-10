import json
from datetime import date

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

from ToolApp.models import (
    AppPagePermission,
    AttendanceSession,
    EmployeeTeam,
    EmployeeTeamMember,
    LeaveDay,
    TemporaryWorkerRequest,
    Users,
)
from ToolApp.security import get_app_user_from_request, request_has_admin
from ToolApp.team_serializers import (
    TeamMembersSerializer,
    TeamWriteSerializer,
    TemporaryWorkerRequestActionSerializer,
    TemporaryWorkerRequestWriteSerializer,
)


TEAM_MANAGEMENT_ROUTE = "/pontaj/echipe"


def _json_body(request):
    try:
        return json.loads(request.body or "{}")
    except (TypeError, ValueError):
        return None


def _error(message, status=400, details=None):
    payload = {"error": message}
    if details:
        payload["details"] = details
    return JsonResponse(payload, status=status)


def _validation_details(exc):
    if hasattr(exc, "message_dict"):
        return exc.message_dict
    return {"non_field_errors": getattr(exc, "messages", [str(exc)])}


def _actor(request):
    if getattr(request, "dmx_role", None) == "admin" or request_has_admin(request):
        return None, True
    app_user = getattr(request, "app_user", None) or get_app_user_from_request(request)
    if not app_user:
        return None, False
    is_manager = AppPagePermission.objects.filter(
        app_user=app_user,
        route=TEAM_MANAGEMENT_ROUTE,
        can_access=True,
    ).exists()
    return app_user, is_manager


def _is_leader(app_user, team):
    return bool(app_user and app_user.employee_id == team.leader_id and team.active)


def _employee_payload(employee, team=None):
    return {
        "id": employee.UserId,
        "name": employee.UserName,
        "serie": employee.UserSerie,
        "company": employee.Company or "",
        "trade": employee.trade or "",
        "active": employee.active,
        "team": {"id": team.pk, "name": team.name} if team else None,
    }


def _team_payload(team, app_user=None, can_manage_all=False):
    memberships = list(
        team.memberships.filter(active=True)
        .select_related("employee")
        .order_by("employee__UserName")
    )
    members = []
    seen = set()
    for membership in memberships:
        if membership.employee_id in seen:
            continue
        seen.add(membership.employee_id)
        members.append(_employee_payload(membership.employee, team))
    if team.leader_id not in seen:
        members.insert(0, _employee_payload(team.leader, team))
    return {
        "id": team.pk,
        "name": team.name,
        "active": team.active,
        "default_worksite": team.default_worksite,
        "leader": _employee_payload(team.leader, team),
        "members": members,
        "member_ids": [item["id"] for item in members],
        "can_edit": can_manage_all or _is_leader(app_user, team),
        "can_manage_settings": can_manage_all,
    }


def _teams_queryset():
    return EmployeeTeam.objects.select_related("leader").prefetch_related("memberships__employee")


def _expire_requests():
    TemporaryWorkerRequest.objects.filter(
        status=TemporaryWorkerRequest.Status.PENDING,
        end_date__lt=timezone.localdate(),
    ).update(status=TemporaryWorkerRequest.Status.EXPIRED, updated_at=timezone.now())


def _parse_date(value):
    try:
        return date.fromisoformat(str(value))
    except (TypeError, ValueError):
        return timezone.localdate()


def _presence_maps(day):
    sessions = AttendanceSession.objects.filter(work_date=day).order_by("user_fk_id", "in_time")
    present_ids = set()
    worksites = {}
    for session in sessions:
        present_ids.add(session.user_fk_id)
        if session.worksite:
            worksites[session.user_fk_id] = session.worksite
    leaves = {
        item.user_fk_id: item
        for item in LeaveDay.objects.filter(work_date=day).select_related("user_fk")
    }
    return present_ids, worksites, leaves


def _membership_map(active_only=True):
    query = EmployeeTeamMember.objects.select_related("team", "employee")
    if active_only:
        query = query.filter(active=True, team__active=True)
    return {membership.employee_id: membership.team for membership in query.order_by("pk")}


@csrf_exempt
def teams_collection(request):
    app_user, can_manage_all = _actor(request)
    if not can_manage_all and not app_user:
        return _error("Autentificare necesară.", 401)

    if request.method == "GET":
        teams = list(_teams_queryset().order_by("name"))
        membership = _membership_map()
        today = timezone.localdate()
        unavailable_ids = set(LeaveDay.objects.filter(work_date=today).values_list("user_fk_id", flat=True))
        unavailable_ids.update(TemporaryWorkerRequest.objects.filter(
            status__in=(TemporaryWorkerRequest.Status.PENDING, TemporaryWorkerRequest.Status.APPROVED),
            start_date__lte=today,
            end_date__gte=today,
        ).values_list("employee_id", flat=True))
        leader_ids = {team.leader_id for team in teams if team.active}
        employees = []
        for employee in Users.objects.order_by("UserName"):
            row = _employee_payload(employee, membership.get(employee.pk))
            row["can_request"] = bool(
                employee.active and row["team"] and employee.pk not in leader_ids and employee.pk not in unavailable_ids
            )
            employees.append(row)
        return JsonResponse({
            "teams": [_team_payload(team, app_user, can_manage_all) for team in teams],
            "employees": employees,
            "unassigned_count": sum(1 for item in employees if item["active"] and not item["team"]),
            "permissions": {
                "can_manage_all": can_manage_all,
                "leader_team_ids": list(
                    EmployeeTeam.objects.filter(active=True, leader_id=getattr(app_user, "employee_id", None))
                    .values_list("id", flat=True)
                ) if app_user else [],
            },
        })

    if request.method != "POST":
        return _error("Metodă nepermisă.", 405)
    if not can_manage_all:
        return _error("Doar administratorii sau utilizatorii autorizați pot crea echipe.", 403)
    body = _json_body(request)
    if body is None:
        return _error("JSON invalid.")
    serializer = TeamWriteSerializer(data=body)
    if not serializer.is_valid():
        return _error("Datele echipei sunt invalide.", details=serializer.errors)
    try:
        team = _save_team(serializer.validated_data)
    except (ValidationError, IntegrityError) as exc:
        return _error("Echipa nu a putut fi salvată.", details=_validation_details(exc))
    return JsonResponse({"team": _team_payload(team, app_user, can_manage_all)}, status=201)


@transaction.atomic
def _save_team(data, team=None, members_only=False):
    if team:
        team = EmployeeTeam.objects.select_for_update().get(pk=team.pk)
    else:
        team = EmployeeTeam()

    if not members_only:
        leader = Users.objects.select_for_update().filter(pk=data["leader_id"], active=True).first()
        if not leader:
            raise ValidationError({"leader_id": "Șeful selectat nu există sau este inactiv."})
        team.name = data["name"]
        team.leader = leader
        team.default_worksite = data.get("default_worksite", "")
        team.active = data.get("active", True)
    elif not team.active:
        raise ValidationError("Echipa inactivă nu poate primi membri.")

    desired_ids = set(data.get("member_ids", []))
    if team.active:
        desired_ids.add(team.leader_id)
    else:
        desired_ids.clear()

    employees = {
        employee.pk: employee
        for employee in Users.objects.select_for_update().filter(pk__in=desired_ids)
    }
    missing = desired_ids.difference(employees)
    inactive = [employee.UserName for employee in employees.values() if not employee.active]
    if missing:
        raise ValidationError({"member_ids": f"Angajați inexistenți: {sorted(missing)}."})
    if inactive:
        raise ValidationError({"member_ids": f"Angajați inactivi: {', '.join(inactive)}."})

    if team.active:
        duplicate_name = EmployeeTeam.objects.filter(active=True, name__iexact=team.name)
        duplicate_leader = EmployeeTeam.objects.filter(active=True, leader_id=team.leader_id)
        if team.pk:
            duplicate_name = duplicate_name.exclude(pk=team.pk)
            duplicate_leader = duplicate_leader.exclude(pk=team.pk)
        if duplicate_name.exists():
            raise ValidationError({"name": "Există deja o echipă activă cu această denumire."})
        if duplicate_leader.exists():
            raise ValidationError({"leader_id": "Șeful selectat conduce deja o echipă activă."})
        member_conflicts = EmployeeTeamMember.objects.select_for_update().filter(
            active=True,
            employee_id__in=desired_ids,
        )
        if team.pk:
            member_conflicts = member_conflicts.exclude(team_id=team.pk)
        if member_conflicts.exists():
            names = ", ".join(member_conflicts.values_list("employee__UserName", flat=True))
            raise ValidationError({"member_ids": f"Au deja o echipă permanentă activă: {names}."})
        leader_conflicts = EmployeeTeam.objects.filter(active=True, leader_id__in=desired_ids)
        if team.pk:
            leader_conflicts = leader_conflicts.exclude(pk=team.pk)
        if leader_conflicts.exists():
            names = ", ".join(leader_conflicts.values_list("leader__UserName", flat=True))
            raise ValidationError({"member_ids": f"Sunt deja șefi în alte echipe active: {names}."})

    team.full_clean()
    team.save()
    team.memberships.exclude(employee_id__in=desired_ids).update(active=False)
    for employee_id in desired_ids:
        membership, _ = EmployeeTeamMember.objects.get_or_create(team=team, employee_id=employee_id)
        if not membership.active:
            membership.active = True
            membership.save(update_fields=["active"])
    return _teams_queryset().get(pk=team.pk)


@csrf_exempt
def team_detail(request, team_id):
    app_user, can_manage_all = _actor(request)
    team = _teams_queryset().filter(pk=team_id).first()
    if not team:
        return _error("Echipa nu există.", 404)
    if request.method == "GET":
        return JsonResponse({"team": _team_payload(team, app_user, can_manage_all)})
    if request.method not in ("PUT", "PATCH"):
        return _error("Metodă nepermisă.", 405)
    can_edit_own = _is_leader(app_user, team)
    if not can_manage_all and not can_edit_own:
        return _error("Nu poți modifica echipa altui șef.", 403)
    body = _json_body(request)
    if body is None:
        return _error("JSON invalid.")
    if can_manage_all:
        serializer = TeamWriteSerializer(data=body)
    else:
        serializer = TeamWriteSerializer(data={
            "name": team.name,
            "leader_id": team.leader_id,
            "default_worksite": team.default_worksite,
            "active": team.active,
            "member_ids": body.get("member_ids", []),
        })
    if not serializer.is_valid():
        return _error("Datele echipei sunt invalide.", details=serializer.errors)
    try:
        saved = _save_team(serializer.validated_data, team=team, members_only=not can_manage_all)
    except (ValidationError, IntegrityError) as exc:
        return _error("Echipa nu a putut fi salvată.", details=_validation_details(exc))
    return JsonResponse({"team": _team_payload(saved, app_user, can_manage_all)})


@csrf_exempt
def team_members(request, team_id):
    if request.method != "POST":
        return _error("Metodă nepermisă.", 405)
    app_user, can_manage_all = _actor(request)
    team = _teams_queryset().filter(pk=team_id).first()
    if not team:
        return _error("Echipa nu există.", 404)
    if not can_manage_all and not _is_leader(app_user, team):
        return _error("Nu poți modifica echipa altui șef.", 403)
    serializer = TeamMembersSerializer(data=_json_body(request) or {})
    if not serializer.is_valid():
        return _error("Acțiune invalidă.", details=serializer.errors)
    employee_id = serializer.validated_data["employee_id"]
    member_ids = list(team.memberships.filter(active=True).values_list("employee_id", flat=True))
    if serializer.validated_data["action"] == "add":
        member_ids.append(employee_id)
    else:
        if employee_id == team.leader_id:
            return _error("Șeful nu poate fi eliminat din propria echipă.")
        member_ids = [item for item in member_ids if item != employee_id]
    data = {
        "name": team.name,
        "leader_id": team.leader_id,
        "default_worksite": team.default_worksite,
        "active": team.active,
        "member_ids": member_ids,
    }
    try:
        saved = _save_team(data, team=team, members_only=not can_manage_all)
    except (ValidationError, IntegrityError) as exc:
        return _error("Membrul nu a putut fi actualizat.", details=_validation_details(exc))
    return JsonResponse({"team": _team_payload(saved, app_user, can_manage_all)})


def _request_payload(item, app_user=None, can_manage_all=False):
    can_resolve = can_manage_all or _is_leader(app_user, item.source_team)
    can_cancel = can_manage_all or _is_leader(app_user, item.requester_team) or (
        app_user and item.requested_by_id == app_user.pk
    )
    return {
        "id": item.pk,
        "employee": _employee_payload(item.employee, item.source_team),
        "source_team": {"id": item.source_team_id, "name": item.source_team.name},
        "requester_team": {"id": item.requester_team_id, "name": item.requester_team.name},
        "start_date": item.start_date.isoformat(),
        "end_date": item.end_date.isoformat(),
        "reason": item.reason,
        "status": item.status,
        "status_label": item.get_status_display(),
        "created_at": item.created_at.isoformat(),
        "can_approve": can_resolve and item.status == item.Status.PENDING,
        "can_reject": can_resolve and item.status == item.Status.PENDING,
        "can_cancel": can_cancel and item.status in (item.Status.PENDING, item.Status.APPROVED),
    }


@csrf_exempt
def temporary_requests(request):
    app_user, can_manage_all = _actor(request)
    if not can_manage_all and not app_user:
        return _error("Autentificare necesară.", 401)
    _expire_requests()
    if request.method == "GET":
        query = TemporaryWorkerRequest.objects.select_related(
            "employee", "source_team", "requester_team", "requested_by", "resolved_by"
        )
        if not can_manage_all:
            employee_id = app_user.employee_id
            query = query.filter(
                Q(source_team__leader_id=employee_id)
                | Q(requester_team__leader_id=employee_id)
                | Q(requested_by=app_user)
            ).distinct()
        return JsonResponse({
            "requests": [_request_payload(item, app_user, can_manage_all) for item in query],
        })
    if request.method != "POST":
        return _error("Metodă nepermisă.", 405)
    serializer = TemporaryWorkerRequestWriteSerializer(data=_json_body(request) or {})
    if not serializer.is_valid():
        return _error("Solicitarea este invalidă.", details=serializer.errors)
    data = serializer.validated_data
    requester_team = EmployeeTeam.objects.filter(pk=data["requester_team_id"], active=True).first()
    employee = Users.objects.filter(pk=data["employee_id"], active=True).first()
    if not requester_team or not employee:
        return _error("Echipa sau angajatul selectat nu există ori este inactiv.", 404)
    source_membership = EmployeeTeamMember.objects.select_related("team").filter(
        employee=employee, active=True, team__active=True
    ).first()
    if not source_membership:
        return _error("Pentru un angajat fără echipă folosește alocarea permanentă.")
    if source_membership.team.leader_id == employee.pk:
        return _error("Un șef de echipă nu poate fi solicitat temporar.")
    if not can_manage_all and not _is_leader(app_user, requester_team):
        return _error("Poți solicita personal numai pentru propria echipă.", 403)
    try:
        with transaction.atomic():
            list(TemporaryWorkerRequest.objects.select_for_update().filter(employee=employee))
            item = TemporaryWorkerRequest(
                requester_team=requester_team,
                source_team=source_membership.team,
                employee=employee,
                start_date=data["start_date"],
                end_date=data["end_date"],
                reason=data.get("reason", ""),
                requested_by=app_user,
            )
            item.save()
    except (ValidationError, IntegrityError) as exc:
        return _error("Solicitarea nu a putut fi creată.", details=_validation_details(exc))
    return JsonResponse({"request": _request_payload(item, app_user, can_manage_all)}, status=201)


@csrf_exempt
def temporary_request_action(request, request_id):
    if request.method != "POST":
        return _error("Metodă nepermisă.", 405)
    app_user, can_manage_all = _actor(request)
    serializer = TemporaryWorkerRequestActionSerializer(data=_json_body(request) or {})
    if not serializer.is_valid():
        return _error("Acțiune invalidă.", details=serializer.errors)
    action = serializer.validated_data["action"]
    try:
        with transaction.atomic():
            item = TemporaryWorkerRequest.objects.select_for_update().select_related(
                "employee", "source_team", "requester_team"
            ).filter(pk=request_id).first()
            if not item:
                return _error("Solicitarea nu există.", 404)
            can_resolve = can_manage_all or _is_leader(app_user, item.source_team)
            can_cancel = can_manage_all or _is_leader(app_user, item.requester_team) or (
                app_user and item.requested_by_id == app_user.pk
            )
            if action in ("approve", "reject") and not can_resolve:
                return _error("Doar șeful echipei sursă sau un administrator poate decide.", 403)
            if action == "cancel" and not can_cancel:
                return _error("Nu poți anula această solicitare.", 403)
            if action in ("approve", "reject") and item.status != item.Status.PENDING:
                return _error("Solicitarea a fost deja soluționată.")
            if action == "cancel" and item.status not in (item.Status.PENDING, item.Status.APPROVED):
                return _error("Solicitarea nu mai poate fi anulată.")
            status_map = {
                "approve": item.Status.APPROVED,
                "reject": item.Status.REJECTED,
                "cancel": item.Status.CANCELLED,
            }
            item.status = status_map[action]
            item.resolved_by = app_user
            item.resolved_at = timezone.now()
            item.save()
    except (ValidationError, IntegrityError) as exc:
        return _error("Solicitarea nu a putut fi actualizată.", details=_validation_details(exc))
    return JsonResponse({"request": _request_payload(item, app_user, can_manage_all)})


def _daily_employee(employee, team, present_ids, worksites, leaves, category):
    leave = leaves.get(employee.pk)
    return {
        **_employee_payload(employee, team),
        "category": category,
        "presence": "leave" if leave else ("present" if employee.pk in present_ids else "absent"),
        "leave": ({"reason": leave.reason, "label": leave.get_reason_display()} if leave else None),
        "worksite": worksites.get(employee.pk, ""),
    }


@csrf_exempt
def teams_today(request):
    if request.method != "GET":
        return _error("Metodă nepermisă.", 405)
    app_user, can_manage_all = _actor(request)
    day = _parse_date(request.GET.get("date"))
    present_ids, worksites, leaves = _presence_maps(day)
    teams = list(_teams_queryset().filter(active=True))
    transfers = list(TemporaryWorkerRequest.objects.select_related("employee", "source_team", "requester_team").filter(
        status=TemporaryWorkerRequest.Status.APPROVED,
        start_date__lte=day,
        end_date__gte=day,
    ))
    received = {}
    sent = {}
    transferred_ids = set()
    for item in transfers:
        received.setdefault(item.requester_team_id, []).append(item)
        sent.setdefault(item.source_team_id, []).append(item)
        transferred_ids.add(item.employee_id)
    rows = []
    assigned_ids = set()
    for team in teams:
        members = [membership.employee for membership in team.memberships.filter(active=True).select_related("employee")]
        if team.leader_id not in {member.pk for member in members}:
            members.insert(0, team.leader)
        assigned_ids.update(member.pk for member in members)
        sent_ids = {item.employee_id for item in sent.get(team.pk, [])}
        leader_row = _daily_employee(team.leader, team, present_ids, worksites, leaves, "leader")
        permanent = []
        absent = []
        for member in members:
            if member.pk == team.leader_id or member.pk in sent_ids:
                continue
            row = _daily_employee(member, team, present_ids, worksites, leaves, "permanent")
            (absent if row["presence"] != "present" else permanent).append(row)
        rows.append({
            "id": team.pk,
            "name": team.name,
            "default_worksite": team.default_worksite,
            "leader": leader_row,
            "permanent": permanent,
            "received": [
                _daily_employee(item.employee, team, present_ids, worksites, leaves, "received")
                for item in received.get(team.pk, [])
            ],
            "sent": [
                _daily_employee(item.employee, team, present_ids, worksites, leaves, "sent")
                for item in sent.get(team.pk, [])
            ],
            "absent": absent,
        })
    available = [
        _daily_employee(employee, None, present_ids, worksites, leaves, "available")
        for employee in Users.objects.filter(active=True).order_by("UserName")
        if employee.pk not in assigned_ids and employee.pk not in transferred_ids and employee.pk not in leaves
    ]
    return JsonResponse({"date": day.isoformat(), "teams": rows, "available": available})


@csrf_exempt
def available_personnel(request):
    if request.method != "GET":
        return _error("Metodă nepermisă.", 405)
    app_user, can_manage_all = _actor(request)
    day = _parse_date(request.GET.get("date"))
    present_ids, worksites, leaves = _presence_maps(day)
    memberships = _membership_map()
    active_requests = list(TemporaryWorkerRequest.objects.select_related("requester_team").filter(
        status__in=(TemporaryWorkerRequest.Status.PENDING, TemporaryWorkerRequest.Status.APPROVED),
        start_date__lte=day,
        end_date__gte=day,
    ))
    transfers = {
        item.employee_id: item
        for item in active_requests
        if item.status == TemporaryWorkerRequest.Status.APPROVED
    }
    reserved_ids = {item.employee_id for item in active_requests}
    leader_ids = set(EmployeeTeam.objects.filter(active=True).values_list("leader_id", flat=True))
    actor_can_allocate = bool(
        can_manage_all or (app_user and app_user.employee.led_employee_teams.filter(active=True).exists())
    )
    employees = []
    for employee in Users.objects.filter(active=True).order_by("UserName"):
        team = memberships.get(employee.pk)
        leave = leaves.get(employee.pk)
        transfer = transfers.get(employee.pk)
        row = _daily_employee(employee, team, present_ids, worksites, leaves, "available")
        row.update({
            "temporary_team": ({"id": transfer.requester_team_id, "name": transfer.requester_team.name} if transfer else None),
            "is_team_leader": employee.pk in leader_ids,
            "can_add_permanent": actor_can_allocate,
            "can_request": bool(
                actor_can_allocate
                and team and employee.pk not in leader_ids and not leave and employee.pk not in reserved_ids
            ),
        })
        employees.append(row)
    teams = [
        _team_payload(team, app_user, can_manage_all)
        for team in _teams_queryset().filter(active=True)
        if can_manage_all or _is_leader(app_user, team)
    ]
    return JsonResponse({"date": day.isoformat(), "employees": employees, "manageable_teams": teams})
