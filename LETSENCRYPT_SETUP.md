# 🔒 Certificati SSL Pubblici Gratuiti con Let's Encrypt

## ✅ Vantaggi

- **Gratuito al 100%**
- **Riconosciuto da TUTTI i browser** (Chrome, Firefox, Edge, Safari)
- **Nessuna importazione manuale necessaria**
- **Nessun avviso di sicurezza**
- **Valido per domini pubblici**

## ⚠️ Limitazioni

**Let's Encrypt NON funziona per:**
- ❌ `localhost` o `127.0.0.1`
- ❌ IP privati (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
- ❌ Domini non raggiungibili da internet

**Let's Encrypt FUNZIONA per:**
- ✅ Domini pubblici (es. `esempio.com`, `app.esempio.com`)
- ✅ Domini con DNS configurato
- ✅ Server raggiungibile da internet sulla porta 80

## 🚀 Setup Rapido

### Prerequisiti

1. **Dominio pubblico** (es. `tuodominio.com`)
2. **DNS configurato**: Record A che punta all'IP pubblico del server
3. **Porta 80 aperta** per validazione HTTP-01
4. **Server raggiungibile da internet**

### Installazione

#### Opzione 1: Script Automatico

```powershell
# Esegui PowerShell come Administrator
.\setup_letsencrypt.ps1 -DomainName "tuodominio.com" -Email "tuaemail@example.com"
```

#### Opzione 2: Manuale con Certbot

1. **Installa Certbot**:
   ```powershell
   choco install certbot -y
   ```

2. **Ferma nginx** (Certbot ha bisogno della porta 80):
   ```powershell
   docker stop sistema54_nginx
   ```

3. **Genera certificati**:
   ```powershell
   certbot certonly --standalone -d tuodominio.com --email tuaemail@example.com
   ```

4. **Copia certificati**:
   ```powershell
   Copy-Item "C:\Certbot\live\tuodominio.com\fullchain.pem" "nginx\ssl\cert.pem"
   Copy-Item "C:\Certbot\live\tuodominio.com\privkey.pem" "nginx\ssl\key.pem"
   ```

5. **Riavvia nginx**:
   ```powershell
   docker start sistema54_nginx
   ```

## 📝 Configurazione Nginx

Aggiorna `nginx/nginx.conf` per usare il dominio:

```nginx
server {
    listen 443 ssl;
    http2 on;
    server_name tuodominio.com www.tuodominio.com;  # <-- AGGIORNA QUI

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    
    # ... resto della configurazione
}
```

## 🔄 Rinnovo Automatico

Let's Encrypt richiede rinnovo ogni **90 giorni**. Configura un task schedulato Windows:

### PowerShell Script per Rinnovo

Crea `renew_letsencrypt.ps1`:

```powershell
# Rinnova certificati
certbot renew --quiet

# Copia nuovi certificati
$domain = "tuodominio.com"
Copy-Item "C:\Certbot\live\$domain\fullchain.pem" "nginx\ssl\cert.pem" -Force
Copy-Item "C:\Certbot\live\$domain\privkey.pem" "nginx\ssl\key.pem" -Force

# Copia nel container Docker
docker cp nginx\ssl\cert.pem sistema54_nginx:/etc/nginx/ssl/cert.pem
docker cp nginx\ssl\key.pem sistema54_nginx:/etc/nginx/ssl/key.pem

# Riavvia nginx
docker restart sistema54_nginx
```

### Task Schedulato Windows

1. Apri **Task Scheduler** (`taskschd.msc`)
2. **Create Basic Task** → Nome: "Renew Let's Encrypt"
3. **Trigger**: Mensile (ogni 1° del mese)
4. **Action**: Avvia programma
   - Program: `powershell.exe`
   - Argomenti: `-ExecutionPolicy Bypass -File C:\Progetti\Sistema54-RIT\renew_letsencrypt.ps1`
5. Salva

## 🆚 Confronto: Self-Signed vs Let's Encrypt vs mkcert

| Caratteristica | Self-Signed | mkcert | Let's Encrypt |
|----------------|-------------|--------|---------------|
| **Costo** | Gratis | Gratis | Gratis |
| **localhost** | ✅ | ✅ | ❌ |
| **Dominio pubblico** | ✅ | ⚠️ Richiede importazione | ✅ |
| **Trust automatico** | ❌ | ✅ (Chrome/Edge) | ✅ (Tutti) |
| **Firefox** | ❌ Importazione manuale | ❌ Importazione manuale | ✅ Automatico |
| **Validità** | 10 anni | 10 anni | 90 giorni |
| **Setup** | Automatico | Facile | Requisiti DNS |

## 🎯 Quando Usare Cosa

- **Sviluppo locale (localhost)**: Usa **mkcert** (`generate_trusted_ssl_certs.ps1`)
- **Produzione (dominio pubblico)**: Usa **Let's Encrypt** (`setup_letsencrypt.ps1`)
- **Test interno (LAN privata)**: Usa **mkcert** e importa manualmente

## 🔍 Verifica

Dopo la configurazione:

1. Accedi a `https://tuodominio.com`
2. Click sul **lucchetto** nella barra degli indirizzi
3. Verifica:
   - ✅ "Valid" o "Valido"
   - ✅ "Issued by: Let's Encrypt"
   - ✅ Nessun avviso di sicurezza

## ❓ FAQ

### Perché Let's Encrypt non funziona per localhost?

Let's Encrypt richiede **validazione HTTP-01**: deve raggiungere il server tramite HTTP per verificare la proprietà del dominio. `localhost` non è raggiungibile da internet, quindi la validazione fallisce.

### Posso usare Let's Encrypt per IP pubblico?

No, Let's Encrypt richiede un **dominio pubblico** con DNS configurato. Gli IP non sono supportati.

### Cosa succede se scade il certificato?

Il certificato scade dopo 90 giorni. Se configurato il rinnovo automatico, si rinnoverà automaticamente. Altrimenti, rinnova manualmente con `certbot renew`.

### Posso usare un sottodominio?

Sì! Puoi generare certificati per:
- `esempio.com`
- `www.esempio.com`
- `app.esempio.com`
- `api.esempio.com`

Aggiungi tutti i domini al comando: `certbot certonly --standalone -d esempio.com -d www.esempio.com -d app.esempio.com`

## 📚 Riferimenti

- Let's Encrypt: https://letsencrypt.org/
- Certbot: https://certbot.eff.org/
- Documentazione: https://letsencrypt.org/docs/
