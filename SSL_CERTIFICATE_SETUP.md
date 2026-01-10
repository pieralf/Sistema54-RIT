# Configurazione Certificati SSL Trusted

Questa guida spiega come generare e configurare certificati SSL trusted per evitare gli avvisi di sicurezza del browser.

## Metodo 1: mkcert (Consigliato per sviluppo/LAN)

`mkcert` genera certificati trusted automaticamente installando una root CA locale.

### Requisiti

- Windows 10/11
- PowerShell con privilegi amministratore
- Chocolatey (opzionale, per installazione automatica di mkcert)

### Installazione

1. **Installa Chocolatey** (se non già installato):
   ```powershell
   Set-ExecutionPolicy Bypass -Scope Process -Force
   [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
   iex ((New-Object System.Net.WebClient).DownloadString("https://community.chocolatey.org/install.ps1"))
   ```

2. **Installa mkcert**:
   ```powershell
   choco install mkcert -y
   ```
   
   Oppure scarica manualmente da: https://github.com/FiloSottile/mkcert/releases

### Generazione Certificati

Esegui lo script PowerShell incluso:

```powershell
.\generate_trusted_ssl_certs.ps1
```

Questo script:
- Verifica/installa mkcert
- Installa la root CA locale (se non già presente)
- Genera certificati validi per `localhost` e `127.0.0.1`
- Salva i certificati in `nginx/ssl/cert.pem` e `nginx/ssl/key.pem`

### Personalizzazione

Per aggiungere altri domini/IP ai certificati, modifica il comando mkcert:

```powershell
cd nginx\ssl
mkcert localhost 127.0.0.1 192.168.1.100 mydomain.local *.mydomain.local
```

### Vantaggi

- ✅ Certificati validi per 10 anni
- ✅ Trusted automaticamente da tutti i browser
- ✅ Nessun avviso di sicurezza
- ✅ Funziona su tutti i dispositivi della stessa rete (se importato)

## Metodo 2: Importazione Manuale (Windows)

Se hai già generato certificati con altri metodi (es. OpenSSL), puoi importarli manualmente:

### Usando lo Script PowerShell

```powershell
# Importa in LocalMachine (richiede privilegi admin)
.\import_ssl_certificate_windows.ps1

# Oppure importa in CurrentUser (non richiede admin)
.\import_ssl_certificate_windows.ps1 -StoreLocation CurrentUser
```

### Importazione Manuale via GUI

1. Apri `certlm.msc` (per LocalMachine) o `certmgr.msc` (per CurrentUser)
2. Vai a **Trusted Root Certification Authorities** → **Certificates**
3. Click destro → **All Tasks** → **Import**
4. Seleziona `nginx/ssl/cert.pem`
5. Segui la procedura guidata

### Importazione via PowerShell (Manuale)

```powershell
# Importa certificato in Trusted Root (richiede admin)
$cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2
$cert.Import("nginx\ssl\cert.pem")
$store = New-Object System.Security.Cryptography.X509Certificates.X509Store("Root", "LocalMachine")
$store.Open([System.Security.Cryptography.X509Certificates.OpenFlags]::ReadWrite)
$store.Add($cert)
$store.Close()
```

## Metodo 3: Let's Encrypt (Per produzione pubblica)

Per domini pubblici, usa Let's Encrypt con Certbot:

### Installazione Certbot

```powershell
# Installa Certbot via Chocolatey
choco install certbot -y
```

### Generazione Certificati

```powershell
# Genera certificati Let's Encrypt (richiede dominio pubblico)
certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com
```

I certificati verranno salvati in:
- `C:\Certbot\live\yourdomain.com\fullchain.pem` (certificato)
- `C:\Certbot\live\yourdomain.com\privkey.pem` (chiave privata)

### Configurazione Nginx

Copia i certificati Let's Encrypt in `nginx/ssl/`:

```powershell
Copy-Item "C:\Certbot\live\yourdomain.com\fullchain.pem" "nginx\ssl\cert.pem"
Copy-Item "C:\Certbot\live\yourdomain.com\privkey.pem" "nginx\ssl\key.pem"
```

### Rinnovo Automatico

Let's Encrypt richiede rinnovo ogni 90 giorni. Crea un task schedulato:

```powershell
# Rinnova certificati
certbot renew

# Copia nuovi certificati
Copy-Item "C:\Certbot\live\yourdomain.com\fullchain.pem" "nginx\ssl\cert.pem"
Copy-Item "C:\Certbot\live\yourdomain.com\privkey.pem" "nginx\ssl\key.pem"

# Riavvia nginx
docker compose -f docker-compose.desktop.prod.namedvol.yml restart nginx
```

## Verifica

Dopo aver configurato i certificati:

1. **Riavvia nginx**:
   ```powershell
   docker compose -f docker-compose.desktop.prod.namedvol.yml restart nginx
   ```

2. **Accedi all'applicazione**:
   - https://localhost:26443
   - Il browser dovrebbe mostrare il lucchetto verde (nessun avviso)

3. **Verifica il certificato**:
   - Click sul lucchetto nella barra degli indirizzi
   - Verifica "Valid" e "Issued by"

## Troubleshooting

### Browser mostra ancora avviso

- **Riavvia il browser** dopo l'importazione
- **Pulisci cache SSL**: Chrome → Settings → Privacy → Clear browsing data → Advanced → Cached images and files
- **Verifica certificato**: Apri `chrome://settings/certificates` e verifica che il certificato sia in "Authorities"

### Firefox non riconosce il certificato

Firefox ha il proprio certificate store separato da Windows:

1. Vai a `about:preferences#privacy`
2. Scrolla fino a "Certificati" → "Visualizza certificati"
3. Tab "Autorità" → "Importa..."
4. Seleziona `nginx/ssl/cert.pem` (NON key.pem!)
5. Nella finestra di conferma, seleziona:
   ✅ **"Fiducia per questo certificato per identificare siti web"**
6. Click OK e riavvia Firefox completamente

Vedi `import_certificate_firefox.md` per istruzioni dettagliate con screenshot.

### Errore "certificate signed by unknown authority"

- Verifica che il certificato sia stato importato correttamente
- Per mkcert, esegui `mkcert -install` per installare la root CA
- Riavvia il browser dopo l'importazione

## Note

- **Sviluppo/LAN**: Usa `mkcert` (Metodo 1)
- **Produzione Pubblica**: Usa Let's Encrypt (Metodo 3)
- **Test Locali**: L'importazione manuale (Metodo 2) funziona ma richiede più passaggi

## Riferimenti

- mkcert: https://github.com/FiloSottile/mkcert
- Let's Encrypt: https://letsencrypt.org/
- Certbot: https://certbot.eff.org/
