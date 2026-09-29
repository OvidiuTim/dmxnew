import django.db.models.deletion
from django.db import migrations, models


def copy_blocking_to_importance(apps, schema_editor):
    DocumentType = apps.get_model("ToolApp", "TipDocumentUtilaj")
    DocumentType.objects.filter(blocheaza_utilizarea=True).update(importanta="high")
    DocumentType.objects.filter(blocheaza_utilizarea=False).update(importanta="medium")


class Migration(migrations.Migration):

    dependencies = [
        ("ToolApp", "0093_fleet_technical_recommendations"),
    ]

    operations = [
        migrations.AddField(
            model_name="tipdocumentutilaj",
            name="importanta",
            field=models.CharField(choices=[("low", "Scăzută"), ("medium", "Medie"), ("high", "Ridicată")], db_index=True, default="medium", max_length=8),
        ),
        migrations.RunPython(copy_blocking_to_importance, migrations.RunPython.noop),
        migrations.CreateModel(
            name="FleetDocumentUsageAlert",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("work_date", models.DateField(db_index=True)),
                ("blocata", models.BooleanField(db_index=True, default=False)),
                ("read_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("angajat", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="alerte_documente_utilaj", to="ToolApp.users")),
                ("document", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="alerte_utilizare", to="ToolApp.documentutilaj")),
                ("responsabil", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="alerte_utilizare", to="ToolApp.fleetdocumentresponsible")),
                ("tip_document", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="alerte_utilizare", to="ToolApp.tipdocumentutilaj")),
                ("utilaj", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="alerte_documente_utilizare", to="ToolApp.utilaj")),
            ],
            options={"ordering": ("-created_at", "-id")},
        ),
        migrations.AddConstraint(
            model_name="fleetdocumentusagealert",
            constraint=models.UniqueConstraint(fields=("responsabil", "utilaj", "angajat", "tip_document", "work_date"), name="unique_fleet_document_usage_alert_day"),
        ),
    ]
