# Troubleshooting Deployment Portainer

## Errore: "Unable to deploy stack"

Questo errore generico può avere diverse cause. Segui questi passaggi per diagnosticare:

### 1. Verifica Log Dettagliati

In Portainer:
1. Vai su **Stacks** → Il tuo stack
2. Clicca su **View logs** o **Inspect**
3. Cerca errori specifici nel build o nel deploy

### 2. Problemi Comuni

#### A. Network Non Esiste
**Errore**: `network sistema54-network declared as external, but could not be found`

**Soluzione**:
```bash
# Connettiti al server dove gira Portainer
docker network create sistema54-network
```

#### B. Permessi File
**Errore**: Permission denied durante build

**Soluzione**: Verifica che Portainer abbia accesso ai file del repository

#### C. Build Context
**Errore**: `failed to calculate checksum`, `not found`

**Verifica**:
- Il repository è stato clonato correttamente?
- I file `backend/requirements.txt` e `frontend/package.json` esistono?
- I Dockerfile.portainer sono presenti?

#### D. Porte Già In Uso
**Errore**: `port is already allocated`

**Soluzione**: 
- Cambia le porte in `.env` o nelle variabili d'ambiente di Portainer
- Verifica container esistenti: `docker ps -a`

### 3. Verifica Configurazione Stack in Portainer

#### Repository URL
Assicurati che:
- L'URL del repository sia corretto
- Le credenziali di accesso siano valide
- Il branch/ref sia corretto (es: `refs/heads/main`)

#### File Compose
Assicurati che:
- Il file compose sia `docker-compose.portainer.prod.yml`
- Il percorso relativo sia corretto nella configurazione Portainer

#### Variabili d'Ambiente
Imposta in Portainer (Stack → Environment variables):
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `JWT_SECRET`
- `BACKEND_PORT`
- `FRONTEND_PORT`
- `DB_PORT`
- `PGADMIN_PORT`

### 4. Test Locale del Build

Prima di deployare, testa localmente:

```bash
# Clona il repository
git clone [YOUR_REPO_URL]
cd Sistema54-RIT

# Verifica che i file esistano
ls -la backend/requirements.txt
ls -la frontend/package.json
ls -la backend/Dockerfile.portainer
ls -la frontend/Dockerfile.portainer

# Test build backend
docker build -f backend/Dockerfile.portainer -t test-backend .

# Test build frontend
docker build -f frontend/Dockerfile.portainer -t test-frontend .
```

### 5. Verifica Dockerfile.portainer

I Dockerfile.portainer devono:
- Usare `COPY backend/...` o `COPY frontend/...` (non `COPY ./backend/...`)
- Il context deve essere la root (`.`)
- Tutti i file referenziati devono esistere

### 6. Comandi Diagnostici

#### Verifica Network
```bash
docker network ls | grep sistema54-network
```

#### Verifica Volumi
```bash
docker volume ls | grep sistema54
```

#### Verifica Container Esistenti
```bash
docker ps -a | grep sistema54
```

#### Pulisci Build Cache (se necessario)
```bash
docker system prune -a
```

### 7. Build Manuale per Debug

Se il build fallisce, prova a buildare manualmente ogni servizio:

```bash
# Backend
cd /path/to/repo
docker build -f backend/Dockerfile.portainer -t sistema54-backend:test --build-arg BUILDKIT_INLINE_CACHE=1 .

# Frontend
docker build -f frontend/Dockerfile.portainer -t sistema54-frontend:test --build-arg BUILDKIT_INLINE_CACHE=1 .
```

### 8. Log Portainer Dettagliati

Per vedere log più dettagliati:
1. Vai su **Stacks** → Il tuo stack
2. Clicca su **Editor** per vedere il file compose
3. Verifica che non ci siano errori di sintassi YAML
4. Usa **Inspect** per vedere errori Docker

### 9. Problemi Specifici Portainer

#### Repository Branch
Se usi un branch diverso da `main`:
- Nella configurazione stack, specifica: `refs/heads/[BRANCH_NAME]`

#### Compose File Path
Se il file non è nella root:
- Specifica il percorso corretto in **Compose path** (es: `subfolder/docker-compose.portainer.prod.yml`)

#### Build Arguments
Se servono build args, aggiungi in docker-compose:
```yaml
build:
  context: .
  dockerfile: backend/Dockerfile.portainer
  args:
    - BUILDKIT_INLINE_CACHE=1
```

### 10. Alternativa: Deploy Manuale

Se Portainer continua a dare problemi, puoi deployare manualmente:

```bash
# 1. Clona repository sul server
git clone [YOUR_REPO_URL] /path/to/sistema54

# 2. Vai nella directory
cd /path/to/sistema54

# 3. Crea network
docker network create sistema54-network

# 4. Crea .env
cp .env.example .env
# Modifica .env con i tuoi valori

# 5. Deploy
docker compose -f docker-compose.portainer.prod.yml up -d --build

# 6. Verifica
docker compose -f docker-compose.portainer.prod.yml ps
docker compose -f docker-compose.portainer.prod.yml logs -f
```

### 11. Richiedi Supporto

Se il problema persiste, fornisci:
1. Log completi dal build (copia dalla console Portainer)
2. Output di `docker network ls`
3. Output di `docker ps -a`
4. Versione di Portainer
5. Versione di Docker sul server
