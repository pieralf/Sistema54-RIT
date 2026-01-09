# Debug Rate Limit - Guida

## Problema
Il messaggio "Request failed with status code 429" viene mostrato invece del messaggio personalizzato.

## Verifica Backend

1. **Controlla che il backend restituisca correttamente il JSON:**

```bash
# Esegui 6 login falliti rapidamente, poi controlla la risposta
curl -X POST http://localhost:26101/api/auth/login \
  -d "username=test@test.com&password=wrong" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -v 2>&1 | grep -A 10 "HTTP/"
```

**Output atteso:**
```
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 60

{
  "detail": "⏱️ Troppi tentativi di login falliti. Attendi 1 minuto prima di riprovare. Limite: 5 tentativi al minuto.",
  "error": "rate_limit_exceeded",
  "retry_after": 60,
  "limit": "5 tentativi al minuto"
}
```

## Verifica Frontend

1. **Apri la console del browser (F12)**
2. **Prova 6 login falliti**
3. **Controlla i log nella console** - dovresti vedere:
   ```
   Login error caught: {
     status: 429,
     statusText: "Too Many Requests",
     data: {
       detail: "⏱️ Troppi tentativi...",
       error: "rate_limit_exceeded",
       retry_after: 60,
       limit: "5 tentativi al minuto"
     },
     message: "Request failed with status code 429"
   }
   ```

## Se il problema persiste

1. **Verifica che il backend sia stato ricostruito:**
   ```bash
   docker compose -f docker-compose.desktop.prod.namedvol.yml build backend
   docker compose -f docker-compose.desktop.prod.namedvol.yml restart backend
   ```

2. **Controlla i log del backend:**
   ```bash
   docker compose -f docker-compose.desktop.prod.namedvol.yml logs backend | grep -i "rate\|429"
   ```

3. **Verifica che slowapi sia installato:**
   ```bash
   docker compose -f docker-compose.desktop.prod.namedvol.yml exec backend pip list | grep slowapi
   ```
   Dovresti vedere: `slowapi 0.1.9`

4. **Test diretto con curl:**
   ```bash
   # Primo tentativo
   curl -X POST http://localhost:26101/api/auth/login -d "username=test@test.com&password=wrong" -H "Content-Type: application/x-www-form-urlencoded"
   
   # Ripeti 5 volte, poi al 6° dovresti vedere il JSON con il messaggio personalizzato
   ```

## Fix applicato

- ✅ Exception handler personalizzato nel backend
- ✅ Estrazione corretta del messaggio nel frontend (error.response.data.detail)
- ✅ Log di debug aggiunti per vedere cosa arriva realmente

## Test rapido

Esegui questo script PowerShell per testare:

```powershell
# Test 6 login falliti
1..6 | ForEach-Object {
    Write-Host "Tentativo $_..."
    try {
        $r = Invoke-RestMethod -Uri "http://localhost:26101/api/auth/login" `
            -Method POST `
            -Body @{username="test@test.com"; password="wrong"} `
            -ContentType "application/x-www-form-urlencoded" `
            -ErrorAction Stop
        Write-Host "  Status: Success (non dovrebbe succedere)" -ForegroundColor Yellow
    } catch {
        $status = $_.Exception.Response.StatusCode.value__
        $body = $_.ErrorDetails.Message | ConvertFrom-Json
        Write-Host "  Status: $status" -ForegroundColor $(if ($status -eq 429) { "Green" } else { "Red" })
        if ($body.detail) {
            Write-Host "  Messaggio: $($body.detail)" -ForegroundColor Cyan
        }
    }
    Start-Sleep -Seconds 1
}
```

Se al 6° tentativo vedi il messaggio personalizzato, il backend funziona correttamente e il problema è nel frontend.
