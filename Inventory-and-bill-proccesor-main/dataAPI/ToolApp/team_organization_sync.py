from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Max

from ToolApp.models import EmployeeTeamMember, OrganizationDepartment, OrganizationMember, Users


TEAM_SOURCE_PREFIX = "permanent-team:"
LEADERSHIP_ROLES = {"Șef de echipă", "Supervisor", "Șef de echipă · Supervisor"}


def _team_source_key(team_id):
    return f"{TEAM_SOURCE_PREFIX}{team_id}"


def _regular_role(member, employee):
    current = str(getattr(member, "role", "") or "").strip()
    return employee.trade or (current if current not in LEADERSHIP_ROLES else "") or "Membru echipă"


def _detach_member(member):
    metadata = dict(member.metadata or {})
    previous_department_id = metadata.get("previous_department_id")
    previous_department = OrganizationDepartment.objects.filter(
        pk=previous_department_id,
        team__isnull=True,
    ).first() if previous_department_id else None
    if not previous_department:
        member.delete()
        return
    metadata.pop("team_sync", None)
    metadata.pop("team_id", None)
    metadata.pop("previous_department_id", None)
    member.department = previous_department
    member.metadata = metadata
    member.reports_to = None
    if member.role in LEADERSHIP_ROLES:
        member.role = member.employee.trade or "Membru"
    member.save()


@transaction.atomic
def sync_team_to_organization(team, department=None):
    """Make the linked organization group an exact view of a permanent team."""
    if department is None:
        department = OrganizationDepartment.objects.select_for_update().filter(team=team).first()
    if department is None:
        max_order = OrganizationDepartment.objects.filter(parent__isnull=True).aggregate(value=Max("sort_order"))["value"]
        department = OrganizationDepartment.objects.create(
            name=team.name,
            subtitle="Echipă permanentă",
            color="#2dd4a3",
            sort_order=(max_order or 0) + 1,
            source_key=_team_source_key(team.pk),
            team=team,
        )
    else:
        department = OrganizationDepartment.objects.select_for_update().get(pk=department.pk)
        department.team = team
        department.name = team.name
        if not department.subtitle:
            department.subtitle = "Echipă permanentă"
        department.save(update_fields=("team", "name", "subtitle", "updated_at"))

    member_ids = set(
        team.memberships.filter(active=True).values_list("employee_id", flat=True)
    )
    member_ids.add(team.leader_id)
    member_ids.add(team.supervisor_id or team.leader_id)
    employees = {
        employee.pk: employee
        for employee in Users.objects.filter(pk__in=member_ids, person_type=Users.PersonType.EMPLOYEE)
    }

    # Associated people that no longer belong to the team must not remain in its group.
    for obsolete_member in department.members.filter(employee__isnull=False).exclude(employee_id__in=member_ids):
        _detach_member(obsolete_member)

    organization_members = {}
    for order, employee_id in enumerate(sorted(member_ids, key=lambda item: employees[item].UserName), start=1):
        employee = employees[employee_id]
        member = OrganizationMember.objects.select_for_update().filter(
            employee=employee,
            department=department,
        ).first()
        if member is None:
            member = OrganizationMember.objects.select_for_update().filter(
                employee=employee,
                department__team__isnull=True,
            ).first()
        if member is None:
            member = OrganizationMember(employee=employee, name=employee.UserName)
        metadata = dict(member.metadata or {})
        if member.pk and member.department_id != department.pk and member.department.team_id is None:
            metadata.setdefault("previous_department_id", member.department_id)
        metadata.update({"team_sync": True, "team_id": team.pk})
        member.department = department
        member.name = employee.UserName
        member.metadata = metadata
        member.sort_order = order
        member.reports_to = None
        if employee_id == team.leader_id and employee_id == (team.supervisor_id or team.leader_id):
            member.role = "Șef de echipă · Supervisor"
        elif employee_id == team.leader_id:
            member.role = "Șef de echipă"
        elif employee_id == team.supervisor_id:
            member.role = "Supervisor"
        else:
            member.role = _regular_role(member, employee)
        member.save()
        organization_members[employee_id] = member

    leader_member = organization_members[team.leader_id]
    supervisor_id = team.supervisor_id or team.leader_id
    supervisor_member = organization_members[supervisor_id]
    for employee_id, member in organization_members.items():
        if employee_id == supervisor_id:
            reports_to = None
        elif employee_id == team.leader_id:
            reports_to = supervisor_member
        else:
            reports_to = leader_member
        if member.reports_to_id != getattr(reports_to, "pk", None):
            member.reports_to = reports_to
            member.save(update_fields=("reports_to", "updated_at"))
    return department


@transaction.atomic
def sync_organization_members_to_team(department):
    """Apply associated organization members to the linked team's permanent membership."""
    department = OrganizationDepartment.objects.select_for_update().select_related("team").get(pk=department.pk)
    team = department.team
    if not team:
        return None
    employee_ids = set(
        department.members.filter(employee__isnull=False, employee__active=True)
        .values_list("employee_id", flat=True)
    )
    required_ids = {team.leader_id, team.supervisor_id or team.leader_id}
    if not required_ids.issubset(employee_ids):
        raise ValidationError({
            "department_id": "Șeful de echipă și supervisorul nu pot fi mutați în afara grupei sincronizate. Schimbă mai întâi rolurile din Echipe permanente."
        })
    conflicts = EmployeeTeamMember.objects.select_for_update().filter(
        employee_id__in=employee_ids,
        active=True,
        team__active=True,
    ).exclude(team=team)
    if conflicts.exists():
        names = ", ".join(conflicts.values_list("employee__UserName", flat=True))
        raise ValidationError({"employee_id": f"Au deja altă echipă permanentă: {names}."})

    desired_ids = employee_ids if team.active else set()
    team.memberships.exclude(employee_id__in=desired_ids).update(active=False)
    for employee_id in desired_ids:
        membership, _ = EmployeeTeamMember.objects.get_or_create(team=team, employee_id=employee_id)
        if not membership.active:
            membership.active = True
            membership.save(update_fields=("active",))
    sync_team_to_organization(team, department)
    return team


def remove_team_from_organization(team):
    department = OrganizationDepartment.objects.filter(team=team).first()
    if not department:
        return
    if department.source_key == _team_source_key(team.pk):
        for member in list(department.members.filter(employee__isnull=False).select_related("employee")):
            _detach_member(member)
        department.delete()
        return
    department.team = None
    department.save(update_fields=("team", "updated_at"))
