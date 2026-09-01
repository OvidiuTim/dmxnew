from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("ToolApp", "0077_global_absence_alerts"),
    ]

    operations = [
        migrations.CreateModel(
            name="TeamPortalNotification",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("kind", models.CharField(choices=[("leave_approval", "Cerere nouă de concediu"), ("transfer_approval", "Cerere nouă de transfer"), ("leave_result", "Rezultat cerere de concediu"), ("transfer_result", "Rezultat cerere de transfer")], db_index=True, max_length=32)),
                ("dedupe_key", models.CharField(max_length=180, unique=True)),
                ("read_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("leave_request", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="portal_notifications", to="ToolApp.leaverequest")),
                ("recipient", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="team_portal_notifications", to="ToolApp.appuser")),
                ("transfer_request", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="portal_notifications", to="ToolApp.portalteamtransferrequest")),
            ],
            options={"ordering": ("-created_at",)},
        ),
        migrations.AddIndex(
            model_name="teamportalnotification",
            index=models.Index(fields=["recipient", "read_at", "created_at"], name="portal_notice_unread_idx"),
        ),
    ]
