# Script PowerShell per testare Security Headers
# Esegui: .\test_security_headers.ps1

Write-Host "🔒 Test Security Headers" -ForegroundColor Cyan
Write-Host "========================" -ForegroundColor Cyan
Write-Host ""

$baseUrl = "http://localhost:26101"

# Endpoint pubblici (non richiedono autenticazione)
$endpoints = @(
    "/api/health",
    "/docs"  # Swagger UI
)

$allHeadersPresent = $true
$requiredHeaders = @(
    "X-Content-Type-Options",
    "X-Frame-Options",
    "X-XSS-Protection",
    "Content-Security-Policy"
)

foreach ($endpoint in $endpoints) {
    $url = "$baseUrl$endpoint"
    Write-Host "Testing: $url" -ForegroundColor Yellow
    
    try {
        $response = Invoke-WebRequest -Uri $url -Method GET -ErrorAction Stop
        
        Write-Host "  Status: $($response.StatusCode)" -ForegroundColor Gray
        
        $missingHeaders = @()
        foreach ($header in $requiredHeaders) {
            if ($response.Headers[$header]) {
                $value = $response.Headers[$header]
                Write-Host "  ✅ $header`: $value" -ForegroundColor Green
            } else {
                Write-Host "  ❌ $header`: MANCANTE" -ForegroundColor Red
                $missingHeaders += $header
                $allHeadersPresent = $false
            }
        }
        
        if ($missingHeaders.Count -eq 0) {
            Write-Host "  ✅ Tutti gli header sono presenti!" -ForegroundColor Green
        } else {
            Write-Host "  ❌ Header mancanti: $($missingHeaders -join ', ')" -ForegroundColor Red
        }
    }
    catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "  ⚠️  Status: $statusCode (endpoint potrebbe non esistere)" -ForegroundColor Yellow
    }
    
    Write-Host ""
}

if ($allHeadersPresent) {
    Write-Host "✅ Test PASSATO: Tutti i security headers sono presenti!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Test FALLITO: Alcuni security headers sono mancanti" -ForegroundColor Yellow
    Write-Host "   Verifica che il middleware sia attivo nel backend" -ForegroundColor Yellow
}
