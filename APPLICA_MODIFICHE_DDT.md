# Guida Applicazione Modifiche DDT

Questa guida spiega come applicare le modifiche appena sviluppate per il sistema DDT (Ritiro Prodotti) usando Docker Compose sia da Desktop che da Portainer.

## ⚠️ IMPORTANTE: Prima di Procedere

1. **Backup del Database**: Esegui un backup del database prima di applicare le modifiche
2. **Verifica Modifiche**: Controlla che tutti i file siano stati modificati correttamente
3. **Migrazione Database**: Le modifiche includono una nuova tabella `ritiri_prodotti` che verrà creata automaticamente

---

## 📋 Modifiche Applicate

### Backend
- ✅ Nuovo modello `RitiroProdotto` in `backend/app/models.py`
- ✅ Nuovi schemi Pydantic in `backend/app/schemas.py`
- ✅ Nuovi endpoint API in `backend/app/main.py`
- ✅ Script migrazione `backend/migrate_ddt_ritiro_prodotti.py`
- ✅ Permessi DDT in `backend/app/utils.py`
- ✅ Directory upload foto: `backend/uploads/ddt_foto/`

### Frontend
- ✅ Componente `CameraCapture` in `frontend/src/components/CameraCapture.tsx`
- ✅ Pagina `NewDDTPage` in `frontend/src/pages/NewDDTPage.tsx`
- ✅ Rotta `/new-ddt` aggiunta in `frontend/src/App.tsx`

---

## 🖥️ Metodo 1: Docker Desktop

### Passo 1: Ferma i Container Esistenti

```powershell
# Windows PowerShell
cd C:\Progetti\Sistema54-RIT
docker-compose -f docker-compose.desktop.prod.namedvol.yml down
```

### Passo 2: Rebuild delle Immagini

```powershell
# Rebuild solo backend e frontend (più veloce)
docker-compose -f docker-compose.desktop.prod.namedvol.yml build backend frontend

# OPPURE rebuild completo (se necessario)
docker-compose -f docker-compose.desktop.prod.namedvol.yml build --no-cache
```

### Passo 3: Avvia i Container

```powershell
docker-compose -f docker-compose.desktop.prod.namedvol.yml up -d
```

### Passo 4: Verifica Migrazione Database

La migrazione viene eseguita automaticamente all'avvio del backend tramite `init_migrations.py`. 

Verifica i log:

```powershell
docker-compose -f docker-compose.desktop.prod.namedvol.yml logs backend | Select-String -Pattern "migrate_ddt|ritiri_prodotti"
```

Dovresti vedere:
```
✅ Campi configurazione alert DDT aggiunti.
✅ Bootstrap schema completato.
```

### Passo 5: Verifica Funzionamento

1. Accedi al frontend: `http://localhost:26080`
2. Verifica che la pagina `/new-ddt` sia accessibile
3. Controlla i log del backend per eventuali errori

---

## 🐳 Metodo 2: Portainer

### Passo 1: Accedi a Portainer

1. Apri Portainer nel browser
2. Vai su **Stacks**
3. Trova lo stack `sistema54` (o il nome che hai dato)

### Passo 2: Ferma lo Stack

1. Clicca sul nome dello stack
2. Clicca su **Stop the stack** (o usa il pulsante stop)
3. Attendi che tutti i container siano fermati

### Passo 3: Rebuild delle Immagini

**Opzione A: Rebuild da Portainer UI**

1. Nello stack, clicca su **Editor**
2. Verifica che il file `docker-compose.portainer.prod.yml` sia aggiornato
3. Clicca su **Update the stack**
4. Seleziona **Recreate the containers** e **Pull and redeploy**
5. Clicca su **Update the stack**

**Opzione B: Rebuild da Terminale (Consigliato)**

Se hai accesso SSH al server:

```bash
cd /path/to/Sistema54-RIT
docker-compose -f docker-compose.portainer.prod.yml build backend frontend
```

Poi in Portainer:
1. Vai nello stack
2. Clicca su **Editor**
3. Clicca su **Update the stack** (senza modifiche, solo per riavviare)

### Passo 4: Avvia lo Stack

1. In Portainer, clicca su **Start the stack**
2. Attendi che tutti i container siano avviati (stato "Running")

### Passo 5: Verifica Migrazione Database

1. In Portainer, vai su **Containers**
2. Trova `sistema54_backend`
3. Clicca su **Logs**
4. Cerca nel log:
   ```
   ✅ Campi configurazione alert DDT aggiunti.
   ✅ Bootstrap schema completato.
   ```

### Passo 6: Verifica Funzionamento

1. Accedi al frontend: `http://<server-ip>:26080`
2. Verifica che la pagina `/new-ddt` sia accessibile
3. Controlla i log del backend in Portainer

---

## 🔍 Verifica Migrazione Database

### Metodo 1: Via pgAdmin

1. Accedi a pgAdmin: `http://localhost:26151` (Desktop) o `http://<server-ip>:26150` (Portainer)
2. Connettiti al database `sistema54_db`
3. Verifica che esista la tabella `ritiri_prodotti`:
   ```sql
   SELECT * FROM information_schema.tables 
   WHERE table_name = 'ritiri_prodotti';
   ```
4. Verifica i nuovi campi in `impostazioni_azienda`:
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'impostazioni_azienda' 
   AND column_name LIKE 'ddt%';
   ```

### Metodo 2: Via Container Backend

```powershell
# Desktop
docker-compose -f docker-compose.desktop.prod.namedvol.yml exec backend python -c "from app.database import engine; from sqlalchemy import inspect; inspector = inspect(engine); print('Tabelle:', inspector.get_table_names())"

# Portainer (via SSH)
docker exec sistema54_backend python -c "from app.database import engine; from sqlalchemy import inspect; inspector = inspect(engine); print('Tabelle:', inspector.get_table_names())"
```

---

## 🐛 Troubleshooting

### Errore: "Table already exists"

Se vedi questo errore, significa che la migrazione è già stata applicata. È normale, puoi continuare.

### Errore: "Column already exists"

Stesso discorso: i campi sono già stati aggiunti. Nessun problema.

### Container Backend non si avvia

1. Controlla i log:
   ```powershell
   docker-compose -f docker-compose.desktop.prod.namedvol.yml logs backend
   ```
2. Verifica che il database sia raggiungibile
3. Verifica le variabili d'ambiente

### Frontend non mostra la nuova pagina

1. Verifica che il build sia completato:
   ```powershell
   docker-compose -f docker-compose.desktop.prod.namedvol.yml logs frontend
   ```
2. Pulisci la cache del browser (Ctrl+Shift+R)
3. Verifica che il file `NewDDTPage.tsx` sia presente

### Errore Permessi

Se vedi errori di permessi, verifica che:
1. L'utente abbia i permessi DDT assegnati
2. SuperAdmin abbia automaticamente tutti i permessi
3. I permessi siano stati aggiornati nel database

---

## ✅ Checklist Post-Deploy

- [ ] Database migrato correttamente (tabella `ritiri_prodotti` esiste)
- [ ] Campi DDT aggiunti a `impostazioni_azienda`
- [ ] Backend avviato senza errori
- [ ] Frontend compilato correttamente
- [ ] Pagina `/new-ddt` accessibile
- [ ] Componente telecamera funzionante
- [ ] Upload foto funzionante
- [ ] Creazione DDT funzionante
- [ ] Firme salvate correttamente

---

## 📝 Note Importanti

1. **Volumi**: 
   - Desktop usa bind mount (`./backend/uploads`)
   - Portainer usa named volumes (`sistema54_uploads`)
   - Le foto DDT verranno salvate in entrambi i casi nella directory corretta

2. **Migrazioni**: 
   - Le migrazioni vengono eseguite automaticamente all'avvio del backend
   - Se una migrazione è già stata applicata, viene saltata automaticamente

3. **Permessi**: 
   - I nuovi permessi DDT sono già inclusi nei permessi di default per SuperAdmin e Admin
   - Gli altri utenti devono avere i permessi assegnati manualmente

4. **Foto**: 
   - Le foto vengono salvate in `uploads/ddt_foto/`
   - Supporto per upload da telecamera e da file
   - Le foto vengono caricate dopo la creazione del DDT

---

## 🚀 Comandi Rapidi

### Docker Desktop
```powershell
# Stop
docker-compose -f docker-compose.desktop.prod.namedvol.yml down

# Build + Start
docker-compose -f docker-compose.desktop.prod.namedvol.yml up -d --build

# Logs
docker-compose -f docker-compose.desktop.prod.namedvol.yml logs -f backend
```

### Portainer (via SSH)
```bash
# Stop
docker-compose -f docker-compose.portainer.prod.yml down

# Build + Start
docker-compose -f docker-compose.portainer.prod.yml up -d --build

# Logs
docker-compose -f docker-compose.portainer.prod.yml logs -f backend
```

---

## 📞 Supporto

Se riscontri problemi:
1. Controlla i log dei container
2. Verifica che tutte le modifiche siano state applicate
3. Verifica la connessione al database
4. Controlla che le porte non siano in conflitto
