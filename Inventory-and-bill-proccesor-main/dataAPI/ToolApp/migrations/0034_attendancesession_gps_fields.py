from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ToolApp', '0033_attendancesession_manual_lock_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='attendancesession',
            name='in_gps_accuracy_m',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='attendancesession',
            name='in_gps_latitude',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='attendancesession',
            name='in_gps_longitude',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='attendancesession',
            name='out_gps_accuracy_m',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='attendancesession',
            name='out_gps_latitude',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='attendancesession',
            name='out_gps_longitude',
            field=models.FloatField(blank=True, null=True),
        ),
    ]
