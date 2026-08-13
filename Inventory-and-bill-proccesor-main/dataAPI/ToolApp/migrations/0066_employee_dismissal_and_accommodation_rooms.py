import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("ToolApp", "0065_users_person_type"),
    ]

    operations = [
        migrations.AddField(
            model_name="accommodation",
            name="number_of_rooms",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="accommodation",
            name="total_places",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="users",
            name="dismissed_at",
            field=models.DateField(blank=True, db_index=True, null=True),
        ),
        migrations.AddField(
            model_name="users",
            name="employment_status",
            field=models.CharField(
                choices=[("active", "Activ"), ("dismissed", "Demis")],
                db_index=True,
                default="active",
                max_length=16,
            ),
        ),
        migrations.CreateModel(
            name="AccommodationRoom",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("position", models.PositiveIntegerField()),
                ("name", models.CharField(max_length=100)),
                ("accommodation", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="rooms", to="ToolApp.accommodation")),
            ],
            options={"ordering": ("position", "name")},
        ),
        migrations.AddConstraint(
            model_name="accommodationroom",
            constraint=models.UniqueConstraint(fields=("accommodation", "position"), name="unique_accommodation_room_position"),
        ),
        migrations.AddField(
            model_name="users",
            name="accommodation_room",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="employees", to="ToolApp.accommodationroom"),
        ),
        migrations.AlterField(
            model_name="leaveday",
            name="reason",
            field=models.CharField(
                choices=[
                    ("CO", "Concediu de odihnă"),
                    ("CM", "Concediu medical"),
                    ("UNPAID", "Concediu fără plată"),
                    ("UNEXCUSED", "Absență nemotivată"),
                    ("INDIA", "Plecat în India"),
                    ("ALT", "Alt motiv"),
                ],
                max_length=16,
            ),
        ),
    ]
