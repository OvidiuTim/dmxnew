from django.db import migrations, models
import django.db.models.deletion


def assign_existing_supervisors(apps, schema_editor):
    EmployeeTeam = apps.get_model("ToolApp", "EmployeeTeam")
    EmployeeTeam.objects.filter(supervisor__isnull=True).update(
        supervisor_id=models.F("leader_id")
    )


class Migration(migrations.Migration):
    dependencies = [("ToolApp", "0068_remove_human_resources_module")]

    operations = [
        migrations.AddField(
            model_name="users",
            name="attendance_exempt",
            field=models.BooleanField(db_index=True, default=False),
        ),
        migrations.AddField(
            model_name="employeeteam",
            name="supervisor",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="supervised_employee_teams",
                to="ToolApp.users",
            ),
        ),
        migrations.RunPython(assign_existing_supervisors, migrations.RunPython.noop),
    ]
