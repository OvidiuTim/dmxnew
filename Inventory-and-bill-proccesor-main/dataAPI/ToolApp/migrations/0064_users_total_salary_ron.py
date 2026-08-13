from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("ToolApp", "0063_users_leave_remaining_override"),
    ]

    operations = [
        migrations.AddField(
            model_name="users",
            name="total_salary_ron",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True),
        ),
    ]
