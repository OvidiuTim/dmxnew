from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("ToolApp", "0043_appuser_apppagepermission"),
    ]

    operations = [
        migrations.AddField(
            model_name="tools",
            name="Brand",
            field=models.CharField(blank=True, db_index=True, max_length=100, null=True),
        ),
        migrations.AddField(
            model_name="tools",
            name="Category",
            field=models.CharField(blank=True, db_index=True, max_length=200, null=True),
        ),
        migrations.AddField(
            model_name="tools",
            name="Model",
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.AddField(
            model_name="tools",
            name="RequiresVerification",
            field=models.BooleanField(db_index=True, default=False),
        ),
        migrations.AddField(
            model_name="tools",
            name="SerialNumber",
            field=models.CharField(blank=True, db_index=True, max_length=200, null=True),
        ),
        migrations.AddField(
            model_name="tools",
            name="SourceInventoryNumber",
            field=models.IntegerField(blank=True, db_index=True, null=True),
        ),
        migrations.AddField(
            model_name="tools",
            name="SourcePhoto",
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name="tools",
            name="SourceStatus",
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
    ]
