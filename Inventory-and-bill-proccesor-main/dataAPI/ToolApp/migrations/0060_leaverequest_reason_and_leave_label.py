from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("ToolApp", "0059_employeedocument_expiry_notification"),
    ]

    operations = [
        migrations.AddField(
            model_name="leaverequest",
            name="reason",
            field=models.TextField(blank=True, default=""),
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
                    ("ALT", "Alt motiv"),
                ],
                max_length=16,
            ),
        ),
    ]
