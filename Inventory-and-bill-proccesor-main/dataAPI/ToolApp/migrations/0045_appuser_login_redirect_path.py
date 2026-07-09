from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("ToolApp", "0044_tools_inventory_import_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="appuser",
            name="login_redirect_path",
            field=models.CharField(default="/pontaj", max_length=160),
        ),
    ]
