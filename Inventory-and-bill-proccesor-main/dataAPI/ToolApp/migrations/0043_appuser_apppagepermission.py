from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("ToolApp", "0042_alter_tools_batchid"),
    ]

    operations = [
        migrations.CreateModel(
            name="AppUser",
            fields=[
                ("AppUserId", models.AutoField(primary_key=True, serialize=False)),
                ("username", models.CharField(db_index=True, max_length=100, unique=True)),
                ("pin_hash", models.CharField(max_length=256)),
                ("is_active", models.BooleanField(db_index=True, default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "employee",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="app_user",
                        to="ToolApp.users",
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="AppPagePermission",
            fields=[
                ("PermissionId", models.AutoField(primary_key=True, serialize=False)),
                ("route", models.CharField(db_index=True, max_length=120)),
                ("can_access", models.BooleanField(default=False)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "app_user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="page_permissions",
                        to="ToolApp.appuser",
                    ),
                ),
            ],
            options={
                "unique_together": {("app_user", "route")},
            },
        ),
        migrations.AddIndex(
            model_name="apppagepermission",
            index=models.Index(fields=["route", "can_access"], name="ToolApp_app_route_c_0ba3c1_idx"),
        ),
    ]
