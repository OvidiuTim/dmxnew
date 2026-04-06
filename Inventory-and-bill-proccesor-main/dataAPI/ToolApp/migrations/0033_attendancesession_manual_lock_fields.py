from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ToolApp', '0032_leaveday_delete_dayleave_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='attendancesession',
            name='manual_client_ip',
            field=models.CharField(blank=True, db_index=True, max_length=64, null=True),
        ),
        migrations.AddField(
            model_name='attendancesession',
            name='manual_device_key',
            field=models.CharField(blank=True, db_index=True, max_length=64, null=True),
        ),
    ]
