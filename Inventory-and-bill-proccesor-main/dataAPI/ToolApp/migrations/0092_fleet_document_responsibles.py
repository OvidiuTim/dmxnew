from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ("ToolApp", "0091_leaverequest_medical_leave"),
    ]

    operations = [
        migrations.CreateModel(
            name="FleetDocumentResponsible",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("email", models.EmailField(max_length=254)),
                ("toate_utilajele", models.BooleanField(db_index=True, default=False)),
                ("activ", models.BooleanField(db_index=True, default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("responsabil", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="responsabilitate_documente_flota", to="ToolApp.users")),
                ("utilaje", models.ManyToManyField(blank=True, related_name="responsabili_documente", to="ToolApp.utilaj")),
            ],
            options={"ordering": ("responsabil__UserName", "id")},
        ),
        migrations.CreateModel(
            name="FleetDocumentExpiryNotification",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("data_expirare", models.DateField()),
                ("email", models.EmailField(max_length=254)),
                ("trimisa_la", models.DateTimeField(default=django.utils.timezone.now)),
                ("document", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="notificari_responsabili", to="ToolApp.documentutilaj")),
                ("responsabil", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="notificari_expirare", to="ToolApp.fleetdocumentresponsible")),
            ],
            options={"ordering": ("-trimisa_la", "-id")},
        ),
        migrations.AddConstraint(
            model_name="fleetdocumentexpirynotification",
            constraint=models.UniqueConstraint(fields=("responsabil", "document", "data_expirare"), name="unique_fleet_expiry_notice_per_responsible"),
        ),
    ]
