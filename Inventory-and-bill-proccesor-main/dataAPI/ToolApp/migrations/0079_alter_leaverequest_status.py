from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("ToolApp", "0078_teamportalnotification"),
    ]

    operations = [
        migrations.AlterField(
            model_name="leaverequest",
            name="status",
            field=models.CharField(
                choices=[
                    ("pending", "În așteptare"),
                    ("approved", "Aprobată"),
                    ("rejected", "Respinsă"),
                    ("cancelled", "Anulată"),
                ],
                db_index=True,
                default="pending",
                max_length=16,
            ),
        ),
    ]
