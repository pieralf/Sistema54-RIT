# Setup Portainer - Sistema54-RIT

## Configurazione Stack in Portainer

### 1. Preparazione

Assicurati che la rete Docker esista sul server:
```bash
docker network create sistema54-network
```

### 2. Creazione Stack

In Portainer:
1. Vai su **Stacks** → **Add stack**
2. Nome stack: `sistema54-rit` (o nome a tua scelta)

### 3. Repository Configuration

#### Option A: Git Repository (Consigliato)
- **Repository URL**: URL del tuo repository Git
- **Reference**: `refs/heads/main` (o il tuo branch)
- **Compose path**: `docker-compose.portainer.prod.yml`

#### Option B: Upload File
- Seleziona **Upload** e carica `docker-compose.portainer.prod.yml`

### 4. Environment Variables

Aggiungi queste variabili d'ambiente nello stack:

| Variable | Default | Descrizione | **IMPORTANTE** |
|----------|---------|-------------|----------------|
| `POSTGRES_USER` | `admin` | Username database | ✅ Cambia in produzione |
| `POSTGRES_PASSWORD` | `sistema54secure` | Password database | ✅ **DEVI CAMBIARLA** |
| `POSTGRES_DB` | `sistema54_db` | Nome database | |
| `JWT_SECRET` | `change-me-in-prod` | Chiave JWT | ✅ **DEVI CAMBIARLA** |
| `PGADMIN_PASSWORD` | `sistema54admin` | Password pgAdmin | ✅ Cambia in produzione |
| `BACKEND_PORT` | `26100` | Porta backend | |
| `FRONTEND_PORT` | `26080` | Porta frontend | |
| `DB_PORT` | `26200` | Porta database | |
| `PGADMIN_PORT` | `26150` | Porta pgAdmin | |
| `FRONTEND_URL` | - | URL frontend (per email) | Opzionale |
| `BASE_URL` | - | URL base app | Opzionale |
| `TZ` | `Europe/Rome` | Timezone | |
| `CORS_ORIGINS` | `*` | CORS origins | ⚠️ Cambia in produzione |

**⚠️ CRITICO**: Prima del deploy in produzione:
1. Genera `JWT_SECRET` sicuro (minimo 32 caratteri)
2. Cambia `POSTGRES_PASSWORD` con password forte
3. Cambia `PGADMIN_PASSWORD` con password forte
4. Configura `CORS_ORIGINS` con domini specifici (non `*`)

### 5. Deploy

1. Clicca **Deploy the stack**
2. Attendi che il build completi
3. Verifica i log se ci sono errori

### 6. Verifica Deploy

#### Controlla Container
In Portainer → **Containers**, dovresti vedere:
- `sistema54_db`
- `sistema54_backend`
- `sistema54_frontend`
- `sistema54_pgadmin`

#### Controlla Log
Clicca su ogni container → **Logs** per verificare:
- Database: dovrebbe mostrare `database system is ready to accept connections`
- Backend: dovrebbe mostrare `Application startup complete`
- Frontend: dovrebbe mostrare server Vite avviato

#### Test Accesso
- Frontend: `http://[HOST]:26080`
- Backend API: `http://[HOST]:26100`
- pgAdmin: `http://[HOST]:26150`

### 7. Troubleshooting

#### Errore: "Unable to deploy stack"
Vedi `PORTAINER_TROUBLESHOOTING.md` per diagnosi dettagliata.

**Passi immediati**:
1. Verifica log stack in Portainer
2. Verifica che la rete `sistema54-network` esista
3. Verifica che le porte non siano già in uso
4. Controlla che i file `Dockerfile.portainer` esistano nel repository

#### Errore: "network sistema54-network declared as external, but could not be found"
```bash
docker network create sistema54-network
```

#### Errore Build: "failed to calculate checksum", "/frontend": not found
- Verifica che il repository sia stato clonato correttamente
- Verifica che i file `backend/requirements.txt` e `frontend/package.json` esistano
- Controlla che il build context sia corretto (dovrebbe essere `.`)

#### Container non parte
1. Controlla log del container
2. Verifica variabili d'ambiente
3. Verifica dipendenze (backend aspetta che db sia healthy)

### 8. Aggiornamenti

Per aggiornare lo stack:
1. In Portainer → **Stacks** → Il tuo stack
2. Clicca **Editor**
3. Modifica il compose file se necessario
4. Clicca **Update the stack**
5. Seleziona **Re-pull image** se hai aggiornato immagini
6. Seleziona **Recreate** se hai cambiato configurazione

### 9. Backup e Restore

I volumi Docker vengono preservati automaticamente. Per backup completo:
```bash
# Backup database
docker exec sistema54_db pg_dump -U admin sistema54_db > backup.sql

# Backup volumi (opzionale)
docker run --rm -v sistema54_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/volumes-backup.tar.gz /data
```

### 10. Configurazione pgAdmin

Dopo il deploy:
1. Accedi a `http://[HOST]:26150`
2. Login con `PGADMIN_EMAIL` e `PGADMIN_PASSWORD`
3. Aggiungi server:
   - **Name**: Sistema54 Database
   - **Host**: `sistema54_db` (nome container, non localhost!)
   - **Port**: `5432`
   - **Username**: Valore di `POSTGRES_USER`
   - **Password**: Valore di `POSTGRES_PASSWORD`
   - **Database**: Valore di `POSTGRES_DB`

### 11. Note Importanti

- I build context sono impostati su `.` (root repository) per Portainer
- I Dockerfile.portainer devono essere usati (non i Dockerfile standard)
- La rete `sistema54-network` deve esistere prima del deploy
- Le porte possono essere cambiate tramite variabili d'ambiente
- Non committare mai il file `.env` con password reali
