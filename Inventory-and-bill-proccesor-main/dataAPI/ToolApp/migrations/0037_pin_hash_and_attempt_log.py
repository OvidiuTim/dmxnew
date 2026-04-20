from django.contrib.auth.hashers import make_password
from django.db import migrations, models


def migrate_plain_pins(apps, schema_editor):
    Users = apps.get_model("ToolApp", "Users")
    for user in Users.objects.all().iterator():
        raw_pin = str(getattr(user, "UserPin", "") or "").strip()
        if raw_pin and not getattr(user, "pin_hash", ""):
            user.pin_hash = make_password(raw_pin)
            user.UserPin = ""
            user.save(update_fields=["pin_hash", "UserPin"])


class Migration(migrations.Migration):

    dependencies = [
        ("ToolApp", "0036_users_uid"),
    ]

    operations = [
        migrations.AlterField(
            model_name="users",
            name="UserPin",
            field=models.CharField(blank=True, default="", max_length=100),
        ),
        migrations.AddField(
            model_name="users",
            name="pin_hash",
            field=models.CharField(blank=True, default="", max_length=256),
        ),
        migrations.RunPython(migrate_plain_pins, migrations.RunPython.noop),
        migrations.CreateModel(
            name="PinAttemptLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("ip_address", models.CharField(blank=True, db_index=True, default="", max_length=64)),
                ("device_key", models.CharField(blank=True, db_index=True, default="", max_length=128)),
                ("uid", models.CharField(blank=True, default="", max_length=128)),
                ("worksite", models.CharField(blank=True, default="", max_length=100)),
                ("success", models.BooleanField(default=False)),
                ("blocked", models.BooleanField(default=False)),
                ("reason", models.CharField(blank=True, default="", max_length=128)),
            ],
            options={
                "ordering": ["-created_at"],
                "indexes": [
                    models.Index(fields=["ip_address", "device_key", "created_at"], name="ToolApp_pin_ip_addr_426c03_idx"),
                    models.Index(fields=["success", "blocked", "created_at"], name="ToolApp_pin_success_dd48f4_idx"),
                ],
            },
        ),
        migrations.RemoveIndex(
            model_name="users",
            name="ToolApp_use_UserPin_a959d1_idx",
        ),
        migrations.AddIndex(
            model_name="users",
            index=models.Index(fields=["pin_hash"], name="ToolApp_use_pin_has_2961ec_idx"),
        ),
    ]
