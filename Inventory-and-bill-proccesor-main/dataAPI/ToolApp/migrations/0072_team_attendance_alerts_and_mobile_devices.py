from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [("ToolApp", "0071_organization_department_team")]

    operations = [
        migrations.CreateModel(
            name="TeamAttendanceAlert",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("work_date", models.DateField(db_index=True)),
                ("worksite", models.CharField(blank=True, default="", max_length=160)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("missing_employees", models.ManyToManyField(related_name="missing_attendance_alerts", to="ToolApp.users")),
                ("team", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="attendance_alerts", to="ToolApp.employeeteam")),
            ],
            options={"ordering": ("-work_date", "team__name")},
        ),
        migrations.CreateModel(
            name="TeamAttendanceAlertRecipient",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("read_at", models.DateTimeField(blank=True, null=True)),
                ("email_sent_at", models.DateTimeField(blank=True, null=True)),
                ("push_sent_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("alert", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="recipients", to="ToolApp.teamattendancealert")),
                ("employee", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="received_attendance_alerts", to="ToolApp.users")),
            ],
        ),
        migrations.CreateModel(
            name="MobileDevice",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("device_key", models.CharField(max_length=64)),
                ("push_token", models.CharField(max_length=512, unique=True)),
                ("platform", models.CharField(default="android", max_length=20)),
                ("active", models.BooleanField(db_index=True, default=True)),
                ("invalidated_at", models.DateTimeField(blank=True, null=True)),
                ("last_seen_at", models.DateTimeField(auto_now=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("employee", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="mobile_devices", to="ToolApp.users")),
            ],
        ),
        migrations.AddConstraint(
            model_name="teamattendancealert",
            constraint=models.UniqueConstraint(fields=("team", "work_date"), name="unique_team_attendance_alert_day"),
        ),
        migrations.AddConstraint(
            model_name="teamattendancealertrecipient",
            constraint=models.UniqueConstraint(fields=("alert", "employee"), name="unique_attendance_alert_recipient"),
        ),
        migrations.AddIndex(
            model_name="teamattendancealertrecipient",
            index=models.Index(fields=["employee", "read_at"], name="attendance_alert_unread_idx"),
        ),
        migrations.AddConstraint(
            model_name="mobiledevice",
            constraint=models.UniqueConstraint(fields=("employee", "device_key"), name="unique_employee_mobile_device"),
        ),
        migrations.AddIndex(
            model_name="mobiledevice",
            index=models.Index(fields=["employee", "active"], name="mobile_device_employee_idx"),
        ),
    ]
