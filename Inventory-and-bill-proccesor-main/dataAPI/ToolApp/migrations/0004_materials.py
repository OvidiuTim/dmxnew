# Generated by Django 4.0.3 on 2022-04-04 08:33

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ToolApp', '0003_histories_toolserie_tools_detail'),
    ]

    operations = [
        migrations.CreateModel(
            name='Materials',
            fields=[
                ('MaterialId', models.AutoField(primary_key=True, serialize=False)),
                ('MaterialSerie', models.CharField(max_length=100)),
                ('MaterialName', models.CharField(max_length=100)),
                ('Quantity', models.IntegerField(max_length=100)),
                ('Amount', models.IntegerField(max_length=100)),
                ('MaterialLocation', models.CharField(max_length=100)),
                ('MaterialPrice', models.IntegerField(max_length=100)),
            ],
        ),
    ]