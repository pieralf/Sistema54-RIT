# Test Locale - Rate Limiting e Security Headers

## 🚀 Setup Test Locale

### 1. Rebuild del Backend (per installare slowapi)

```bash
# Ferma i container esistenti
docker compose -f docker-compose.desktop.prod.namedvol.yml down

# Rebuild solo il backend (con le nuove dipendenze)
docker compose -f docker-compose.desktop.prod.namedvol.yml build backend

# Avvia tutti i servizi
docker compose -f docker-compose.desktop.prod.namedvol.yml up -d

# Verifica che il backend si avvii correttamente
docker compose -f docker-compose.desktop.prod.namedvol.yml logs -f backend
```

### 2. Verifica Installazione slowapi

Controlla nei log del backend che non ci siano errori di import. Dovresti vedere:
```
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

Se vedi errori tipo `ModuleNotFoundError: No module named 'slowapi'`, significa che il rebuild non ha funzionato.

## 🧪 Test Rate Limiting

### Test 1: Login Rate Limit (5/minuto)

Apri PowerShell o terminale e esegui:

```powershell
# Test 1: Prova 6 login falliti rapidamente (il 6° dovrebbe dare 429)
for ($i=1; $i -le 6; $i++) {
    Write-Host "Tentativo $i..."
    $response = Invoke-WebRequest -Uri "http://localhost:26101/api/auth/login" `
        -Method POST `
        -Body @{
            username = "test@example.com"
            password = "wrongpassword"
        } `
        -ContentType "application/x-www-form-urlencoded" `
        -ErrorAction SilentlyContinue
    
    Write-Host "Status: $($response.StatusCode)"
    if ($response.StatusCode -eq 429) {
        Write-Host "✅ Rate limit attivo! Status 429 ricevuto" -ForegroundColor Green
        break
    }
    Start-Sleep -Seconds 1
}
```

**Risultato atteso**: Dopo 5 tentativi, il 6° dovrebbe restituire `429 Too Many Requests`.

### Test 2: Verifica Security Headers

```powershell
# Test 2: Verifica security headers
$response = Invoke-WebRequest -Uri "http://localhost:26101/api/clienti/" `
    -Headers @{
        "Authorization" = "Bearer YOUR_TOKEN_HERE"
    } `
    -ErrorAction SilentlyContinue

Write-Host "Security Headers:"
Write-Host "X-Content-Type-Options: $($response.Headers['X-Content-Type-Options'])"
Write-Host "X-Frame-Options: $($response.Headers['X-Frame-Options'])"
Write-Host "X-XSS-Protection: $($response.Headers['X-XSS-Protection'])"
Write-Host "Content-Security-Policy: $($response.Headers['Content-Security-Policy'])"
```

**Risultato atteso**: Tutti gli header dovrebbero essere presenti.

### Test 3: Test con curl (alternativa)

Se preferisci usare curl:

```bash
# Test rate limit
for i in {1..6}; do
  echo "Tentativo $i..."
  curl -X POST http://localhost:26101/api/auth/login \
    -d "username=test@example.com&password=wrong" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -w "\nStatus: %{http_code}\n" \
    -s
  sleep 1
done

# Test security headers
curl -I http://localhost:26101/api/clienti/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  | grep -i "x-content-type-options\|x-frame-options\|x-xss-protection\|content-security-policy"
```

## ✅ Checklist Verifica

- [ ] Backend si avvia senza errori
- [ ] Nessun errore `ModuleNotFoundError: slowapi` nei log
- [ ] Dopo 5 login falliti, il 6° restituisce 429
- [ ] Security headers presenti in tutte le risposte
- [ ] Frontend funziona normalmente (login, navigazione)

## 🐛 Troubleshooting

### Problema: Backend non si avvia
```bash
# Controlla i log dettagliati
docker compose -f docker-compose.desktop.prod.namedvol.yml logs backend

# Se vedi errori di import, forza il rebuild
docker compose -f docker-compose.desktop.prod.namedvol.yml build --no-cache backend
docker compose -f docker-compose.desktop.prod.namedvol.yml up -d
```

### Problema: Rate limit non funziona
- Verifica che `slowapi` sia installato: `docker compose -f docker-compose.desktop.prod.namedvol.yml exec backend pip list | grep slowapi`
- Controlla i log per errori: `docker compose -f docker-compose.desktop.prod.namedvol.yml logs backend | grep -i "rate\|limiter"`

### Problema: Security headers non presenti
- Verifica che il middleware sia attivo controllando i log all'avvio
- Controlla che non ci siano errori nel middleware

## 📝 Note

- Il rate limiting è basato su IP, quindi se testi dalla stessa macchina, tutti i tentativi vengono contati insieme
- Per testare da IP diversi, puoi usare `X-Forwarded-For` header (se configurato)
- I limiti sono:
  - Login: 5/minuto
  - Registrazione: 3/ora
  - Set Password: 3/ora
  - Regenerate Access: 5/ora
