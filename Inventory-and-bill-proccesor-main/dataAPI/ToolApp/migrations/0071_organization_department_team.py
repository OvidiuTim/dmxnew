from django.db import migrations, models
import django.db.models.deletion


def synchronize_existing_teams(apps, schema_editor):
    EmployeeTeam = apps.get_model("ToolApp", "EmployeeTeam")
    OrganizationDepartment = apps.get_model("ToolApp", "OrganizationDepartment")
    OrganizationMember = apps.get_model("ToolApp", "OrganizationMember")
    max_order = OrganizationDepartment.objects.filter(parent_id__isnull=True).order_by("-sort_order").values_list("sort_order", flat=True).first() or 0

    for team in EmployeeTeam.objects.all().order_by("id"):
        department = OrganizationDepartment.objects.filter(team_id=team.pk).first()
        if department is None:
            max_order += 1
            department = OrganizationDepartment.objects.create(
                name=team.name,
                subtitle="Echipă permanentă",
                color="#2dd4a3",
                sort_order=max_order,
                source_key=f"permanent-team:{team.pk}",
                team_id=team.pk,
            )
        member_ids = set(
            team.memberships.filter(active=True).values_list("employee_id", flat=True)
        )
        member_ids.add(team.leader_id)
        member_ids.add(team.supervisor_id or team.leader_id)
        synchronized = {}
        for order, employee in enumerate(
            apps.get_model("ToolApp", "Users").objects.filter(pk__in=member_ids).order_by("UserName", "UserId"),
            start=1,
        ):
            member = OrganizationMember.objects.filter(employee_id=employee.pk, department_id=department.pk).first()
            if member is None:
                member = OrganizationMember.objects.filter(
                    employee_id=employee.pk,
                    department__team__isnull=True,
                ).first()
            if member is None:
                member = OrganizationMember(employee_id=employee.pk, name=employee.UserName)
            is_leader = employee.pk == team.leader_id
            is_supervisor = employee.pk == (team.supervisor_id or team.leader_id)
            role = (
                "Șef de echipă · Supervisor" if is_leader and is_supervisor
                else "Șef de echipă" if is_leader
                else "Supervisor" if is_supervisor
                else (employee.trade or "Membru echipă")
            )
            metadata = dict(member.metadata or {})
            if (
                member.pk
                and member.department_id != department.pk
                and OrganizationDepartment.objects.filter(pk=member.department_id, team__isnull=True).exists()
            ):
                metadata.setdefault("previous_department_id", member.department_id)
            metadata.update({"team_sync": True, "team_id": team.pk})
            member.department_id = department.pk
            member.name = employee.UserName
            member.role = role
            member.metadata = metadata
            member.sort_order = order
            member.reports_to_id = None
            member.save()
            synchronized[employee.pk] = member

        leader_member = synchronized.get(team.leader_id)
        supervisor_member = synchronized.get(team.supervisor_id or team.leader_id)
        for employee_id, member in synchronized.items():
            if employee_id == (team.supervisor_id or team.leader_id):
                reports_to_id = None
            elif employee_id == team.leader_id:
                reports_to_id = supervisor_member.pk
            else:
                reports_to_id = leader_member.pk
            if member.reports_to_id != reports_to_id:
                member.reports_to_id = reports_to_id
                member.save(update_fields=("reports_to",))


class Migration(migrations.Migration):
    dependencies = [("ToolApp", "0070_organization_chart")]

    operations = [
        migrations.AddField(
            model_name="organizationdepartment",
            name="team",
            field=models.OneToOneField(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="organization_department",
                to="ToolApp.employeeteam",
            ),
        ),
        migrations.AlterField(
            model_name="organizationmember",
            name="employee",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="organization_members",
                to="ToolApp.users",
            ),
        ),
        migrations.RunPython(synchronize_existing_teams, migrations.RunPython.noop),
    ]
