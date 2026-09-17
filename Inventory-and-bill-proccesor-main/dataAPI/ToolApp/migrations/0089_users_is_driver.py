from django.db import migrations, models
from django.db.models import Q


def mark_existing_drivers(apps, schema_editor):
    Users = apps.get_model("ToolApp", "Users")
    Users.objects.filter(
        Q(trade__icontains="driver")
        | Q(trade__icontains="sofer")
        | Q(trade__icontains="șofer")
    ).update(is_driver=True)


class Migration(migrations.Migration):
    dependencies = [("ToolApp", "0088_documentutilajversiune_revizieutilaj")]

    operations = [
        migrations.AddField(
            model_name="users",
            name="is_driver",
            field=models.BooleanField(db_index=True, default=False),
        ),
        migrations.RunPython(mark_existing_drivers, migrations.RunPython.noop),
    ]
