from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('queue_app', '0002_queuesettings_is_open_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='customer',
            name='device_id',
            field=models.CharField(blank=True, default='', max_length=64),
        ),
    ]
