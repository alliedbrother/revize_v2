#!/bin/bash
set -e

echo "DEBUG: DATABASE_URL structure (password masked):"
echo "$DATABASE_URL" | sed 's/:\/\/[^:]*:[^@]*@/:\/\/USER:****@/'

echo "Running database migrations..."
python manage.py migrate --noinput

echo "Collecting static files..."
python manage.py collectstatic --noinput

echo "Starting application..."
exec "$@"
