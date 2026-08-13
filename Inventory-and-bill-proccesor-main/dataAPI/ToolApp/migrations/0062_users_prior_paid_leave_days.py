from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("ToolApp", "0061_leaverequest_seen_at"),
    ]

    operations = [
        migrations.AddField(
            model_name="users",
            name="prior_paid_leave_days",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="users",
            name="prior_paid_leave_year",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
    ]
