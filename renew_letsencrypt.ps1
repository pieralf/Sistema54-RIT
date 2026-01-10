# Script per rinnovare automaticamente certificati Let's Encrypt
# Da eseguire mensilmente tramite Task Scheduler Windows

param(
    [Parameter(Mandatory=$true)]
    [string]$DomainName
)

Write-Host "`n=== RINNOVO CERTIFICATI LET'S ENCRYPT ===" -ForegroundColor Green
Write-Host "Dominio: $DomainName" -ForegroundColor Cyan

# Verifica se Certbot è installato
$certbotInstalled = Get-Command certbot -ErrorAction SilentlyContinue
if (-not $certbotInstalled) {
    Write-Host "[ERRORE] Certbot non trovato. Installalo con: choco install certbot" -ForegroundColor Red
    exit 1
}

# Path certificati Let's Encrypt
$letsEncryptPath = "C:\Certbot\live\$DomainName"
$sslDir = "nginx\ssl"

# Verifica che i certificati esistano
if (-not (Test-Path "$letsEncryptPath\fullchain.pem")) {
    Write-Host "[ERRORE] Certificati Let's Encrypt non trovati in: $letsEncryptPath" -ForegroundColor Red
    exit 1
}

# Ferma nginx temporaneamente (Certbot ha bisogno della porta 80)
Write-Host "`nFermo nginx..." -ForegroundColor Cyan
docker stop sistema54_nginx 2>&1 | Out-Null

try {
    # Rinnova certificati (--quiet per output minimo)
    Write-Host "Rinnovo certificati..." -ForegroundColor Cyan
    & certbot renew --quiet --standalone --preferred-challenges http
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Certificati rinnovati (o già validi)" -ForegroundColor Green
        
        # Copia nuovi certificati
        Write-Host "Copia certificati..." -ForegroundColor Cyan
        Copy-Item "$letsEncryptPath\fullchain.pem" "$sslDir\cert.pem" -Force
        Copy-Item "$letsEncryptPath\privkey.pem" "$sslDir\key.pem" -Force
        
        Write-Host "[OK] Certificati copiati in $sslDir" -ForegroundColor Green
        
        # Copia nel container Docker
        Write-Host "Aggiornamento container nginx..." -ForegroundColor Cyan
        docker cp "$sslDir\cert.pem" sistema54_nginx:/etc/nginx/ssl/cert.pem 2>&1 | Out-Null
        docker cp "$sslDir\key.pem" sistema54_nginx:/etc/nginx/ssl/key.pem 2>&1 | Out-Null
        
        # Riavvia nginx per applicare nuovi certificati
        Write-Host "Riavvio nginx..." -ForegroundColor Cyan
        docker restart sistema54_nginx 2>&1 | Out-Null
        
        Write-Host "`n[OK] Rinnovo completato con successo!" -ForegroundColor Green
    } else {
        Write-Host "[ERRORE] Rinnovo fallito. Controlla i log." -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "[ERRORE] Errore durante il rinnovo: $_" -ForegroundColor Red
    exit 1
} finally {
    # Assicurati che nginx sia riavviato
    $nginxStatus = docker ps --filter "name=sistema54_nginx" --format "{{.Names}}" 2>&1
    if (-not $nginxStatus) {
        Write-Host "Riavvio nginx..." -ForegroundColor Cyan
        docker start sistema54_nginx 2>&1 | Out-Null
    }
}
