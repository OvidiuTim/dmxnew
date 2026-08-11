from django.db import migrations


LEGACY_LANDING_ROUTES = {
    "attendance": "/pontaj",
    "teams_schedule": "/pontaj/echipe",
    "warehouse": "/magazie",
    "human_resources": "/hr/documente",
    "tools": "/unelte",
}


def decouple_automatic_landing_permissions(apps, schema_editor):
    AppModuleAccess = apps.get_model("ToolApp", "AppModuleAccess")
    AppPagePermission = apps.get_model("ToolApp", "AppPagePermission")

    for access in AppModuleAccess.objects.filter(can_access=True):
        legacy_route = LEGACY_LANDING_ROUTES.get(access.module_code)
        if not legacy_route:
            continue
        enabled_permissions = list(
            AppPagePermission.objects.filter(
                app_user_id=access.app_user_id,
                can_access=True,
            ).values_list("route", flat=True)
        )
        # Versiunea anterioară crea automat numai ruta principală la acordarea
        # modulului. Ea nu trebuie reinterpretată ca drept administrativ.
        if enabled_permissions == [legacy_route]:
            AppPagePermission.objects.filter(
                app_user_id=access.app_user_id,
                route=legacy_route,
            ).update(can_access=False)


class Migration(migrations.Migration):
    dependencies = [
        ("ToolApp", "0050_app_module_access"),
    ]

    operations = [
        migrations.RunPython(decouple_automatic_landing_permissions, migrations.RunPython.noop),
    ]
