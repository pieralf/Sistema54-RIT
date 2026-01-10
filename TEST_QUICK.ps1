# Script PowerShell per test rapidi delle modifiche
# Esegui: .\TEST_QUICK.ps1

$baseUrl = "http://localhost:26101"

Write-Host "=== TEST RAPIDI SISTEMA54-RIT ===" -ForegroundColor Cyan
Write-Host ""

# 1. Login e ottenimento token
Write-Host "1. Login..." -ForegroundColor Yellow
$username = Read-Host "Inserisci email"
$securePassword = Read-Host "Inserisci password" -AsSecureString
$password = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword))

$loginBody = @{
    username = $username
    password = $password
}

try {
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" `
        -Method POST `
        -Headers @{"Content-Type" = "application/x-www-form-urlencoded"} `
        -Body $loginBody
    
    $token = $loginResponse.access_token
    Write-Host "✅ Login riuscito!" -ForegroundColor Green
    Write-Host "Token: $($token.Substring(0, 20))..." -ForegroundColor Gray
} catch {
    Write-Host "❌ Errore login: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 2. Test Compressione GZip
Write-Host ""
Write-Host "2. Test Compressione GZip..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/clienti/" -Headers @{
        "Authorization" = "Bearer $token"
        "Accept-Encoding" = "gzip"
    } -UseBasicParsing
    
    if ($response.Headers["Content-Encoding"]) {
        Write-Host "✅ Compressione GZip attiva: $($response.Headers['Content-Encoding'])" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Compressione non rilevata (normale per risposte piccole)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Errore: $($_.Exception.Message)" -ForegroundColor Red
}

# 3. Test Sanitizzazione XSS - Crea Cliente
Write-Host ""
Write-Host "3. Test Sanitizzazione XSS (Crea Cliente)..." -ForegroundColor Yellow
$clienteBody = @{
    ragione_sociale = "<script>alert('XSS')</script>Test Company XSS"
    indirizzo = "Via Test 123"
    citta = "Test City"
    cap = "12345"
} | ConvertTo-Json

try {
    $clienteResponse = Invoke-RestMethod -Uri "$baseUrl/clienti/" `
        -Method POST `
        -Headers @{
            "Authorization" = "Bearer $token"
            "Content-Type" = "application/json"
        } `
        -Body $clienteBody
    
    Write-Host "✅ Cliente creato con ID: $($clienteResponse.id)" -ForegroundColor Green
    Write-Host "Ragione Sociale salvata: $($clienteResponse.ragione_sociale)" -ForegroundColor Gray
    
    if ($clienteResponse.ragione_sociale -like "*&lt;script*") {
        Write-Host "✅ Sanitizzazione XSS funzionante! (HTML escape rilevato)" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Verifica manuale: il campo potrebbe non essere stato sanitizzato" -ForegroundColor Yellow
    }
    
    $clienteId = $clienteResponse.id
} catch {
    Write-Host "❌ Errore creazione cliente: $($_.Exception.Message)" -ForegroundColor Red
    $clienteId = $null
}

# 4. Test Paginazione
Write-Host ""
Write-Host "4. Test Paginazione..." -ForegroundColor Yellow
try {
    $page1 = Invoke-RestMethod -Uri "$baseUrl/clienti/?skip=0&limit=5" `
        -Headers @{"Authorization" = "Bearer $token"}
    
    $page2 = Invoke-RestMethod -Uri "$baseUrl/clienti/?skip=5&limit=5" `
        -Headers @{"Authorization" = "Bearer $token"}
    
    Write-Host "✅ Prima pagina: $($page1.Count) clienti" -ForegroundColor Green
    Write-Host "✅ Seconda pagina: $($page2.Count) clienti" -ForegroundColor Green
    
    if ($page1.Count -gt 0 -and $page2.Count -gt 0) {
        if ($page1[0].id -ne $page2[0].id) {
            Write-Host "✅ Paginazione funzionante! (clienti diversi tra le pagine)" -ForegroundColor Green
        } else {
            Write-Host "⚠️ Verifica: le pagine potrebbero contenere gli stessi clienti" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "❌ Errore paginazione: $($_.Exception.Message)" -ForegroundColor Red
}

# 5. Test Security Headers
Write-Host ""
Write-Host "5. Test Security Headers..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/clienti/" `
        -Headers @{"Authorization" = "Bearer $token"} `
        -UseBasicParsing
    
    $headers = @(
        "X-Content-Type-Options",
        "X-Frame-Options",
        "X-XSS-Protection",
        "Content-Security-Policy"
    )
    
    $allPresent = $true
    foreach ($header in $headers) {
        if ($response.Headers[$header]) {
            Write-Host "✅ $header : $($response.Headers[$header])" -ForegroundColor Green
        } else {
            Write-Host "❌ $header : mancante" -ForegroundColor Red
            $allPresent = $false
        }
    }
    
    if ($allPresent) {
        Write-Host "✅ Tutti gli security headers sono presenti!" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Errore verifica headers: $($_.Exception.Message)" -ForegroundColor Red
}

# 6. Test Rate Limiting (solo info)
Write-Host ""
Write-Host "6. Test Rate Limiting..." -ForegroundColor Yellow
Write-Host "ℹ️  Per testare il rate limiting, esegui 6 login falliti consecutivi" -ForegroundColor Cyan
Write-Host "   Dopo il 5° tentativo, dovresti ricevere errore 429 con messaggio personalizzato" -ForegroundColor Cyan

# Cleanup: elimina cliente di test se creato
if ($clienteId) {
    Write-Host ""
    Write-Host "Pulizia: elimina cliente di test? (S/N)" -ForegroundColor Yellow
    $delete = Read-Host
    if ($delete -eq "S" -or $delete -eq "s") {
        try {
            Invoke-RestMethod -Uri "$baseUrl/clienti/$clienteId" `
                -Method DELETE `
                -Headers @{"Authorization" = "Bearer $token"} | Out-Null
            Write-Host "✅ Cliente di test eliminato" -ForegroundColor Green
        } catch {
            Write-Host "⚠️ Errore eliminazione cliente: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
}

Write-Host ""
Write-Host "=== TEST COMPLETATI ===" -ForegroundColor Cyan
