# Generated by Django 4.0.3 on 2022-04-13 13:15

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('ToolApp', '0017_rename_workfieldid_workfield_workfield'),
    ]

    operations = [
        migrations.RenameField(
            model_name='unfunctional',
            old_name='ToolId',
            new_name='UnfunctionalId',
        ),
    ]
