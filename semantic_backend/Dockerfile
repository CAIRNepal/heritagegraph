FROM python:3.13-slim AS base
WORKDIR /app
RUN addgroup --system graphapi && adduser --system --ingroup graphapi graphapi

FROM base AS deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

FROM deps AS runtime
COPY --chown=graphapi:graphapi . .
USER graphapi
EXPOSE 8001
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD python -c "import httpx; httpx.get('http://localhost:8001/health').raise_for_status()"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
