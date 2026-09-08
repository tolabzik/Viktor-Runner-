FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DATA_DIR=/data
WORKDIR /app
RUN groupadd --gid 10001 runner \
    && useradd --uid 10001 --gid runner --no-create-home --shell /usr/sbin/nologin runner \
    && mkdir /data && chown runner:runner /data
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY --chown=runner:runner app.py ./
COPY --chown=runner:runner app_v3.py ./
COPY --chown=runner:runner public ./public
COPY --chown=runner:runner tools ./tools
USER runner:runner
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/api/health',timeout=3)"
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "1", "--threads", "8", "--worker-tmp-dir", "/tmp", "--timeout", "30", "--access-logfile", "-", "--error-logfile", "-", "app_v3:application"]
