# Generated by Django 4.0.3 on 2022-04-07 08:59

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ToolApp', '0009_consumables_userserie_histories_userserie_and_more'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='consumables',
            name='UserSerie',
        ),
        migrations.RemoveField(
            model_name='histories',
            name='UserSerie',
        ),
        migrations.AddField(
            model_name='users',
            name='UserNameSerie',
            field=models.CharField(max_length=100, null=True),
        ),
    ]
