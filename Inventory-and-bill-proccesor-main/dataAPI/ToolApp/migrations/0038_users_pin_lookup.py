from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("ToolApp", "0037_pin_hash_and_attempt_log"),
    ]

    operations = [
        migrations.AddField(
            model_name="users",
            name="pin_lookup",
            field=models.CharField(blank=True, db_index=True, default="", max_length=64),
        ),
    ]
