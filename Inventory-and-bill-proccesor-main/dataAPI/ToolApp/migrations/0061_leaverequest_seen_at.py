from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("ToolApp", "0060_leaverequest_reason_and_leave_label"),
    ]

    operations = [
        migrations.AddField(
            model_name="leaverequest",
            name="seen_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
