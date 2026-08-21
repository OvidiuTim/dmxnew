import json

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models import Max
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from ToolApp.models import OrganizationDepartment, OrganizationMember, Users
from ToolApp.security import app_user_has_route
from ToolApp.team_organization_sync import sync_organization_members_to_team


def _employee_payload(employee):
    if not employee:
        return None
    return {
        "id": employee.UserId,
        "name": employee.UserName,
        "serie": employee.UserSerie,
        "trade": employee.trade or "",
        "active": bool(employee.active),
        "employment_status": employee.employment_status,
    }


def _member_payload(member):
    employee_photo = str(member.employee.photo or "").strip() if member.employee_id else ""
    team = member.department.team if member.department_id else None
    team_role = "member"
    if team and member.employee_id:
        is_leader = member.employee_id == team.leader_id
        is_supervisor = member.employee_id == (team.supervisor_id or team.leader_id)
        team_role = "both" if is_leader and is_supervisor else "leader" if is_leader else "supervisor" if is_supervisor else "member"
    return {
        "id": member.id,
        "name": member.name,
        "role": member.role,
        "department_id": member.department_id,
        "reports_to_id": member.reports_to_id,
        "sort_order": member.sort_order,
        "photo": employee_photo or member.photo,
        "associated": bool(member.employee_id),
        "employee": _employee_payload(member.employee),
        "metadata": member.metadata or {},
        "team_role": team_role,
    }


def _team_payload(team):
    if not team:
        return None
    return {
        "id": team.pk,
        "name": team.name,
        "active": team.active,
        "leader_id": team.leader_id,
        "supervisor_id": team.supervisor_id or team.leader_id,
    }


def _can_manage(request):
    return (
        getattr(request, "dmx_role", "") == "admin"
        or bool(getattr(request, "app_user", None) and app_user_has_route(request.app_user, "/pontaj/organigrama"))
    )


def _organization_payload(request):
    departments = list(
        OrganizationDepartment.objects.select_related("parent", "team", "team__leader", "team__supervisor")
        .order_by("sort_order", "name", "id")
    )
    members = list(
        OrganizationMember.objects.select_related(
            "employee", "department", "department__team", "department__team__leader",
            "department__team__supervisor", "reports_to"
        )
        .order_by("sort_order", "name", "id")
    )
    member_payloads = [_member_payload(member) for member in members]
    members_by_department = {}
    for payload in member_payloads:
        members_by_department.setdefault(payload["department_id"], []).append(payload)
    departments_by_parent = {}
    for department in departments:
        departments_by_parent.setdefault(department.parent_id, []).append(department)

    def department_payload(department):
        return {
            "id": department.id,
            "name": department.name,
            "subtitle": department.subtitle,
            "color": department.color,
            "parent_id": department.parent_id,
            "sort_order": department.sort_order,
            "team": _team_payload(department.team),
            "members": members_by_department.get(department.id, []),
            "children": [department_payload(child) for child in departments_by_parent.get(department.id, [])],
        }

    roots = [department_payload(department) for department in departments_by_parent.get(None, [])]
    employees = [
        _employee_payload(employee)
        for employee in Users.objects.filter(person_type=Users.PersonType.EMPLOYEE)
        .order_by("UserName", "UserId")
    ]
    return {
        "roots": roots,
        "departments": [
            {
                "id": department.id,
                "name": department.name,
                "parent_id": department.parent_id,
                "sort_order": department.sort_order,
                "team": _team_payload(department.team),
            }
            for department in departments
        ],
        "members": member_payloads,
        "employees": employees,
        "summary": {
            "departments": len(departments),
            "members": len(members),
            "associated": sum(1 for member in members if member.employee_id),
            "unassociated": sum(1 for member in members if not member.employee_id),
        },
        "can_manage": _can_manage(request),
    }


def _body(request):
    try:
        return json.loads(request.body or "{}")
    except (TypeError, ValueError) as exc:
        raise ValidationError("JSON invalid.") from exc


def _department(identifier):
    try:
        return OrganizationDepartment.objects.get(pk=int(identifier))
    except (OrganizationDepartment.DoesNotExist, TypeError, ValueError) as exc:
        raise ValidationError({"department_id": "Departamentul selectat nu există."}) from exc


def _employee(identifier):
    if identifier in (None, "", 0, "0"):
        return None
    try:
        return Users.objects.get(pk=int(identifier), person_type=Users.PersonType.EMPLOYEE)
    except (Users.DoesNotExist, TypeError, ValueError) as exc:
        raise ValidationError({"employee_id": "Angajatul selectat nu există."}) from exc


def _superior(identifier, member=None):
    if identifier in (None, "", 0, "0"):
        return None
    try:
        superior = OrganizationMember.objects.get(pk=int(identifier))
    except (OrganizationMember.DoesNotExist, TypeError, ValueError) as exc:
        raise ValidationError({"reports_to_id": "Superiorul selectat nu există."}) from exc
    if member and superior.pk == member.pk:
        raise ValidationError({"reports_to_id": "Membrul nu poate fi propriul superior."})
    return superior


def _validation_response(exc):
    details = getattr(exc, "message_dict", None) or getattr(exc, "messages", None) or str(exc)
    return JsonResponse({"error": "Datele organigramei sunt invalide.", "details": details}, status=400)


@csrf_exempt
def organization_chart(request):
    if request.method == "GET":
        return JsonResponse(_organization_payload(request))
    if request.method != "POST":
        return JsonResponse({"error": "Only GET and POST allowed"}, status=405)
    try:
        data = _body(request)
        name = str(data.get("name") or "").strip()
        role = str(data.get("role") or "").strip()
        if not name:
            raise ValidationError({"name": "Numele este obligatoriu."})
        department = _department(data.get("department_id"))
        employee = _employee(data.get("employee_id"))
        superior = _superior(data.get("reports_to_id"))
        max_order = department.members.aggregate(value=Max("sort_order"))["value"]
        with transaction.atomic():
            member = OrganizationMember.objects.create(
                name=name,
                role=role,
                department=department,
                employee=employee,
                reports_to=superior,
                sort_order=int(data.get("sort_order")) if data.get("sort_order") is not None else (max_order or 0) + 1,
            )
            if department.team_id:
                sync_organization_members_to_team(department)
            member.refresh_from_db()
        return JsonResponse({"member": _member_payload(member), "organization": _organization_payload(request)}, status=201)
    except (ValidationError, IntegrityError) as exc:
        return _validation_response(exc)


@csrf_exempt
def organization_member_detail(request, member_id):
    if request.method not in ("PUT", "PATCH"):
        return JsonResponse({"error": "Only PUT and PATCH allowed"}, status=405)
    try:
        member = OrganizationMember.objects.select_related("department", "employee").get(pk=member_id)
    except OrganizationMember.DoesNotExist:
        return JsonResponse({"error": "Membrul nu există."}, status=404)
    try:
        data = _body(request)
        with transaction.atomic():
            old_department_id = member.department_id
            if "name" in data:
                member.name = str(data.get("name") or "").strip()
            if not member.name:
                raise ValidationError({"name": "Numele este obligatoriu."})
            if "role" in data:
                member.role = str(data.get("role") or "").strip()
            if "department_id" in data:
                member.department = _department(data.get("department_id"))
            if "employee_id" in data:
                member.employee = _employee(data.get("employee_id"))
            if "reports_to_id" in data:
                member.reports_to = _superior(data.get("reports_to_id"), member)
            if "sort_order" in data:
                member.sort_order = max(0, int(data.get("sort_order") or 0))
            elif member.department_id != old_department_id:
                max_order = member.department.members.exclude(pk=member.pk).aggregate(value=Max("sort_order"))["value"]
                member.sort_order = (max_order or 0) + 1
            member.save()
            affected_ids = {old_department_id, member.department_id}
            for department in OrganizationDepartment.objects.filter(pk__in=affected_ids, team__isnull=False):
                sync_organization_members_to_team(department)
            member.refresh_from_db()
        return JsonResponse({"member": _member_payload(member), "organization": _organization_payload(request)})
    except (ValidationError, IntegrityError, TypeError, ValueError) as exc:
        return _validation_response(exc)


@csrf_exempt
def organization_department_team(request, department_id):
    if request.method != "POST":
        return JsonResponse({"error": "Only POST allowed"}, status=405)
    if not _can_manage(request):
        return JsonResponse({"error": "Nu ai permisiunea de a crea echipe permanente."}, status=403)
    try:
        department = OrganizationDepartment.objects.select_related("team").get(pk=department_id)
    except OrganizationDepartment.DoesNotExist:
        return JsonResponse({"error": "Departamentul nu există."}, status=404)
    if department.team_id:
        return JsonResponse({"error": "Departamentul este deja sincronizat cu o echipă permanentă."}, status=409)
    try:
        data = _body(request)
        employee_ids = set(
            department.members.filter(employee__isnull=False, employee__active=True)
            .values_list("employee_id", flat=True)
        )
        leader_id = int(data.get("leader_id"))
        supervisor_id = int(data.get("supervisor_id") or leader_id)
        if leader_id not in employee_ids:
            raise ValidationError({"leader_id": "Șeful trebuie să fie un angajat asociat acestei grupe."})
        if supervisor_id not in employee_ids:
            raise ValidationError({"supervisor_id": "Supervisorul trebuie să fie un angajat asociat acestei grupe."})
        from ToolApp.team_serializers import TeamWriteSerializer
        from ToolApp.team_views import _save_team, _team_payload as team_response_payload, _actor

        serializer = TeamWriteSerializer(data={
            "name": department.name,
            "leader_id": leader_id,
            "supervisor_id": supervisor_id,
            "active": True,
            "member_ids": sorted(employee_ids),
        })
        if not serializer.is_valid():
            raise ValidationError(serializer.errors)
        with transaction.atomic():
            team = _save_team(serializer.validated_data, organization_department=department)
        app_user, can_manage_all = _actor(request)
        return JsonResponse({
            "team": team_response_payload(team, app_user, can_manage_all),
            "organization": _organization_payload(request),
        }, status=201)
    except (ValidationError, IntegrityError, TypeError, ValueError) as exc:
        return _validation_response(exc)
