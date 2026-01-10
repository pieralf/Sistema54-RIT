# Setup HTTPS con Nginx e Certificati Auto-firmati

## ✅ Configurazione Completata

- Nginx aggiunto come reverse proxy con supporto HTTPS
- Script per generazione certificati SSL auto-firmati validi 10 anni
- Configurazione nginx con security headers e redirect HTTP → HTTPS

## 📋 Passi per Attivare HTTPS

### 1. Genera i Certificati SSL

**Windows (PowerShell):**
```powershell
.\generate_ssl_certs.ps1 -Domain "tuodominio.local"
```

**Linux/Mac (Bash):**
```bash
chmod +x generate_ssl_certs.sh
./generate_ssl_certs.sh
# Oppure con dominio personalizzato:
SSL_DOMAIN=tuodominio.local ./generate_ssl_certs.sh
```

I certificati verranno generati in `nginx/ssl/`:
- `cert.pem` - Certificato (valido 10 anni)
- `key.pem` - Chiave privata

### 2. Verifica Certificati

Controlla che i file siano stati creati:
```powershell
# Windows
Test-Path nginx/ssl/cert.pem
Test-Path nginx/ssl/key.pem

# Linux/Mac
ls -la nginx/ssl/
```

### 3. Avvia i Servizi con Nginx

**Docker Desktop:**
```powershell
docker compose -f docker-compose.desktop.prod.namedvol.yml up -d --build
```

**Portainer:**
- Ricompila lo stack con il nuovo servizio nginx
- Assicurati che il volume `sistema54_ssl_certs` contenga i certificati

### 4. Accesso all'Applicazione

**HTTPS (Raccomandato):**
```
https://localhost:26443
```

**HTTP (Redirect automatico a HTTPS):**
```
http://localhost:26080 → redirect a https://localhost:26443
```

**Backend diretto (solo se necessario):**
```
http://localhost:26101  (non raccomandato in produzione)
```

## 🔒 Porte Configurabili

Aggiungi al tuo `.env` o variabili d'ambiente:

```env
# Porte HTTPS/HTTP
HTTPS_PORT=26443
HTTP_PORT=26080

# Porte originali (mantenute per compatibilità)
BACKEND_PORT=26101
FRONTEND_PORT=26081
DB_PORT=26201
```

## ⚠️ Avviso Certificati Auto-firmati

I browser mostreranno un avviso di sicurezza perché i certificati sono auto-firmati. Questo è normale per ambienti interni/LAN.

**Per accettare il certificato:**
1. Accedi a `https://localhost:26443`
2. Il browser mostrerà "Avanzate" o "Advanced"
3. Clicca "Procedi comunque" o "Accept the Risk and Continue"

**Per produzione:**
Considera l'uso di:
- Let's Encrypt (gratuito, valido 90 giorni, rinnovo automatico)
- Certificati firmati da una Certificate Authority (CA) commerciale

## 🔧 Configurazione Nginx

Il file `nginx/nginx.conf` include:
- Redirect automatico HTTP → HTTPS
- Proxy per frontend (React/Vite)
- Proxy per backend API (`/api/` e altri endpoint)
- Security headers (HSTS, X-Frame-Options, etc.)
- Supporto WebSocket per hot-reload di Vite

## 🐛 Troubleshooting

**Certificati non trovati:**
```powershell
# Verifica che i file esistano
ls nginx/ssl/
# Se mancano, rigenera con generate_ssl_certs.ps1
```

**Nginx non si avvia:**
```powershell
# Controlla i log
docker logs sistema54_nginx
```

**Favicon non visualizzata:**
- Verifica che `frontend/public/favicon.png` esista
- Vite serve automaticamente i file da `public/`
- La favicon è referenziata in `index.html` come `/favicon.png`

**Errore "502 Bad Gateway":**
- Verifica che backend e frontend siano avviati
- Controlla che le porte interne (8000, 5173) siano accessibili
- Verifica la configurazione nginx

## 📝 Note

- Nginx ora gestisce tutto il traffico HTTPS/HTTP
- Frontend e backend non espongono più direttamente le porte (tranne per debug)
- I certificati sono validi per 10 anni (3650 giorni)
- Il certificato include SAN per localhost, *.local e indirizzi IP comuni
