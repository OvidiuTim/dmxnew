# Generated by Django 4.0.3 on 2022-04-04 08:34

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ToolApp', '0004_materials'),
    ]

    operations = [
        migrations.AlterField(
            model_name='materials',
            name='Amount',
            field=models.IntegerField(),
        ),
        migrations.AlterField(
            model_name='materials',
            name='Quantity',
            field=models.IntegerField(),
        ),
    ]