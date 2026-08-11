from django.db import migrations, models
import django.db.models.deletion


def backfill_leave_request_routing(apps, schema_editor):
    LeaveRequest = apps.get_model("ToolApp", "LeaveRequest")
    EmployeeTeam = apps.get_model("ToolApp", "EmployeeTeam")
    EmployeeTeamMember = apps.get_model("ToolApp", "EmployeeTeamMember")

    LeaveRequest.objects.filter(status="cancelled").update(status="rejected")
    for leave_request in LeaveRequest.objects.filter(team__isnull=True).iterator():
        membership = (
            EmployeeTeamMember.objects.filter(
                employee_id=leave_request.employee_id,
                active=True,
                team__active=True,
            )
            .select_related("team")
            .first()
        )
        team = membership.team if membership else EmployeeTeam.objects.filter(
            leader_id=leave_request.employee_id,
            active=True,
        ).first()
        if team:
            leave_request.team_id = team.pk
            leave_request.assigned_leader_id = team.leader_id
            leave_request.save(update_fields=("team", "assigned_leader"))


class Migration(migrations.Migration):

    dependencies = [
        ("ToolApp", "0054_tools_expirydate"),
    ]

    operations = [
        migrations.AddField(
            model_name="leaverequest",
            name="assigned_leader",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="assigned_leave_requests",
                to="ToolApp.users",
            ),
        ),
        migrations.AddField(
            model_name="leaverequest",
            name="reviewed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="leaverequest",
            name="reviewed_by_app_user",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="reviewed_leave_requests",
                to="ToolApp.appuser",
            ),
        ),
        migrations.AddField(
            model_name="leaverequest",
            name="team",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="leave_requests",
                to="ToolApp.employeeteam",
            ),
        ),
        migrations.RunPython(backfill_leave_request_routing, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="leaverequest",
            name="status",
            field=models.CharField(
                choices=[
                    ("pending", "În așteptare"),
                    ("approved", "Aprobată"),
                    ("rejected", "Respinsă"),
                ],
                db_index=True,
                default="pending",
                max_length=16,
            ),
        ),
    ]
