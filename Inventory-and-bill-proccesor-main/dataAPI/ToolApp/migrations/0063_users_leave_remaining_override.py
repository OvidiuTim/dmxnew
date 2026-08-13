from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("ToolApp", "0062_users_prior_paid_leave_days"),
    ]

    operations = [
        migrations.AddField(
            model_name="users",
            name="leave_remaining_override_accrued_days",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=6),
        ),
        migrations.AddField(
            model_name="users",
            name="leave_remaining_override_days",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=6, null=True),
        ),
        migrations.AddField(
            model_name="users",
            name="leave_remaining_override_used_days",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="users",
            name="leave_remaining_override_year",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
    ]
