from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("ToolApp", "0080_appuser_is_storekeeper"),
    ]

    operations = [
        migrations.AddField(
            model_name="users",
            name="ticket_benefit_enabled",
            field=models.BooleanField(db_index=True, default=False),
        ),
        migrations.AddField(
            model_name="users",
            name="last_home_trip_date",
            field=models.DateField(blank=True, null=True),
        ),
    ]
