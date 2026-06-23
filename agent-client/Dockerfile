FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY scripts ./scripts
COPY assets ./assets

CMD ["python3", "scripts/reference_client.py"]
