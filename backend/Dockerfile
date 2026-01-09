# Usa Python 3.11 Slim (Debian Bookworm) per compatibilità pacchetti (postgresql-client-15)
FROM python:3.11-slim-bookworm

# Variabili d'ambiente per ottimizzare Python in Docker
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV TZ=Europe/Rome

WORKDIR /app

# Dipendenze di sistema:
# - postgresql-client-15: pg_dump/pg_restore compatibili con Postgres 15 (immagine DB del progetto)
# - rclone: backup su cloud (OneDrive/Google Drive/Dropbox ecc.)
# - cairo/pango/gdk: rendering PDF (WeasyPrint)
# - curl/ca-certificates/gnupg: utilità
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    postgresql-client-15 \
    rclone \
    libcairo2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    gdk-pixbuf2.0-0 \
    libffi-dev \
    shared-mime-info \
    curl \
    ca-certificates \
    gnupg \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Copia e installa i requirements PRIMA del codice (sfrutta la cache di Docker)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copia il resto del codice
COPY . .

EXPOSE 8000

# Comando di avvio
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
