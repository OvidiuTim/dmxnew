from pathlib import Path

from django.db import migrations


def import_home_ticket_data(apps, schema_editor):
    from ToolApp.home_ticket_import import import_home_ticket_benefits

    Users = apps.get_model("ToolApp", "Users")
    source = (
        Path(__file__).resolve().parent.parent
        / "data"
        / "bonus_avion_excel_general.xlsx"
    )
    import_home_ticket_benefits(
        source,
        Users,
        using=schema_editor.connection.alias,
        apply=True,
    )


class Migration(migrations.Migration):
    atomic = True

    dependencies = [
        ("ToolApp", "0081_users_ticket_benefit"),
    ]

    operations = [
        migrations.RunPython(import_home_ticket_data, migrations.RunPython.noop),
    ]
