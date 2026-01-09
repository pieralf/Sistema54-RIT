# Script PowerShell per testare Rate Limiting
# Esegui: .\test_rate_limit.ps1

Write-Host "🧪 Test Rate Limiting - Login Endpoint" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

$baseUrl = "http://localhost:26101"
$endpoint = "$baseUrl/api/auth/login"

Write-Host "Endpoint: $endpoint" -ForegroundColor Yellow
Write-Host "Limite: 5 tentativi al minuto" -ForegroundColor Yellow
Write-Host ""

$rateLimitHit = $false

for ($i=1; $i -le 7; $i++) {
    Write-Host "Tentativo $i..." -NoNewline
    
    try {
        $response = Invoke-WebRequest -Uri $endpoint `
            -Method POST `
            -Body @{
                username = "test@example.com"
                password = "wrongpassword"
            } `
            -ContentType "application/x-www-form-urlencoded" `
            -ErrorAction Stop
        
        Write-Host " Status: $($response.StatusCode)" -ForegroundColor Gray
        
        if ($response.StatusCode -eq 429) {
            Write-Host "  ✅ RATE LIMIT ATTIVO! Status 429 ricevuto" -ForegroundColor Green
            $rateLimitHit = $true
            break
        }
    }
    catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host " Status: $statusCode" -ForegroundColor Gray
        
        if ($statusCode -eq 429) {
            Write-Host "  ✅ RATE LIMIT ATTIVO! Status 429 ricevuto" -ForegroundColor Green
            $rateLimitHit = $true
            break
        }
        elseif ($statusCode -eq 401) {
            Write-Host "  (Login fallito - atteso)" -ForegroundColor DarkGray
        }
    }
    
    if ($i -lt 7) {
        Start-Sleep -Seconds 2
    }
}

Write-Host ""
if ($rateLimitHit) {
    Write-Host "✅ Test PASSATO: Rate limiting funziona correttamente!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Test FALLITO: Rate limit non è stato attivato dopo 5 tentativi" -ForegroundColor Yellow
    Write-Host "   Verifica che slowapi sia installato e il backend sia stato ricostruito" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Per testare di nuovo, attendi 1 minuto o riavvia il backend" -ForegroundColor Cyan
