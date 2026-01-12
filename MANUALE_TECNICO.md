# Manuale Tecnico - GIT (Gestione Interventi Tecnici)

## Indice
1. [Panoramica](#panoramica)
2. [Requisiti di Sistema](#requisiti-di-sistema)
3. [Installazione](#installazione)
4. [Configurazione Iniziale](#configurazione-iniziale)
5. [Credenziali di Default](#credenziali-di-default)
6. [Architettura](#architettura)
7. [Configurazione Database](#configurazione-database)
8. [Configurazione Backend](#configurazione-backend)
9. [Configurazione Frontend](#configurazione-frontend)
10. [App Android](#app-android)
11. [Deployment](#deployment)
12. [Troubleshooting](#troubleshooting)
13. [Manutenzione](#manutenzione)

---

## Panoramica

**GIT - Gestione Interventi Tecnici** è un sistema gestionale completo per la gestione di interventi tecnici, clienti, asset, contratti e documentazione.

### Caratteristiche Principali
- Gestione completa interventi tecnici
- Gestione clienti e sedi
- Gestione asset e inventario
- Gestione contratti di assistenza
- Sistema di backup automatico
- Autenticazione a due fattori (2FA)
- App Android con VPN WireGuard integrata
- Interfaccia web moderna e responsive

### Stack Tecnologico
- **Backend**: FastAPI (Python 3.11+)
- **Frontend**: React + TypeScript + Vite
- **Database**: PostgreSQL 15
- **Containerizzazione**: Docker + Docker Compose
- **App Mobile**: Android (Kotlin) con WireGuard VPN

---

## Requisiti di Sistema

### Server
- **OS**: Linux (Ubuntu 20.04+ / Debian 11+ / CentOS 8+) o Windows Server con Docker
- **RAM**: Minimo 4GB (consigliato 8GB+)
- **CPU**: Minimo 2 core (consigliato 4+)
- **Disco**: Minimo 20GB liberi (consigliato 50GB+)
- **Rete**: Accesso LAN aziendale

### Software Richiesto
- Docker Engine 20.10+
- Docker Compose 2.0+
- (Opzionale) Portainer per gestione UI

### Client
- **Browser**: Chrome 90+, Firefox 88+, Edge 90+, Safari 14+
- **App Android**: Android 7.0+ (API 24+)

---

## Installazione

### 1. Clonare il Repository

```bash
git clone <repository-url>
cd Sistema54-RIT
```

### 2. Configurare Variabili d'Ambiente

Crea un file `.env` nella root del progetto:

```bash
# Database
POSTGRES_USER=admin
POSTGRES_PASSWORD=sistema54secure
POSTGRES_DB=sistema54_db
DB_PORT=26201

# Backend
BACKEND_PORT=26101
JWT_SECRET=<genera-stringa-casuale-minimo-32-caratteri>
CORS_ORIGINS=*

# Frontend
FRONTEND_PORT=26080
VITE_BACKEND_PORT=26101

# pgAdmin
PGADMIN_EMAIL=admin@sistema54.com
PGADMIN_PASSWORD=sistema54admin
PGADMIN_PORT=26151

# Timezone
TZ=Europe/Rome
```

**⚠️ IMPORTANTE**: Modifica `JWT_SECRET` e `POSTGRES_PASSWORD` con valori sicuri prima del deployment in produzione!

### 3. Avviare i Servizi

#### Opzione A: Docker Compose Standard

```bash
docker compose -f docker-compose.desktop.prod.namedvol.yml up -d
```

#### Opzione B: Portainer

```bash
docker compose -f docker-compose.portainer.prod.yml up -d
```

### 4. Verificare lo Stato

```bash
docker compose ps
```

Tutti i servizi dovrebbero essere in stato `Up`.

### 5. Inizializzare il Database

Il database viene inizializzato automaticamente all'avvio del backend. Per creare/resettare l'utente superadmin:

```bash
docker compose exec backend python create_admin.py
```

---

## Configurazione Iniziale

### 1. Accesso al Sistema

Apri il browser e naviga a:
```
http://<IP-SERVER>:26080
```

### 2. Login con Credenziali Default

Vedi sezione [Credenziali di Default](#credenziali-di-default).

### 3. Configurazione Azienda

Dopo il primo login:
1. Vai su **Impostazioni** → **Azienda**
2. Inserisci i dati aziendali:
   - Nome azienda
   - Partita IVA
   - Indirizzo
   - Email
   - Telefono
   - Logo (opzionale)

### 4. Cambio Password SuperAdmin

**⚠️ OBBLIGATORIO**: Cambia immediatamente la password del superadmin dopo il primo accesso!

1. Vai su **Impostazioni** → **Profilo**
2. Clicca su **Cambia Password**
3. Inserisci nuova password sicura

---

## Credenziali di Default

### SuperAdmin

**⚠️ CRITICO**: Queste credenziali sono valide solo per la prima installazione. Cambia immediatamente la password dopo il primo accesso!

- **Email**: `git@git.it`
- **Password**: `git@4683`
- **Ruolo**: SuperAdmin (accesso completo a tutte le funzionalità)

#### Creare/Resettare SuperAdmin

```bash
# Entra nel container backend
docker compose exec backend bash

# Esegui lo script
python create_admin.py
```

Lo script:
- Crea l'utente se non esiste
- Resetta la password se l'utente esiste già
- Verifica che le credenziali funzionino

**Output atteso**:
```
✅ Nuovo SuperAdmin creato: git@git.it
✅ Verifica password: OK

📋 Credenziali di accesso:
   Email: git@git.it
   Password: git@4683
```

### pgAdmin

- **Email**: `admin@sistema54.com` (o valore di `PGADMIN_EMAIL`)
- **Password**: `sistema54admin` (o valore di `PGADMIN_PASSWORD`)
- **URL**: `http://<IP-SERVER>:26151`

#### Configurazione Server PostgreSQL in pgAdmin

1. Login in pgAdmin
2. Clicca destro su **Servers** → **Create** → **Server**
3. Tab **General**:
   - Name: `Sistema54 DB`
4. Tab **Connection**:
   - Host: `db` (nome del container)
   - Port: `5432`
   - Username: Valore di `POSTGRES_USER` (default: `admin`)
   - Password: Valore di `POSTGRES_PASSWORD` (default: `sistema54secure`)
   - Database: Valore di `POSTGRES_DB` (default: `sistema54_db`)
5. Tab **SSL**:
   - SSL mode: `Prefer`
6. Clicca **Save**

---

## Architettura

### Componenti Principali

```
┌─────────────────────────────────────────────────┐
│                  CLIENT                         │
│  ┌──────────────┐         ┌──────────────┐    │
│  │   Browser    │         │ Android App  │    │
│  │   (React)    │         │  (Kotlin)    │    │
│  └──────┬───────┘         └──────┬───────┘    │
└─────────┼────────────────────────┼────────────┘
          │                        │
          │ HTTP/REST API          │ VPN + HTTP
          │                        │
┌─────────┼────────────────────────┼────────────┐
│         ▼                        ▼            │
│  ┌──────────────────────────────────────┐      │
│  │         NGINX (opzionale)            │      │
│  └──────────────────────────────────────┘      │
│         │                        │             │
│         ▼                        ▼             │
│  ┌──────────────┐         ┌──────────────┐   │
│  │   Frontend   │         │   Backend    │   │
│  │   (Vite)     │         │  (FastAPI)   │   │
│  │   Port 5173  │         │   Port 8000  │   │
│  └──────────────┘         └──────┬───────┘   │
│                                   │           │
│                                   ▼           │
│                          ┌──────────────┐     │
│                          │  PostgreSQL  │     │
│                          │   Port 5432  │     │
│                          └──────────────┘     │
└───────────────────────────────────────────────┘
```

### Porte Standard

| Servizio | Porta Interna | Porta Esterna (Default) |
|----------|---------------|-------------------------|
| Frontend | 5173 | 26080 |
| Backend | 8000 | 26101 |
| Database | 5432 | 26201 |
| pgAdmin | 80 | 26151 |

### Rete Docker

Tutti i container comunicano tramite la rete Docker `sistema54-network` (bridge).

---

## Configurazione Database

### Struttura Database

Il database PostgreSQL contiene le seguenti tabelle principali:
- `utenti`: Utenti del sistema
- `clienti`: Anagrafica clienti
- `sedi`: Sedi dei clienti
- `interventi`: Interventi tecnici
- `asset`: Asset e dispositivi
- `contratti`: Contratti di assistenza
- `impostazioni_azienda`: Configurazione azienda
- `backup_targets`: Configurazione backup
- E altre...

### Backup Manuale

```bash
# Backup completo
docker compose exec db pg_dump -U admin sistema54_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Backup compresso
docker compose exec db pg_dump -U admin sistema54_db | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

### Ripristino Backup

```bash
# Da file SQL
docker compose exec -T db psql -U admin sistema54_db < backup.sql

# Da file compresso
gunzip < backup.sql.gz | docker compose exec -T db psql -U admin sistema54_db
```

### Migrazioni Database

Le migrazioni vengono eseguite automaticamente all'avvio del backend tramite `init_migrations.py`.

Per eseguire migrazioni manuali:

```bash
docker compose exec backend python init_migrations.py
```

---

## Configurazione Backend

### Variabili d'Ambiente

| Variabile | Default | Descrizione |
|-----------|---------|-------------|
| `DATABASE_URL` | Auto-generata | URL completo database PostgreSQL |
| `JWT_SECRET` | `change-me-in-prod` | **DA MODIFICARE**: Chiave segreta JWT |
| `CORS_ORIGINS` | `*` | Origini permesse per CORS |
| `TZ` | `Europe/Rome` | Timezone |

### Log Backend

```bash
# Visualizza log in tempo reale
docker compose logs -f backend

# Ultimi 100 log
docker compose logs --tail=100 backend
```

### API Endpoints Principali

- `POST /api/auth/login` - Login utente
- `GET /api/auth/me` - Info utente corrente
- `GET /api/clienti` - Lista clienti
- `GET /api/interventi` - Lista interventi
- `GET /api/impostazioni/azienda` - Impostazioni azienda
- E altri...

Documentazione API completa disponibile su: `http://<IP-SERVER>:26101/docs`

---

## Configurazione Frontend

### Variabili d'Ambiente

| Variabile | Default | Descrizione |
|-----------|---------|-------------|
| `VITE_BACKEND_PORT` | `26101` | Porta backend |
| `VITE_API_URL` | - | URL backend completo (override) |

### Build Frontend

```bash
cd frontend
npm install
npm run build
```

Output in `frontend/dist/`.

### Sviluppo Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend disponibile su `http://localhost:5173`.

---

## App Android

### Requisiti
- Android 7.0+ (API 24+)
- Permesso VPN
- File `.conf` WireGuard configurato

### Installazione APK

#### Metodo 1: Via ADB (Consigliato)

```bash
# Collega dispositivo via USB
# Abilita Debug USB sul dispositivo

# Installa APK
adb install android-app/app/build/outputs/apk/debug/app-debug.apk
```

#### Metodo 2: Via File Manager

1. Copia `app-debug.apk` sul dispositivo
2. Apri File Manager
3. Trova e tocca `app-debug.apk`
4. Abilita "Origini sconosciute" se richiesto
5. Installa

### Configurazione VPN

1. Apri app **GIT** sul dispositivo
2. Al primo avvio, tocca **Importa file .conf**
3. Seleziona il file `.conf` WireGuard
4. L'app importa automaticamente la configurazione
5. L'app si connette automaticamente alla VPN
6. Dopo la connessione VPN, si apre automaticamente la web app

### Configurazione URL Web App

L'URL della web app è configurato in:
```
android-app/app/src/main/java/com/sistema54/vpn/VPNConfig.kt
```

Default: `http://10.0.0.1:26080`

Per modificare:
1. Modifica `webAppUrl` in `VPNConfig.kt`
2. Ricompila APK

### Risoluzione Problemi Comuni

#### Errore: `ERR_CLEARTEXT_NOT_PERMITTED`

**Causa**: Android blocca traffico HTTP non criptato.

**Soluzione**: Già implementata nel progetto tramite `network_security_config.xml` che permette HTTP solo su reti private (10.x.x.x, 172.16-31.x.x, 192.168.x.x).

Se il problema persiste:
1. Verifica che `network_security_config.xml` esista in `app/src/main/res/xml/`
2. Verifica che il manifest referenzi il file: `android:networkSecurityConfig="@xml/network_security_config"`
3. Ricompila APK

#### VPN non si connette

1. Verifica che il file `.conf` sia valido
2. Verifica che il server WireGuard sia raggiungibile
3. Verifica permessi VPN sul dispositivo
4. Controlla log Android: `adb logcat | grep -i wireguard`

#### Web app non si apre

1. Verifica che la VPN sia connessa
2. Verifica che l'URL web app sia corretto
3. Verifica che il server web sia raggiungibile dalla rete VPN
4. Controlla log: `adb logcat | grep -i webview`

### Compilazione APK

```bash
cd android-app
./compile_apk.ps1  # Windows PowerShell
# oppure
./gradlew assembleDebug  # Linux/Mac
```

APK generato in: `app/build/outputs/apk/debug/app-debug.apk`

---

## Deployment

### Deployment Locale (Docker Compose)

```bash
# Build e avvio
docker compose -f docker-compose.desktop.prod.namedvol.yml up -d --build

# Verifica stato
docker compose ps

# Log
docker compose logs -f
```

### Deployment con Portainer

Vedi `PORTAINER_SETUP.md` per istruzioni dettagliate.

### Deployment Produzione

1. **Modifica variabili d'ambiente**:
   - `JWT_SECRET`: Genera stringa casuale sicura
   - `POSTGRES_PASSWORD`: Password forte
   - `PGADMIN_PASSWORD`: Password forte

2. **Configura firewall**:
   - Apri solo porte necessarie (26080, 26101, 26151)
   - Blocca accesso esterno a database (26201)

3. **Configura backup automatico**:
   - Vai su Impostazioni → Backup
   - Configura backup locale/NAS/Cloud

4. **Configura SSL/HTTPS** (opzionale):
   - Usa reverse proxy (Nginx/Traefik)
   - Configura certificati SSL

---

## Troubleshooting

### Problema: Frontend non si apre

**Diagnosi**:
```bash
# Verifica container frontend
docker compose ps frontend

# Log frontend
docker compose logs frontend

# Verifica porta
netstat -tuln | grep 26080
```

**Soluzioni**:
- Verifica che il container sia in esecuzione
- Verifica che la porta 26080 non sia occupata
- Riavvia il container: `docker compose restart frontend`

### Problema: Backend non risponde

**Diagnosi**:
```bash
# Verifica container backend
docker compose ps backend

# Log backend
docker compose logs backend

# Test API
curl http://localhost:26101/api/health
```

**Soluzioni**:
- Verifica connessione database
- Verifica log per errori
- Riavvia: `docker compose restart backend`

### Problema: Database non si connette

**Diagnosi**:
```bash
# Verifica container database
docker compose ps db

# Test connessione
docker compose exec db psql -U admin -d sistema54_db -c "SELECT 1;"
```

**Soluzioni**:
- Verifica variabili d'ambiente `DATABASE_URL`
- Verifica che il database sia inizializzato
- Controlla log: `docker compose logs db`

### Problema: Login non funziona

**Soluzioni**:
1. Verifica credenziali superadmin (vedi [Credenziali di Default](#credenziali-di-default))
2. Resetta superadmin: `docker compose exec backend python create_admin.py`
3. Verifica log backend per errori autenticazione
4. Verifica che il database contenga la tabella `utenti`

### Problema: App Android non trova la web app

**Soluzioni**:
1. Verifica che la VPN sia connessa
2. Verifica che l'URL in `VPNConfig.kt` sia corretto
3. Verifica che il server web sia raggiungibile dalla rete VPN
4. Testa connessione: `ping <IP-SERVER>` dal dispositivo (via ADB shell)

---

## Manutenzione

### Backup Regolari

Configura backup automatico in **Impostazioni** → **Backup**:
- Backup locale (giornaliero)
- Backup NAS (opzionale)
- Backup Cloud (opzionale)

### Aggiornamenti

```bash
# Pull ultime modifiche
git pull

# Rebuild e riavvio
docker compose -f docker-compose.desktop.prod.namedvol.yml up -d --build

# Verifica migrazioni database
docker compose exec backend python init_migrations.py
```

### Pulizia Log

```bash
# Pulisci log vecchi (>30 giorni)
find ./backend/logs -name "*.log" -mtime +30 -delete
```

### Monitoraggio

- **Log**: `docker compose logs -f`
- **Risorse**: `docker stats`
- **Database**: pgAdmin su porta 26151

---

## Supporto

Per problemi o domande:
1. Controlla questa documentazione
2. Verifica log: `docker compose logs`
3. Consulta `TROUBLESHOOTING.md` (se disponibile)

---

**Versione Manuale**: 1.0  
**Data**: Gennaio 2026  
**Sistema**: GIT - Gestione Interventi Tecnici
