from django.db import migrations, models
import django.db.models.deletion


def backfill_tool_employee_fields(apps, schema_editor):
    Tools = apps.get_model("ToolApp", "Tools")
    Users = apps.get_model("ToolApp", "Users")

    users_by_name = {
        (user.UserName or "").strip().lower(): user
        for user in Users.objects.all()
        if (user.UserName or "").strip()
    }

    for tool in Tools.objects.all():
        location = (tool.MainLocation or "").strip()
        normalized_location = location.lower()

        if normalized_location == "magazie" or not location:
            tool.Status = "magazie"
            if not location:
                tool.MainLocation = "Magazie"
            update_fields = ["Status", "MainLocation"]
        else:
            tool.Status = "in_lucru"
            update_fields = ["Status"]
            assigned_user = users_by_name.get(normalized_location)
            if assigned_user:
                tool.AssignedTo = assigned_user
                if not tool.User:
                    tool.User = assigned_user.UserName
                update_fields.extend(["AssignedTo", "User"])

        tool.save(update_fields=update_fields)


class Migration(migrations.Migration):

    dependencies = [
        ("ToolApp", "0039_users_toolapp_use_pin_loo_3f6843_idx"),
    ]

    operations = [
        migrations.AlterField(
            model_name="tools",
            name="ToolSerie",
            field=models.CharField(blank=True, db_index=True, max_length=100, null=True, unique=True),
        ),
        migrations.AddField(
            model_name="tools",
            name="AssignedTo",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="assigned_tools",
                to="ToolApp.users",
            ),
        ),
        migrations.AddField(
            model_name="tools",
            name="DateLost",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="tools",
            name="DateReturned",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="tools",
            name="IsLost",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="tools",
            name="IsReturned",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="tools",
            name="IsSSM",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="tools",
            name="Status",
            field=models.CharField(
                choices=[
                    ("stricata", "Stricata"),
                    ("in_lucru", "In lucru"),
                    ("magazie", "In magazie"),
                ],
                db_index=True,
                default="in_lucru",
                max_length=32,
            ),
        ),
        migrations.RunPython(backfill_tool_employee_fields, migrations.RunPython.noop),
    ]
