FROM python:3.12-slim-bookworm AS base-builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY heritage_graph/requirements.txt .

RUN pip install --upgrade pip setuptools wheel && \
    pip wheel --no-cache-dir --no-deps --wheel-dir /build/wheels -r requirements.txt

FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONPATH=/app

RUN useradd -m -u 1000 django

WORKDIR /app/heritage_graph

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    postgresql-client \
    libmagic1 \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-nep \
    tesseract-ocr-script-deva \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

COPY --from=base-builder /build/wheels /wheels
COPY heritage_graph/requirements.txt /tmp/requirements.txt

RUN pip install --upgrade pip && \
    pip install --no-cache /wheels/*

COPY ./heritage_graph /app/heritage_graph
COPY ./ontology /app/ontology
COPY ./tools /app/tools

RUN mkdir -p /app/heritage_graph/staticfiles /app/heritage_graph/media /app/schema-overlay && \
    chown -R django:django /app && \
    chmod +x /app/heritage_graph/entrypoint.sh

USER django

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health/ || exit 1

ENTRYPOINT ["/app/heritage_graph/entrypoint.sh"]
CMD ["gunicorn", "heritage_graph.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "4", "--worker-class", "sync", "--max-requests", "1000", "--max-requests-jitter", "100", "--timeout", "60", "--access-logfile", "-", "--error-logfile", "-"]
