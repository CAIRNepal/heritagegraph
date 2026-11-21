"""
Data migration: fix users whose username is a full email address.

Strips the @domain portion and ensures uniqueness.
"""

from django.db import migrations


def fix_email_usernames(apps, schema_editor):
    User = apps.get_model("users", "User")
    for user in User.objects.filter(username__contains="@"):
        base = user.username.split("@")[0]
        candidate = base
        counter = 1
        while User.objects.filter(username=candidate).exclude(pk=user.pk).exists():
            candidate = f"{base}{counter}"
            counter += 1
        user.username = candidate
        user.save(update_fields=["username"])


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0002_user_date_joined_user_first_name_user_last_name_and_more"),
    ]

    operations = [
        migrations.RunPython(fix_email_usernames, migrations.RunPython.noop),
    ]
