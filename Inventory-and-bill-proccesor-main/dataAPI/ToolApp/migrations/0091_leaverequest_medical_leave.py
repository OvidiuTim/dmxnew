from django.db import migrations, models


class Migration(migrations.Migration):
    """Concediul medical devine tip de cerere, nu doar zi introdusă de administrator."""

    dependencies = [
        ('ToolApp', '0090_remove_attendancesession_unique_tesa_confirmation_per_day'),
    ]

    operations = [
        migrations.AlterField(
            model_name='leaverequest',
            name='leave_type',
            field=models.CharField(
                choices=[
                    ('paid_leave', 'Concediu de odihnă'),
                    ('unpaid_leave', 'Concediu fără plată'),
                    ('medical_leave', 'Concediu medical'),
                ],
                max_length=32,
            ),
        ),
    ]
