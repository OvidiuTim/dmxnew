# Generated manually for company-wide attendance absence handling.

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("ToolApp", "0076_leaverequest_employee_seen_at_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="attendanceabsencemark",
            name="source",
            field=models.CharField(
                choices=[
                    ("team_leader", "Șef de echipă"),
                    ("level_1", "Nivel 1"),
                    ("supervisor", "Supervisor"),
                    ("automatic_level_2", "Automat la Nivel 2"),
                ],
                default="team_leader",
                max_length=32,
            ),
        ),
        migrations.AlterField(
            model_name="attendanceabsencemark",
            name="team",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="attendance_absence_marks",
                to="ToolApp.employeeteam",
            ),
        ),
        migrations.AlterField(
            model_name="attendancealertcase",
            name="escalation_source",
            field=models.CharField(
                blank=True,
                choices=[
                    ("scheduled_0810", "Nepontat până la 08:10"),
                    ("marked_by_level_1", "Marcat lipsă de Nivel 1"),
                    ("marked_by_team_leader", "Marcat lipsă de Șef echipă"),
                    ("marked_by_supervisor", "Marcat lipsă de Supervisor"),
                ],
                default="",
                max_length=40,
            ),
        ),
        migrations.AlterField(
            model_name="attendancealertcase",
            name="team",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="attendance_alert_cases",
                to="ToolApp.employeeteam",
            ),
        ),
    ]
