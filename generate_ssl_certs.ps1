# Script PowerShell per generare certificati SSL auto-firmati validi per 10 anni
# Richiede OpenSSL installato: https://slproweb.com/products/Win32OpenSSL.html

param(
    [string]$Domain = "localhost",
    [int]$DaysValid = 3650  # 10 anni
)

$CertDir = "nginx/ssl"
$CertPath = Join-Path $CertDir "cert.pem"
$KeyPath = Join-Path $CertDir "key.pem"

# Verifica OpenSSL
$openssl = Get-Command openssl -ErrorAction SilentlyContinue
if (-not $openssl) {
    Write-Host "ERRORE: OpenSSL non trovato." -ForegroundColor Red
    Write-Host "Installa da: https://slproweb.com/products/Win32OpenSSL.html" -ForegroundColor Yellow
    Write-Host "Oppure usa Git Bash con il file generate_ssl_certs.sh" -ForegroundColor Yellow
    exit 1
}

# Crea directory
if (-not (Test-Path $CertDir)) {
    New-Item -ItemType Directory -Path $CertDir -Force | Out-Null
}

Write-Host "Generazione certificati SSL per dominio: $Domain" -ForegroundColor Cyan
Write-Host "Validità: 10 anni ($DaysValid giorni)" -ForegroundColor Gray

# Genera chiave privata
Write-Host "`nGenerazione chiave privata..." -ForegroundColor Yellow
& openssl genrsa -out $KeyPath 2048
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERRORE: Generazione chiave fallita" -ForegroundColor Red
    exit 1
}

# Genera certificato auto-firmato
Write-Host "Generazione certificato..." -ForegroundColor Yellow
& openssl req -new -x509 -key $KeyPath -out $CertPath -days $DaysValid `
    -subj "/C=IT/ST=Italy/L=Italy/O=GIT/OU=IT Department/CN=$Domain" `
    -addext "subjectAltName=DNS:$Domain,DNS:*.$Domain,DNS:localhost,DNS:*.local,IP:127.0.0.1"

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERRORE: Generazione certificato fallita" -ForegroundColor Red
    exit 1
}

# Verifica certificato
Write-Host "`nVerifica certificato..." -ForegroundColor Yellow
$certInfo = & openssl x509 -in $CertPath -noout -enddate -subject
$endDate = ($certInfo | Select-String "notAfter=(\d{4}/\d{2}/\d{2})").Matches.Groups[1].Value

Write-Host "`n✅ Certificati generati con successo!" -ForegroundColor Green
Write-Host "`nFile generati:" -ForegroundColor Cyan
Write-Host "  - $KeyPath (chiave privata)" -ForegroundColor Gray
Write-Host "  - $CertPath (certificato)" -ForegroundColor Gray
Write-Host "`nValido fino a: $endDate" -ForegroundColor Yellow
Write-Host "`n⚠️  NOTA: Certificati auto-firmati. Il browser mostrerà un avviso di sicurezza." -ForegroundColor Yellow
Write-Host "   Per produzione, considera Let's Encrypt o certificati firmati da una CA." -ForegroundColor Gray
