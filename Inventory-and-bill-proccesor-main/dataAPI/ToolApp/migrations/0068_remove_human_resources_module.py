from django.db import migrations, models


def remove_human_resources_access(apps, schema_editor):
    AppModuleAccess = apps.get_model("ToolApp", "AppModuleAccess")
    AppPagePermission = apps.get_model("ToolApp", "AppPagePermission")
    AppModuleAccess.objects.filter(module_code="human_resources").delete()
    AppPagePermission.objects.filter(route="/hr/documente").delete()


class Migration(migrations.Migration):

    dependencies = [
        ("ToolApp", "0067_users_salary_details"),
    ]

    operations = [
        migrations.RunPython(remove_human_resources_access, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="appmoduleaccess",
            name="module_code",
            field=models.CharField(
                choices=[
                    ("attendance", "Pontaj"),
                    ("teams_schedule", "Echipe și program"),
                    ("warehouse", "Magazie"),
                    ("tools", "Unelte"),
                ],
                db_index=True,
                max_length=32,
            ),
        ),
    ]
