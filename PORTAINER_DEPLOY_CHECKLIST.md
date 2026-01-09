# Checklist Deploy Portainer - Sistema54-RIT

## ✅ Pre-Deploy Checklist

### 1. Repository GitHub
- [x] File committati su GitHub
- [x] `docker-compose.portainer.prod.yml` presente
- [x] `backend/Dockerfile.portainer` presente
- [x] `frontend/Dockerfile.portainer` presente
- [x] `backend/requirements.txt` presente
- [x] `frontend/package.json` presente

### 2. Server Portainer
- [ ] Network Docker creata: `docker network create sistema54-network`
- [ ] Porte libere: 26080, 26100, 26200, 26150
- [ ] Accesso al server per verificare log

### 3. Configurazione Stack Portainer

#### Repository Settings
- [ ] **Repository URL**: URL completo del repository GitHub
- [ ] **Reference**: `refs/heads/main` (o branch corretto)
- [ ] **Compose path**: `docker-compose.portainer.prod.yml`
- [ ] **Compose file**: Seleziona il file nel repository

#### Environment Variables
Imposta in **Environment variables** dello stack:

**Obbligatorie (da modificare in produzione)**:
- [ ] `JWT_SECRET` = [genera chiave casuale 32+ caratteri]
- [ ] `POSTGRES_PASSWORD` = [password forte]
- [ ] `PGADMIN_PASSWORD` = [password forte]

**Opzionali (hanno default)**:
- [ ] `POSTGRES_USER` = `admin` (default OK)
- [ ] `POSTGRES_DB` = `sistema54_db` (default OK)
- [ ] `BACKEND_PORT` = `26100` (default OK)
- [ ] `FRONTEND_PORT` = `26080` (default OK)
- [ ] `DB_PORT` = `26200` (default OK)
- [ ] `PGADMIN_PORT` = `26150` (default OK)
- [ ] `TZ` = `Europe/Rome` (default OK)

### 4. Verifica Pre-Deploy

Prima di cliccare "Deploy", verifica:

```bash
# Sul server Portainer
docker network ls | grep sistema54-network
# Dovrebbe mostrare la rete

docker ps -a | grep sistema54
# Non dovrebbero esserci container esistenti con nomi in conflitto
```

## 🚀 Deploy

1. Clicca **Deploy the stack**
2. Attendi che il build completi (può richiedere 5-10 minuti)
3. **NON chiudere la pagina** durante il build

## 🔍 Post-Deploy Verification

### Verifica Container

In Portainer → **Containers**, dovresti vedere 4 container:
- [ ] `sistema54_db` - Status: Running
- [ ] `sistema54_backend` - Status: Running
- [ ] `sistema54_frontend` - Status: Running
- [ ] `sistema54_pgadmin` - Status: Running

### Verifica Log

#### Database
Clicca su `sistema54_db` → **Logs**, cerca:
- [x] `database system is ready to accept connections`

#### Backend
Clicca su `sistema54_backend` → **Logs**, cerca:
- [x] `Bootstrap schema completato`
- [x] `Application startup complete`
- [x] `Uvicorn running on http://0.0.0.0:8000`

#### Frontend
Clicca su `sistema54_frontend` → **Logs**, cerca:
- [x] `VITE vX.X.X ready in XXX ms`
- [x] Server avviato sulla porta 5173

### Test Accesso

- [ ] Frontend: `http://[SERVER_IP]:26080` → Dovrebbe caricare l'app
- [ ] Backend API: `http://[SERVER_IP]:26100/docs` → Dovrebbe mostrare Swagger
- [ ] pgAdmin: `http://[SERVER_IP]:26150` → Dovrebbe mostrare login

### Test Funzionale

- [ ] Login con `admin@sistema54.it` funziona
- [ ] Creazione nuovo utente funziona
- [ ] Accesso pgAdmin e connessione al database funziona

## ❌ Se il Deploy Fallisce

### Errore: "Unable to deploy stack"

**Passo 1**: Verifica log dettagliati
- In Portainer → **Stacks** → Il tuo stack
- Clicca **Inspect** o **View logs**
- Cerca errori specifici

**Passo 2**: Verifica network
```bash
docker network ls | grep sistema54-network
# Se non esiste:
docker network create sistema54-network
```

**Passo 3**: Verifica file nel repository
- Assicurati che i file Dockerfile.portainer siano committati
- Verifica che il percorso del compose file sia corretto

**Passo 4**: Test build locale
```bash
# Clona repository
git clone [YOUR_REPO_URL]
cd Sistema54-RIT

# Test build backend
docker build -f backend/Dockerfile.portainer -t test-backend .

# Test build frontend
docker build -f frontend/Dockerfile.portainer -t test-frontend .
```

**Passo 5**: Verifica sintassi docker-compose
```bash
docker compose -f docker-compose.portainer.prod.yml config
# Dovrebbe validare senza errori
```

## 📝 Note

- Il primo build può richiedere 10-15 minuti
- Se il build fallisce, Portainer potrebbe non mostrare log dettagliati immediatamente
- Controlla i log Docker direttamente sul server se necessario: `docker logs [container_name]`
