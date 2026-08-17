from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("ToolApp", "0066_employee_dismissal_and_accommodation_rooms"),
    ]

    operations = [
        migrations.AddField(
            model_name="users",
            name="salary_advance_ron",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True),
        ),
        migrations.AddField(
            model_name="users",
            name="salary_remainder_ron",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True),
        ),
        migrations.AddField(
            model_name="users",
            name="meal_vouchers_ron",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True),
        ),
    ]
