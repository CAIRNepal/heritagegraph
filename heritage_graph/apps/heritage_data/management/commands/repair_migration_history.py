"""
Fix InconsistentMigrationHistory: admin.* recorded in django_migrations while users.* is not.

Happens when Postgres was migrated out of order (e.g. PaaS restarts) with AUTH_USER_MODEL =
users.User. Safe when users tables are empty or match --fake-initial.

Invoked from entrypoint when MIGRATION_AUTO_REPAIR=1 (see docker-compose-dokploy.yml).
"""

from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import connection


class Command(BaseCommand):
    help = (
        "Repair django_migrations when admin ran before users (custom user model). "
        "No-op if users app already has migration rows."
    )

    def handle(self, *args, **options):
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT COUNT(*) FROM django_migrations WHERE app = %s",
                ["users"],
            )
            users_n = cursor.fetchone()[0]
            cursor.execute(
                "SELECT COUNT(*) FROM django_migrations WHERE app = %s",
                ["admin"],
            )
            admin_n = cursor.fetchone()[0]

        if users_n > 0:
            self.stdout.write("Migration history OK (users app has rows); skip repair.")
            return

        if admin_n == 0:
            self.stdout.write("No admin-only inconsistent state; skip repair.")
            return

        self.stdout.write(
            self.style.WARNING(
                "Repairing: django_migrations lists admin before users — "
                "aligning for custom User model."
            )
        )

        tables = connection.introspection.table_names()
        if "users_user" in tables:
            self.stdout.write("users_user exists; faking initial users migrations if needed.")
            try:
                call_command("migrate", "users", "--fake-initial", "--noinput", verbosity=1)
            except CommandError as exc:
                self.stdout.write(self.style.WARNING(f"migrate users --fake-initial: {exc}"))

        with connection.cursor() as cursor:
            cursor.execute("DELETE FROM django_migrations WHERE app = %s", ["admin"])
            deleted = cursor.rowcount
        self.stdout.write(
            self.style.SUCCESS(
                f"Removed admin rows from django_migrations (rowcount={deleted}); run migrate."
            )
        )
