from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("ToolApp", "0079_alter_leaverequest_status"),
    ]

    operations = [
        migrations.AddField(
            model_name="appuser",
            name="is_storekeeper",
            field=models.BooleanField(db_index=True, default=False),
        ),
    ]
