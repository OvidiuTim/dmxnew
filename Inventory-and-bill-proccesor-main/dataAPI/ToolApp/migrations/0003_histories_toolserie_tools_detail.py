# Generated by Django 4.0.3 on 2022-04-01 12:22

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ToolApp', '0002_rename_userid_users_userid'),
    ]

    operations = [
        migrations.AddField(
            model_name='histories',
            name='ToolSerie',
            field=models.CharField(max_length=100, null=True),
        ),
        migrations.AddField(
            model_name='tools',
            name='Detail',
            field=models.CharField(max_length=500, null=True),
        ),
    ]
