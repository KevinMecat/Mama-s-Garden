FROM python:3.13-slim@sha256:57b29a7c050c4e679e4bea572e14b3965cf4b5839de2da49d55e49ffc4024f39 AS base

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /workspace/apps/api

FROM base AS development
COPY apps/api/requirements.txt apps/api/requirements-dev.txt ./
RUN pip install --no-cache-dir -r requirements-dev.txt

COPY apps/api .

EXPOSE 8000

CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]

FROM python:3.13-slim@sha256:57b29a7c050c4e679e4bea572e14b3965cf4b5839de2da49d55e49ffc4024f39 AS builder
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
RUN python -m venv /opt/venv
COPY apps/api/requirements-prod.lock /tmp/requirements-prod.lock
RUN /opt/venv/bin/pip install --no-cache-dir --require-hashes -r /tmp/requirements-prod.lock
WORKDIR /app/apps/api
COPY apps/api .
RUN DJANGO_SECRET_KEY=build-only-not-a-secret DATABASE_URL=sqlite://:memory: \
    /opt/venv/bin/python manage.py collectstatic --noinput --settings=config.settings.build
RUN /opt/venv/bin/pip uninstall -y pip
RUN find modules -type f -name tests.py -delete

FROM python:3.13-slim@sha256:57b29a7c050c4e679e4bea572e14b3965cf4b5839de2da49d55e49ffc4024f39 AS production
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PATH=/opt/venv/bin:$PATH \
    DJANGO_SETTINGS_MODULE=config.settings.production
RUN groupadd --gid 10001 finca && useradd --uid 10001 --gid finca --no-create-home finca
WORKDIR /app/apps/api
COPY --from=builder /opt/venv /opt/venv
COPY --from=builder --chown=finca:finca /app/apps/api/config ./config
COPY --from=builder --chown=finca:finca /app/apps/api/modules ./modules
COPY --from=builder --chown=finca:finca /app/apps/api/manage.py ./manage.py
COPY --from=builder --chown=finca:finca /app/apps/api/staticfiles ./staticfiles
COPY config/environment.example /app/config/environment.example
COPY scripts/verify_prod_env.py /app/scripts/verify_prod_env.py
COPY scripts/audit_python_runtime.py /app/scripts/audit_python_runtime.py
RUN mkdir -p media && chown finca:finca media && python /app/scripts/audit_python_runtime.py
USER finca
EXPOSE 8000
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3", "--threads", "2", "--timeout", "60", "--access-logfile", "/dev/null", "--error-logfile", "-"]
