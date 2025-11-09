#!/bin/bash
set -e

echo "Applying database migrations..."
python manage.py migrate --noinput

echo "Creating superuser if it doesn't exist..."
# # Check if superuser exists
# if ! python manage.py shell -c "from django.contrib.auth import get_user_model; exit(0) if get_user_model().objects.filter(username='$DJANGO_SUPERUSER_USERNAME').exists() else exit(1)"; then
#     # Create superuser non-interactively
#     python manage.py createsuperuser --username "$DJANGO_SUPERUSER_USERNAME" --email "$DJANGO_SUPERUSER_EMAIL" --noinput
#     # Set password
#     python manage.py shell -c "from django.contrib.auth import get_user_model; u = get_user_model().objects.get(username='$DJANGO_SUPERUSER_USERNAME'); u.set_password('$DJANGO_SUPERUSER_PASSWORD'); u.save()"
#     echo "Superuser created successfully."
# else
#     echo "Superuser already exists, skipping creation."
# fi

echo "Starting Django server..."
python manage.py runserver 0.0.0.0:8000
# gunicorn heritage_graph.wsgi:application --bind 0.0.0.0:8000
