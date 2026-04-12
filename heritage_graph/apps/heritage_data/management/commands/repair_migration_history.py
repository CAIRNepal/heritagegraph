"""
Fix InconsistentMigrationHistory for common Postgres ordering mistakes.

1) heritage_data.0001_initial recorded while users.0001_initial is not (custom user model).
   Safe when users_user already exists (--fake-initial).

2) admin.* recorded while users.* has no rows (legacy admin-before-users case).
   Removes admin rows from django_migrations after faking users if needed.

Invoked from entrypoint when MIGRATION_AUTO_REPAIR=1 (see docker-compose-dokploy.yml).
"""

from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import connection


def _migration_applied(cursor, app: str, name: str) -> bool:
    cursor.execute(
        "SELECT 1 FROM django_migrations WHERE app = %s AND name = %s LIMIT 1",
        [app, name],
    )
    return cursor.fetchone() is not None


def _count_app_migrations(cursor, app: str) -> int:
    cursor.execute(
        "SELECT COUNT(*) FROM django_migrations WHERE app = %s",
        [app],
    )
    return cursor.fetchone()[0]


class Command(BaseCommand):
    help = (
        "Repair django_migrations ordering issues (heritage_data vs users, admin vs users). "
        "No-op when history is already consistent."
    )

    def handle(self, *args, **options):
        self._repair_heritage_before_users()
        self._repair_admin_before_users()

    def _repair_heritage_before_users(self) -> None:
        with connection.cursor() as cursor:
            heritage = _migration_applied(cursor, "heritage_data", "0001_initial")
            users_initial = _migration_applied(cursor, "users", "0001_initial")

        if not heritage or users_initial:
            return

        self.stdout.write(
            self.style.WARNING(
                "Repairing: django_migrations lists heritage_data.0001_initial before "
                "users.0001_initial (dependency order)."
            )
        )

        tables = connection.introspection.table_names()
        if "users_user" not in tables:
            raise CommandError(
                "heritage_data.0001_initial is recorded but users.0001_initial is not, and "
                "table users_user is missing. Restore from backup or fix django_migrations "
                "manually; automatic repair cannot proceed."
            )

        self.stdout.write("users_user exists; faking initial users migrations.")
        try:
            call_command("migrate", "users", "--fake-initial", "--noinput", verbosity=1)
        except CommandError as exc:
            raise CommandError(
                f"migrate users --fake-initial failed while repairing heritage_data/users order: {exc}"
            ) from exc

        self.stdout.write(
            self.style.SUCCESS("Aligned users migration records with existing tables.")
        )

    def _repair_admin_before_users(self) -> None:
        with connection.cursor() as cursor:
            users_n = _count_app_migrations(cursor, "users")
            admin_n = _count_app_migrations(cursor, "admin")

        if users_n > 0:
            self.stdout.write("Migration history OK for admin/users check; skip admin repair.")
            return

        if admin_n == 0:
            self.stdout.write("No admin-only inconsistent state; skip admin repair.")
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
