# Generated by Django 4.0.6 on 2022-08-29 10:48

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ToolApp', '0024_historiescheles_directie'),
    ]

    operations = [
        migrations.CreateModel(
            name='MijloaceFixes',
            fields=[
                ('MijloaceFixeId', models.AutoField(primary_key=True, serialize=False)),
                ('MijloaceFixeName', models.CharField(max_length=100)),
                ('MijloaceFixeCantitate', models.CharField(max_length=100)),
                ('Location', models.CharField(max_length=500)),
            ],
        ),
    ]