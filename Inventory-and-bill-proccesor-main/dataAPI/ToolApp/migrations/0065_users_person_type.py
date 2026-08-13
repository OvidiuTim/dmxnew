from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("ToolApp", "0064_users_total_salary_ron"),
    ]

    operations = [
        migrations.AddField(
            model_name="users",
            name="person_type",
            field=models.CharField(
                choices=[("employee", "Angajat"), ("collaborator", "Colaborator")],
                db_index=True,
                default="employee",
                max_length=16,
            ),
        ),
    ]
