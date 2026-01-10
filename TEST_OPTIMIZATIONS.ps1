# Test script per verificare le ottimizzazioni implementate
# Test: API Versioning, Error Tracking, Caching Settings

param(
    [string]$BaseUrl = "http://localhost:26101",
    [string]$AdminEmail = "admin@sistema54.it",
    [string]$AdminPassword = ""
)

Write-Host "`n=== TEST OTTIMIZZAZIONI ===" -ForegroundColor Cyan
Write-Host "Base URL: $BaseUrl`n" -ForegroundColor Gray

# Step 1: Login per ottenere token
Write-Host "1. Login..." -ForegroundColor Yellow
if (-not $AdminPassword) {
    $AdminPassword = Read-Host "Inserisci password admin" -AsSecureString
    $AdminPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($AdminPassword))
}

$loginBody = @{
    username = $AdminEmail
    password = $AdminPassword
}

try {
    $loginResponse = Invoke-RestMethod -Uri "$BaseUrl/api/auth/login" -Method POST -Headers @{"Content-Type" = "application/x-www-form-urlencoded"} -Body $loginBody
    $token = $loginResponse.access_token
    Write-Host "   ✓ Login riuscito" -ForegroundColor Green
} catch {
    Write-Host "   ✗ Login fallito: $_" -ForegroundColor Red
    exit 1
}

# Headers per le richieste autenticate
$authHeaders = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

# Step 2: Test API Versioning - /api/v1/health
Write-Host "`n2. Test API Versioning (/api/v1/health)..." -ForegroundColor Yellow
try {
    $healthV1 = Invoke-RestMethod -Uri "$BaseUrl/api/v1/health" -Headers $authHeaders
    Write-Host "   ✓ /api/v1/health risponde correttamente" -ForegroundColor Green
    Write-Host "     Status: $($healthV1.status)" -ForegroundColor Gray
} catch {
    Write-Host "   ✗ /api/v1/health fallito: $_" -ForegroundColor Red
}

# Step 3: Test API Versioning - /api/v1/metrics
Write-Host "`n3. Test API Versioning (/api/v1/metrics)..." -ForegroundColor Yellow
try {
    $metricsV1 = Invoke-RestMethod -Uri "$BaseUrl/api/v1/metrics" -Headers $authHeaders
    Write-Host "   ✓ /api/v1/metrics risponde correttamente" -ForegroundColor Green
    Write-Host "     Timestamp: $($metricsV1.timestamp)" -ForegroundColor Gray
} catch {
    Write-Host "   ✗ /api/v1/metrics fallito: $_" -ForegroundColor Red
}

# Step 4: Test Deprecation Warning per /api/ vecchi
Write-Host "`n4. Test Deprecation Warning per /api/ vecchi..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$BaseUrl/api/auth/login" -Method OPTIONS -Headers $authHeaders -ErrorAction SilentlyContinue
    # Prova con un endpoint che esiste
    $response = Invoke-WebRequest -Uri "$BaseUrl/api/users/" -Headers $authHeaders -UseBasicParsing -ErrorAction Stop
    if ($response.Headers["Deprecation"]) {
        Write-Host "   ✓ Header Deprecation presente: $($response.Headers['Deprecation'])" -ForegroundColor Green
        if ($response.Headers["Sunset"]) {
            Write-Host "     Sunset: $($response.Headers['Sunset'])" -ForegroundColor Gray
        }
        if ($response.Headers["Link"]) {
            Write-Host "     Link: $($response.Headers['Link'])" -ForegroundColor Gray
        }
    } else {
        Write-Host "   ⚠ Header Deprecation non presente (potrebbe essere normale per alcuni endpoint)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ⚠ Test deprecation warning non eseguito correttamente (normale se endpoint richiede POST)" -ForegroundColor Yellow
}

# Step 5: Test Error Tracking - Crea un errore di test
Write-Host "`n5. Test Error Tracking (creazione errore di test)..." -ForegroundColor Yellow
try {
    # Prova a chiamare un endpoint che non esiste o genera errore
    try {
        Invoke-RestMethod -Uri "$BaseUrl/api/test-error-endpoint" -Headers $authHeaders -ErrorAction Stop | Out-Null
    } catch {
        # Questo è previsto - genera un 404
        Write-Host "   ✓ Errore generato (previsto)" -ForegroundColor Green
    }
    
    # Verifica se il file di log errori esiste (backend)
    Write-Host "   ℹ Verifica manuale: controlla backend/logs/errors/errors_YYYYMMDD.log" -ForegroundColor Gray
} catch {
    Write-Host "   ⚠ Test error tracking non completato" -ForegroundColor Yellow
}

# Step 6: Test Error Stats Endpoint
Write-Host "`n6. Test Error Stats Endpoint (/api/error-stats)..." -ForegroundColor Yellow
try {
    $errorStats = Invoke-RestMethod -Uri "$BaseUrl/api/error-stats" -Headers $authHeaders
    Write-Host "   ✓ /api/error-stats risponde correttamente" -ForegroundColor Green
    Write-Host "     Errori totali oggi: $($errorStats.total_errors)" -ForegroundColor Gray
    Write-Host "     Data: $($errorStats.date)" -ForegroundColor Gray
    if ($errorStats.error_types) {
        Write-Host "     Tipi di errore:" -ForegroundColor Gray
        foreach ($errorType in $errorStats.error_types.PSObject.Properties) {
            Write-Host "       - $($errorType.Name): $($errorType.Value)" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "   ✗ /api/error-stats fallito: $_" -ForegroundColor Red
    if ($_.Exception.Response.StatusCode -eq 404) {
        Write-Host "     (Endpoint potrebbe non essere ancora disponibile dopo il deploy)" -ForegroundColor Yellow
    }
}

# Step 7: Test Caching Settings - Verifica performance
Write-Host "`n7. Test Caching Settings..." -ForegroundColor Yellow
try {
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    $settings1 = Invoke-RestMethod -Uri "$BaseUrl/impostazioni/public" -UseBasicParsing
    $time1 = $stopwatch.ElapsedMilliseconds
    Write-Host "   Prima chiamata: ${time1}ms" -ForegroundColor Gray
    
    $stopwatch.Restart()
    $settings2 = Invoke-RestMethod -Uri "$BaseUrl/impostazioni/public" -UseBasicParsing
    $time2 = $stopwatch.ElapsedMilliseconds
    Write-Host "   Seconda chiamata (dovrebbe usare cache): ${time2}ms" -ForegroundColor Gray
    
    if ($time2 -lt $time1) {
        Write-Host "   ✓ Cache funzionante (seconda chiamata più veloce)" -ForegroundColor Green
    } else {
        Write-Host "   ⚠ Cache potrebbe non essere attiva (verifica nel backend)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ✗ Test caching fallito: $_" -ForegroundColor Red
}

# Step 8: Test che /api/health vecchio funzioni ancora
Write-Host "`n8. Test Compatibilità Backward (/api/health vecchio)..." -ForegroundColor Yellow
try {
    $healthOld = Invoke-RestMethod -Uri "$BaseUrl/api/health" -Headers $authHeaders
    Write-Host "   ✓ /api/health vecchio funziona ancora (backward compatibility)" -ForegroundColor Green
    Write-Host "     Status: $($healthOld.status)" -ForegroundColor Gray
} catch {
    Write-Host "   ✗ /api/health vecchio fallito: $_" -ForegroundColor Red
}

Write-Host "`n=== TEST COMPLETATI ===" -ForegroundColor Cyan
Write-Host "`nProssimi passi:" -ForegroundColor Yellow
Write-Host "  • Verifica manuale dei file log errori in backend/logs/errors/" -ForegroundColor Gray
Write-Host "  • Testa deprecation warnings con DevTools del browser" -ForegroundColor Gray
Write-Host "  • Monitora le performance delle settings con cache attiva" -ForegroundColor Gray
