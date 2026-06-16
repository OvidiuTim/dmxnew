from django.db import migrations, models
import uuid


def populate_batch_ids(apps, schema_editor):
    Tools = apps.get_model("ToolApp", "Tools")
    for tool in Tools.objects.filter(BatchId=""):
        tool.BatchId = f"TOOLBATCH-{uuid.uuid4().hex[:12].upper()}"
        tool.save(update_fields=["BatchId"])


class Migration(migrations.Migration):

    dependencies = [
        ("ToolApp", "0040_tools_employee_sheet_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="tools",
            name="BatchId",
            field=models.CharField(blank=True, db_index=True, default="", max_length=64),
        ),
        migrations.RunPython(populate_batch_ids, migrations.RunPython.noop),
    ]
