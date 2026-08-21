from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [("ToolApp", "0069_team_supervisor_and_attendance_exempt")]

    operations = [
        migrations.CreateModel(
            name="OrganizationDepartment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=180)),
                ("subtitle", models.CharField(blank=True, default="", max_length=255)),
                ("color", models.CharField(blank=True, default="#2dd4a3", max_length=20)),
                ("sort_order", models.PositiveIntegerField(db_index=True, default=0)),
                ("source_key", models.CharField(blank=True, max_length=255, null=True, unique=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("parent", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="children", to="ToolApp.organizationdepartment")),
            ],
            options={"ordering": ("sort_order", "name", "id")},
        ),
        migrations.CreateModel(
            name="OrganizationMember",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=180)),
                ("role", models.CharField(blank=True, default="", max_length=255)),
                ("photo", models.TextField(blank=True, default="")),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("sort_order", models.PositiveIntegerField(db_index=True, default=0)),
                ("source_key", models.CharField(blank=True, max_length=255, null=True, unique=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("department", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="members", to="ToolApp.organizationdepartment")),
                ("employee", models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="organization_member", to="ToolApp.users")),
                ("reports_to", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="direct_reports", to="ToolApp.organizationmember")),
            ],
            options={"ordering": ("sort_order", "name", "id")},
        ),
    ]
