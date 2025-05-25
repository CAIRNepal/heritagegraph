#!/bin/bash

# Wait for the database to be available (can be modified as per your DB setup)
# This is useful if your DB is hosted in another container
echo "Waiting for database to be ready..."
# while ! nc -z db 5432; do
#   sleep 1
# done
echo "Database is ready."

# Apply database migrations
echo "Running migrations..."
python manage.py migrate --noinput

# Create a superuser if it doesn't already exist (you can customize this part)
if [ "$DJANGO_SUPERUSER_USERNAME" ] && [ "$DJANGO_SUPERUSER_PASSWORD" ] && [ "$DJANGO_SUPERUSER_EMAIL" ]; then
  echo "Creating superuser..."
  python manage.py createsuperuser --noinput \
    --username $DJANGO_SUPERUSER_USERNAME \
    --email $DJANGO_SUPERUSER_EMAIL
fi

# Start the Django development server or any other command you want
exec "$@"
