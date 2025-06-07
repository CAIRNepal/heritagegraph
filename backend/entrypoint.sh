#!/bin/bash

echo "Applying database migrations..."
python manage.py makemigrations --noinput
python manage.py migrate --noinput

echo "Starting Django server..."
exec "$@"
