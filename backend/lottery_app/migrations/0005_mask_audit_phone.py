from django.db import migrations


def mask_existing(apps, schema_editor):
    Log = apps.get_model('lottery_app', 'LotteryAuditLog')
    for lg in Log.objects.exclude(phone=''):
        digits = ''.join(c for c in lg.phone if c.isdigit())
        if not digits:
            continue
        masked = '*' * max(0, len(digits) - 4) + digits[-4:]
        if masked != lg.phone:
            lg.phone = masked
            lg.save(update_fields=['phone'])


class Migration(migrations.Migration):

    dependencies = [
        ('lottery_app', '0004_lotteryauditlog'),
    ]

    operations = [
        migrations.RunPython(mask_existing, migrations.RunPython.noop),
    ]
