# Use a lightweight Python base
FROM python:3.13-slim


# Prevent Python from writing .pyc files and buffering stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# Set working directory
WORKDIR /app

# Install system dependencies — add curl if healthchecks or diagnostics are ever needed
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
 && rm -rf /var/lib/apt/lists/*

# Copy and install dependencies first (better for Docker layer caching)
COPY requirements.txt .
RUN pip install --upgrade pip 
RUN pip install --no-cache-dir -r requirements.txt

# Copy project files
COPY . .

# Ensure entrypoint script is executable
RUN chmod +x /app/entrypoint.sh

# Optional: pre-create Django static files if this image is for production
RUN python manage.py collectstatic --noinput || true

# Expose Django's default port
EXPOSE 8000

# Default entrypoint
ENTRYPOINT ["/app/entrypoint.sh"]