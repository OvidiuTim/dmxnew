# Generated by Django 4.0.6 on 2022-08-11 09:17

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ToolApp', '0022_cofrajmetalics_cofrajttipdokas_combustibils_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='cofrajmetalics',
            name='Location',
            field=models.CharField(max_length=500, null=True),
        ),
        migrations.AddField(
            model_name='cofrajttipdokas',
            name='Location',
            field=models.CharField(max_length=500, null=True),
        ),
        migrations.AddField(
            model_name='popis',
            name='Location',
            field=models.CharField(max_length=500, null=True),
        ),
        migrations.AddField(
            model_name='schelafatadamodularas',
            name='Location',
            field=models.CharField(max_length=500, null=True),
        ),
        migrations.AddField(
            model_name='schelafatadas',
            name='Location',
            field=models.CharField(max_length=500, null=True),
        ),
        migrations.AddField(
            model_name='schelausoaras',
            name='Location',
            field=models.CharField(max_length=500, null=True),
        ),
    ]
