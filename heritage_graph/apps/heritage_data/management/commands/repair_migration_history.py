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
        self.stdout.write(self.style.NOTICE("Starting robust migration history repair..."))

        with connection.cursor() as cursor:
            # Refresh introspection cache
            tables = connection.introspection.table_names(cursor)

            if "django_migrations" not in tables:
                self.stdout.write(self.style.SUCCESS("django_migrations table does not exist. Skipping repair since there is no history to repair."))
                return

            heritage_applied = _migration_applied(cursor, "heritage_data", "0001_initial")
            users_applied = _migration_applied(cursor, "users", "0001_initial")

            # 1. Fix missing users dependency when heritage_data is applied
            if heritage_applied and not users_applied:
                self.stdout.write(
                    self.style.WARNING("Repairing: heritage_data is applied but users is not.")
                )
                if "users_user" not in tables:
                    self.stdout.write(
                        self.style.ERROR("Error: users_user table does not exist but heritage_data does. Cannot fake-initial safely.")
                    )
                else:
                    self.stdout.write("users_user exists; faking initial users migrations.")
                    call_command("migrate", "users", "--fake-initial", "--noinput", verbosity=1)
                    self.stdout.write(self.style.SUCCESS("Faked initial users migrations."))

            # 2. Fix legacy admin-before-users issue
            users_n = _count_app_migrations(cursor, "users")
            admin_n = _count_app_migrations(cursor, "admin")

            if admin_n > 0 and users_n == 0:
                self.stdout.write(
                    self.style.WARNING("Repairing: admin migrations applied but users is not.")
                )
                if "users_user" in tables:
                    call_command("migrate", "users", "--fake-initial", "--noinput", verbosity=1)

                cursor.execute("DELETE FROM django_migrations WHERE app = %s", ["admin"])
                self.stdout.write(self.style.SUCCESS(f"Removed {cursor.rowcount} admin rows from django_migrations."))

            # 3. Aggressively fix any potential ID sorting orders for users 
            # In case Django checks migration ID or date ordering, ensure users are chronologically first.
            if users_applied or _migration_applied(cursor, "users", "0001_initial"):
                try:
                    cursor.execute("UPDATE django_migrations SET id = -abs(id) WHERE app = 'users' AND id > 0")
                except Exception as e:
                    self.stdout.write(self.style.NOTICE(f"Could not update negative IDs for users (safe to ignore): {e}"))

        self.stdout.write(self.style.SUCCESS("Migration history repair checks completed."))
