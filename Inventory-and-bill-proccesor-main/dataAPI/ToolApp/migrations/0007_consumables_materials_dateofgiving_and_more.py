# Generated by Django 4.0.3 on 2022-04-05 10:44

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ToolApp', '0006_alter_materials_materialprice'),
    ]

    operations = [
        migrations.CreateModel(
            name='Consumables',
            fields=[
                ('ConsumeId', models.AutoField(primary_key=True, serialize=False)),
                ('User', models.CharField(max_length=100)),
                ('Material', models.CharField(max_length=100)),
                ('MaterialSerie', models.CharField(max_length=100)),
                ('DateOfGiving', models.DateField()),
            ],
        ),
        migrations.AddField(
            model_name='materials',
            name='DateOfGiving',
            field=models.DateField(null=True),
        ),
        migrations.AddField(
            model_name='materials',
            name='Provider',
            field=models.CharField(max_length=500, null=True),
        ),
    ]