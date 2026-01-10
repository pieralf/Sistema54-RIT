# Guida Test Modifiche Implementate

## 🎯 Obiettivo
Verificare che tutte le ottimizzazioni e fix di sicurezza siano funzionanti correttamente.

## ✅ Modifiche da Testare

### 0. Setup: Ottieni Token di Autenticazione
**IMPORTANTE:** Prima di tutti i test, devi ottenere un token valido.

```powershell
# Login per ottenere token
$loginBody = @{
    username = "admin@sistema54.it"  # Sostituisci con la tua email
    password = "your_password"       # Sostituisci con la tua password
}

$loginResponse = Invoke-RestMethod -Uri "http://localhost:26101/api/auth/login" `
    -Method POST `
    -Headers @{"Content-Type" = "application/x-www-form-urlencoded"} `
    -Body $loginBody

$token = $loginResponse.access_token
Write-Host "Token ottenuto: $($token.Substring(0, 20))..." -ForegroundColor Green

# Salva il token in una variabile per i test successivi
$global:authToken = $token
```

### 1. Compressione GZip
**Cosa verifica:** Le risposte API vengono compresse per ridurre la bandwidth.

**Test:**
```powershell
# IMPORTANTE: Usa il token reale, non "YOUR_TOKEN"
# L'endpoint corretto è /clienti/ (senza /api/)
$response = Invoke-WebRequest -Uri "http://localhost:26101/clienti/" -Headers @{
    "Authorization" = "Bearer $global:authToken"
    "Accept-Encoding" = "gzip"
} -UseBasicParsing

# Verifica header Content-Encoding
if ($response.Headers["Content-Encoding"]) {
    Write-Host "✅ Compressione GZip attiva: $($response.Headers['Content-Encoding'])" -ForegroundColor Green
} else {
    Write-Host "⚠️ Compressione GZip non rilevata (potrebbe essere normale per risposte piccole)" -ForegroundColor Yellow
}

# Verifica dimensione (deve essere ridotta)
Write-Host "Dimensione risposta: $($response.Content.Length) bytes"
```

**Risultato atteso:** 
- Header `Content-Encoding: gzip` presente
- Dimensione risposta significativamente ridotta (60-80%)

---

### 2. Sanitizzazione XSS - Clienti
**Cosa verifica:** I campi testuali vengono sanitizzati per prevenire XSS.

**Test:**
```powershell
# Crea un cliente con input malizioso
$body = @{
    ragione_sociale = "<script>alert('XSS')</script>Test Company"
    indirizzo = "Via Test 123"
    citta = "Test City"
    cap = "12345"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:26101/clienti/" `
    -Method POST `
    -Headers @{
        "Authorization" = "Bearer $global:authToken"
        "Content-Type" = "application/json"
    } `
    -Body $body

# Verifica che il campo sia stato sanitizzato (escape HTML)
$response.ragione_sociale
# Dovrebbe essere: "&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;Test Company"
```

**Risultato atteso:**
- Il campo contiene `&lt;script&gt;` invece di `<script>`
- Il tag script non viene eseguito se visualizzato nel browser

**Test anche per:**
- Update cliente (PUT `/clienti/{id}`)
- Email (verificare normalizzazione)
- Codice SDI

---

### 3. Sanitizzazione XSS - Utenti
**Cosa verifica:** Email e nome_completo vengono sanitizzati.

**Test:**
```powershell
# Registra un nuovo utente con input malizioso
$body = @{
    email = "test<script>@test.com"
    nome_completo = "<img src=x onerror=alert('XSS')>Test User"
    ruolo = "operatore"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:26101/api/auth/register" `
    -Method POST `
    -Headers @{
        "Authorization" = "Bearer $global:authToken"
        "Content-Type" = "application/json"
    } `
    -Body $body

# Verifica sanitizzazione
$response.nome_completo
# Dovrebbe essere sanitizzato (escape HTML)

# Verifica email (dovrebbe essere normalizzata e rimossi caratteri pericolosi)
$response.email
```

**Test anche per:**
- Update utente (PUT `/api/users/{id}`)

---

### 4. Sanitizzazione XSS - Interventi
**Cosa verifica:** Campi descrittivi degli interventi vengono sanitizzati.

**Test:**
```powershell
# Crea un intervento con input malizioso
$body = @{
    macro_categoria = "Informatica & IT"
    cliente_id = 1
    cliente_ragione_sociale = "<script>alert('XSS')</script>Test"
    difetto_segnalato = "<img src=x onerror=alert('XSS')>Problema"
    descrizione_extra = "Test <b>HTML</b>"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:26101/interventi/" `
    -Method POST `
    -Headers @{
        "Authorization" = "Bearer $global:authToken"
        "Content-Type" = "application/json"
    } `
    -Body $body

# Verifica sanitizzazione
$response.difetto_segnalato
$response.descrizione_extra
# Dovrebbero essere sanitizzati (escape HTML)
```

---

### 5. Paginazione Clienti
**Cosa verifica:** La paginazione funziona correttamente per limitare i risultati.

**Test:**
```powershell
# Prima pagina (primi 10 clienti)
$page1 = Invoke-RestMethod -Uri "http://localhost:26101/clienti/?skip=0&limit=10" `
    -Headers @{
        "Authorization" = "Bearer $global:authToken"
    }

Write-Host "Prima pagina: $($page1.Count) clienti"
# Dovrebbe essere: 10 (o meno se non ce ne sono abbastanza)

# Seconda pagina (clienti 11-20)
$page2 = Invoke-RestMethod -Uri "http://localhost:26101/clienti/?skip=10&limit=10" `
    -Headers @{
        "Authorization" = "Bearer $global:authToken"
    }

Write-Host "Seconda pagina: $($page2.Count) clienti"

# Verifica che siano diversi
if ($page1[0].id -ne $page2[0].id) {
    Write-Host "✅ Paginazione funzionante!" -ForegroundColor Green
} else {
    Write-Host "❌ Paginazione non funziona" -ForegroundColor Red
}

# Test limite massimo (non deve superare 200)
$large = Invoke-RestMethod -Uri "http://localhost:26101/clienti/?skip=0&limit=500" `
    -Headers @{
        "Authorization" = "Bearer $global:authToken"
    }
Write-Host "Richiesta 500, ricevuti: $($large.Count)"
# Dovrebbe essere limitato a 200
```

**Risultato atteso:**
- Prima pagina: max 10 clienti
- Seconda pagina: clienti diversi dalla prima
- Limite massimo: non più di 200 clienti anche se richiesti 500

---

### 6. Rate Limiting
**Cosa verifica:** Il rate limiting blocca troppi tentativi di login.

**Test:**
```powershell
# Prova 6 login falliti consecutivi
$errorCount = 0
for ($i = 1; $i -le 6; $i++) {
    try {
        $body = @{
            username = "test@test.com"
            password = "wrongpassword"
        }
        
        $response = Invoke-RestMethod -Uri "http://localhost:26101/api/auth/login" `
            -Method POST `
            -Headers @{"Content-Type" = "application/x-www-form-urlencoded"} `
            -Body $body
    } catch {
        $errorCount++
        Write-Host "Tentativo $i : $($_.Exception.Response.StatusCode.value__)"
        
        # Dopo il 5° tentativo, dovrebbe dare 429
        if ($i -ge 5) {
            $statusCode = $_.Exception.Response.StatusCode.value__
            if ($statusCode -eq 429) {
                Write-Host "✅ Rate limiting attivo!" -ForegroundColor Green
                # Verifica messaggio personalizzato
                $errorBody = $_.ErrorDetails.Message | ConvertFrom-Json
                Write-Host "Messaggio: $($errorBody.detail)"
            }
        }
    }
    Start-Sleep -Milliseconds 500
}
```

**Risultato atteso:**
- Dopo 5 tentativi, status 429
- Messaggio personalizzato: "⏱️ Troppi tentativi di login falliti. Attendi X minuto/i..."

---

### 7. Security Headers
**Cosa verifica:** Gli header di sicurezza sono presenti nelle risposte.

**Test:**
```powershell
$response = Invoke-WebRequest -Uri "http://localhost:26101/clienti/" `
    -Headers @{
        "Authorization" = "Bearer $global:authToken"
    } `
    -UseBasicParsing

# Verifica header
Write-Host "X-Content-Type-Options: $($response.Headers['X-Content-Type-Options'])"
# Dovrebbe essere: "nosniff"

Write-Host "X-Frame-Options: $($response.Headers['X-Frame-Options'])"
# Dovrebbe essere: "DENY"

Write-Host "X-XSS-Protection: $($response.Headers['X-XSS-Protection'])"
# Dovrebbe essere: "1; mode=block"

Write-Host "Content-Security-Policy: $($response.Headers['Content-Security-Policy'])"
# Dovrebbe essere presente
```

**Risultato atteso:**
- Tutti gli header di sicurezza presenti
- Valori corretti come sopra

---

### 8. Fix Vulnerabilità: tarfile.extractall (Backup)
**Cosa verifica:** I backup vengono estratti in modo sicuro (path traversal prevention).

**Test manuale richiesto:**
1. Crea un backup tramite l'interfaccia admin
2. Prova a ripristinarlo
3. Verifica che venga estratto correttamente

**Test tecnico (solo se hai accesso ai file backup):**
```python
# Test Python (da eseguire nel container backend)
import tarfile
import tempfile
import os
from pathlib import Path

# Crea un archivio tar di test con path traversal
with tempfile.NamedTemporaryFile(suffix='.tar.gz', delete=False) as f:
    test_tar = f.name

with tarfile.open(test_tar, 'w:gz') as tar:
    # Aggiungi un file con path traversal
    info = tarfile.TarInfo(name='../../../etc/passwd')
    info.size = 0
    tar.addfile(info)

# Prova l'estrazione sicura
from app.services.backup_service import safe_tar_extract

tmp = tempfile.mkdtemp()
try:
    with tarfile.open(test_tar, 'r:gz') as tar:
        safe_tar_extract(tar, tmp)
    print("❌ Path traversal NON bloccato!")
except ValueError as e:
    print(f"✅ Path traversal bloccato: {e}")
finally:
    os.unlink(test_tar)
    shutil.rmtree(tmp)
```

**Risultato atteso:**
- Estrazione normale funziona
- Tentativi di path traversal vengono bloccati con ValueError

---

### 9. Fix Vulnerabilità: Jinja2 autoescape (PDF)
**Cosa verifica:** I template PDF sanitizzano automaticamente l'output HTML.

**Test:**
1. Crea un intervento con input HTML nei campi (es. `<script>` tag)
2. Genera il PDF dell'intervento
3. Apri il PDF e verifica che l'HTML non venga eseguito (dovrebbe essere mostrato come testo)

**Test tecnico (opzionale):**
```python
# Nel container backend
from app.services.pdf_service import get_template_environment

env = get_template_environment()
# Verifica che autoescape sia abilitato
print(f"Autoescape: {env.autoescape}")
# Dovrebbe essere una funzione che ritorna True per HTML/XML
```

**Risultato atteso:**
- Autoescape abilitato per HTML/XML
- Input HTML viene escape automaticamente nei PDF

---

## 🔧 Setup Pre-Test

### 1. Rebuild Backend
```powershell
docker compose -f docker-compose.desktop.prod.namedvol.yml build backend
docker compose -f docker-compose.desktop.prod.namedvol.yml up -d backend
```

### 2. Verifica Backend Running
```powershell
# Attendi che il backend sia pronto
Start-Sleep -Seconds 10

# Verifica health check
Invoke-RestMethod -Uri "http://localhost:26101/docs"
# Dovrebbe aprire la documentazione FastAPI
```

### 3. Ottieni Token per Test
```powershell
# Login per ottenere token
$loginBody = @{
    username = "admin@sistema54.it"  # Sostituisci con la tua email
    password = "your_password"       # Sostituisci con la tua password
}

$loginResponse = Invoke-RestMethod -Uri "http://localhost:26101/api/auth/login" `
    -Method POST `
    -Headers @{"Content-Type" = "application/x-www-form-urlencoded"} `
    -Body $loginBody

$token = $loginResponse.access_token
Write-Host "Token salvato: $token"
```

---

## 📋 Checklist Rapida

- [ ] Rebuild backend eseguito
- [ ] Compressione GZip verificata
- [ ] Sanitizzazione XSS clienti testata
- [ ] Sanitizzazione XSS utenti testata
- [ ] Sanitizzazione XSS interventi testata
- [ ] Paginazione clienti testata
- [ ] Rate limiting testato (5 tentativi)
- [ ] Security headers verificati
- [ ] Backup extraction testata (opzionale)
- [ ] PDF generation testata con HTML input

---

## 🚨 Problemi Comuni

### Backend non parte
- Verifica log: `docker compose logs backend`
- Controlla che la porta 26101 non sia già in uso
- Verifica variabili d'ambiente

### Errore 401 Unauthorized
- Token scaduto o non valido
- Rieffettua login per ottenere nuovo token

### Errore 500 Internal Server Error
- Verifica log backend: `docker compose logs backend --tail=50`
- Controlla che il database sia raggiungibile

---

## 📝 Note

- **Sanitizzazione XSS:** I test verificano che l'HTML venga escape, ma non impedisce di salvare dati legittimi. Caratteri speciali come `&`, `<`, `>` vengono convertiti in entità HTML.
- **Paginazione:** Il frontend non usa ancora skip/limit, quindi le liste potrebbero ancora caricare tutti i dati. La paginazione backend è comunque attiva e pronta.
- **Rate Limiting:** Il limite è per IP. Se testi da localhost, tutti i tentativi vengono contati per lo stesso IP.

---

## ✅ Criteri di Successo

Tutti i test devono passare senza errori critici. I risultati attesi devono corrispondere a quanto descritto in ogni sezione.
