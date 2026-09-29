import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("ToolApp", "0092_fleet_document_responsibles"),
    ]

    operations = [
        migrations.CreateModel(
            name="FleetTechnicalResponsible",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("active", models.BooleanField(db_index=True, default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("app_user", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="fleet_technical_responsibility", to="ToolApp.appuser")),
            ],
            options={"ordering": ("app_user__employee__UserName", "id")},
        ),
        migrations.CreateModel(
            name="FleetTechnicalRecommendation",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("titlu", models.CharField(max_length=180)),
                ("instructiuni", models.TextField(blank=True, default="")),
                ("frecventa_valoare", models.PositiveSmallIntegerField(default=1)),
                ("frecventa_unitate", models.CharField(choices=[("day", "Zile"), ("week", "Săptămâni")], default="day", max_length=8)),
                ("prima_scadenta", models.DateField(db_index=True)),
                ("importanta", models.CharField(choices=[("low", "Scăzută"), ("medium", "Medie"), ("high", "Ridicată")], db_index=True, default="low", max_length=8)),
                ("activ", models.BooleanField(db_index=True, default=True)),
                ("creat_de", models.CharField(blank=True, default="", max_length=180)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("utilaj", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="recomandari_tehnice", to="ToolApp.utilaj")),
            ],
            options={"ordering": ("-activ", "prima_scadenta", "titlu", "id")},
        ),
        migrations.CreateModel(
            name="FleetRecommendationSubmission",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("photo", models.FileField(upload_to="fleet_recommendations/%Y/%m/")),
                ("status", models.CharField(choices=[("pending", "În așteptare"), ("approved", "Aprobată"), ("rejected", "Respinsă")], db_index=True, default="pending", max_length=12)),
                ("submitted_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("reviewed_at", models.DateTimeField(blank=True, null=True)),
                ("review_note", models.CharField(blank=True, default="", max_length=500)),
                ("employee", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="verificari_recomandari_tehnice", to="ToolApp.users")),
                ("recommendation", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="verificari", to="ToolApp.fleettechnicalrecommendation")),
                ("reviewed_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="fleet_recommendation_reviews", to="ToolApp.appuser")),
            ],
            options={"ordering": ("-submitted_at", "-id")},
        ),
        migrations.AddConstraint(
            model_name="fleetrecommendationsubmission",
            constraint=models.UniqueConstraint(condition=models.Q(("status", "pending")), fields=("recommendation",), name="unique_pending_fleet_recommendation"),
        ),
        migrations.AddConstraint(
            model_name="fleettechnicalresponsible",
            constraint=models.UniqueConstraint(condition=models.Q(("active", True)), fields=("active",), name="unique_active_fleet_technical_responsible"),
        ),
    ]
