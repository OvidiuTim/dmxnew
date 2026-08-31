from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [("ToolApp", "0072_team_attendance_alerts_and_mobile_devices")]

    operations = [
        migrations.AlterField(
            model_name="appmoduleaccess",
            name="module_code",
            field=models.CharField(
                choices=[
                    ("attendance", "Pontaj"),
                    ("teams_schedule", "Echipe și program"),
                    ("team_dashboard", "Team Dashboard"),
                    ("warehouse", "Magazie"),
                    ("tools", "Unelte"),
                ],
                db_index=True,
                max_length=32,
            ),
        ),
        migrations.CreateModel(
            name="AttendanceAbsenceMark",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("work_date", models.DateField(db_index=True)),
                ("marked_at", models.DateTimeField(auto_now_add=True)),
                ("employee", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="attendance_absence_marks", to="ToolApp.users")),
                ("marked_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="attendance_absences_marked", to="ToolApp.appuser")),
                ("team", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="attendance_absence_marks", to="ToolApp.employeeteam")),
            ],
            options={"ordering": ("-work_date", "employee__UserName")},
        ),
        migrations.AddConstraint(
            model_name="attendanceabsencemark",
            constraint=models.UniqueConstraint(fields=("employee", "work_date"), name="unique_employee_absence_mark_day"),
        ),
        migrations.AddIndex(
            model_name="attendanceabsencemark",
            index=models.Index(fields=["team", "work_date"], name="team_absence_mark_day_idx"),
        ),
    ]
