# Guida Deployment Sistema54-RIT

## Setup Iniziale

### 1. Creare la Rete Docker

```bash
docker network create sistema54-network
```

### 2. Configurare Variabili d'Ambiente

Copia `.env.example` in `.env` e modifica i valori:

```bash
cp .env.example .env
# Modifica .env con i tuoi valori
```

**Variabili Critiche da Modificare**:
- `JWT_SECRET`: Genera una stringa casuale sicura (minimo 32 caratteri)
- `POSTGRES_PASSWORD`: Password forte per database
- `PGADMIN_PASSWORD`: Password forte per pgAdmin
- `FRONTEND_URL`: URL pubblico del frontend (se usi reverse proxy)
- `BASE_URL`: URL base dell'applicazione

### 3. Build e Avvio con Portainer

```bash
# Build delle immagini
docker compose -f docker-compose.portainer.prod.yml build

# Avvio dei container
docker compose -f docker-compose.portainer.prod.yml up -d

# Verifica stato
docker compose -f docker-compose.portainer.prod.yml ps
```

### 4. Accesso ai Servizi

- **Frontend**: `http://[HOST]:${FRONTEND_PORT:-26080}`
- **Backend API**: `http://[HOST]:${BACKEND_PORT:-26100}`
- **pgAdmin**: `http://[HOST]:${PGADMIN_PORT:-26150}`

**Credenziali pgAdmin**:
- Email: `admin@sistema54.com` (o valore di `PGADMIN_EMAIL`)
- Password: `sistema54admin` (o valore di `PGADMIN_PASSWORD`)

**Configurazione Server PostgreSQL in pgAdmin**:
- Host: `sistema54_db` (nome del container)
- Port: `5432`
- Username: Valore di `POSTGRES_USER`
- Password: Valore di `POSTGRES_PASSWORD`
- Database: Valore di `POSTGRES_DB`

## Variabili d'Ambiente

### Backend

| Variabile | Default | Descrizione |
|-----------|---------|-------------|
| `DATABASE_URL` | Auto-generata | URL completo database (non modificare manualmente) |
| `DB_HOST` | `db` | Host database |
| `DB_PORT` | `5432` | Porta database interno |
| `DB_NAME` | `sistema54_db` | Nome database |
| `DB_USER` | `admin` | Username database |
| `DB_PASSWORD` | `sistema54secure` | Password database |
| `JWT_SECRET` | `change-me-in-prod` | **DA MODIFICARE**: Chiave segreta per JWT |
| `CORS_ORIGINS` | `*` | Origini permesse per CORS |
| `FRONTEND_URL` | - | URL completo frontend (per email links) |
| `BASE_URL` | - | URL base applicazione |
| `FRONTEND_PORT` | `26080` | Porta frontend (per fallback URL) |
| `TZ` | `Europe/Rome` | Timezone |

### Frontend

| Variabile | Default | Descrizione |
|-----------|---------|-------------|
| `VITE_BACKEND_PORT` | `26100` | Porta backend (per costruzione URL) |
| `VITE_API_URL` | - | URL backend completo (override) |
| `VITE_ALLOWED_HOSTS` | - | Host permessi (separati da virgola) |

### Database

| Variabile | Default | Descrizione |
|-----------|---------|-------------|
| `POSTGRES_USER` | `admin` | Username PostgreSQL |
| `POSTGRES_PASSWORD` | `sistema54secure` | **DA MODIFICARE**: Password PostgreSQL |
| `POSTGRES_DB` | `sistema54_db` | Nome database |
| `DB_PORT` | `26200` | Porta esposta su host |

### pgAdmin

| Variabile | Default | Descrizione |
|-----------|---------|-------------|
| `PGADMIN_EMAIL` | `admin@sistema54.com` | Email login pgAdmin |
| `PGADMIN_PASSWORD` | `sistema54admin` | **DA MODIFICARE**: Password pgAdmin |
| `PGADMIN_PORT` | `26150` | Porta esposta su host |

## Network Configuration

La rete `sistema54-network` deve essere creata prima del primo avvio:

```bash
docker network create sistema54-network
```

Tutti i container comunicano tramite questa rete usando i nomi dei servizi come hostname:
- `db` per PostgreSQL
- `backend` per FastAPI
- `frontend` per React
- `pgadmin` per pgAdmin

## Backup e Restore

### Backup Manuale

```bash
# Backup completo
docker compose -f docker-compose.portainer.prod.yml exec backend python -m app.services.backup_service

# O tramite API
curl -X POST http://localhost:26100/api/backups/create
```

### Restore

```bash
# Restore da file
docker compose -f docker-compose.portainer.prod.yml exec backend python -m app.services.backup_service restore [BACKUP_ID]
```

## Troubleshooting

### Container non parte

1. Verifica che la rete esista: `docker network ls | grep sistema54-network`
2. Controlla i log: `docker compose -f docker-compose.portainer.prod.yml logs [SERVICE]`
3. Verifica variabili d'ambiente: `docker compose -f docker-compose.portainer.prod.yml config`

### Database connection refused

1. Verifica che il container `sistema54_db` sia in esecuzione
2. Controlla che le variabili `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` siano corrette
3. Verifica che il healthcheck del database sia passato

### Frontend non si connette al backend

1. Verifica `VITE_BACKEND_PORT` o `VITE_API_URL` nel frontend
2. Controlla CORS: `CORS_ORIGINS` deve includere l'URL del frontend
3. Verifica che il backend sia raggiungibile: `curl http://localhost:26100/api/auth/me`

### pgAdmin non si connette al database

1. Usa il nome del container (`sistema54_db`) come host, non `localhost`
2. Porta: `5432` (porta interna, non quella esposta)
3. Verifica username e password

## Migrazioni Database

Le migrazioni vengono eseguite automaticamente all'avvio del backend tramite `init_migrations.py`.

Per migrazioni manuali:

```bash
docker compose -f docker-compose.portainer.prod.yml exec backend python /app/migrate_add_soft_delete.py
```

## Aggiornamenti

```bash
# 1. Pull ultime modifiche
git pull

# 2. Rebuild immagini
docker compose -f docker-compose.portainer.prod.yml build --no-cache

# 3. Riavvia container
docker compose -f docker-compose.portainer.prod.yml up -d

# 4. Verifica log
docker compose -f docker-compose.portainer.prod.yml logs -f
```

## Produzione

### Checklist Pre-Deploy

- [ ] Cambiato `JWT_SECRET` con valore sicuro casuale
- [ ] Cambiato `POSTGRES_PASSWORD` con password forte
- [ ] Cambiato `PGADMIN_PASSWORD` con password forte
- [ ] Configurato `CORS_ORIGINS` con domini specifici (non `*`)
- [ ] Configurato `FRONTEND_URL` se si usa reverse proxy
- [ ] Configurato HTTPS se applicabile
- [ ] Backup del database esistente
- [ ] Testato in ambiente di staging

### Reverse Proxy (Nginx)

Esempio configurazione Nginx:

```nginx
server {
    listen 80;
    server_name sistema54.example.com;

    location / {
        proxy_pass http://localhost:26080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api {
        proxy_pass http://localhost:26100;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### SSL/TLS

Usa Let's Encrypt con Certbot:

```bash
sudo certbot --nginx -d sistema54.example.com
```

Configura `FRONTEND_URL=https://sistema54.example.com` dopo aver configurato SSL.

## Monitoring

### Log

```bash
# Tutti i log
docker compose -f docker-compose.portainer.prod.yml logs -f

# Log specifico servizio
docker compose -f docker-compose.portainer.prod.yml logs -f backend
docker compose -f docker-compose.portainer.prod.yml logs -f frontend
docker compose -f docker-compose.portainer.prod.yml logs -f db
```

### Health Checks

```bash
# Backend
curl http://localhost:26100/api/auth/me

# Database
docker compose -f docker-compose.portainer.prod.yml exec db pg_isready -U admin
```
