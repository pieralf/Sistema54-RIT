# Script PowerShell per configurare certificati Let's Encrypt (gratuiti e pubblici)
# I certificati Let's Encrypt sono riconosciuti da TUTTI i browser senza importazione

param(
    [Parameter(Mandatory=$true)]
    [string]$DomainName,
    
    [Parameter(Mandatory=$false)]
    [string]$Email = "",
    
    [Parameter(Mandatory=$false)]
    [switch]$DryRun = $false
)

Write-Host "`n=== CONFIGURAZIONE CERTIFICATI LET'S ENCRYPT ===" -ForegroundColor Green
Write-Host "`n⚠️  IMPORTANTE:" -ForegroundColor Yellow
Write-Host "  Let's Encrypt funziona SOLO con domini pubblici!" -ForegroundColor Yellow
Write-Host "  NON funziona per localhost o IP privati (es. 192.168.x.x)" -ForegroundColor Red
Write-Host "`nRequisiti:" -ForegroundColor Cyan
Write-Host "  ✅ Dominio pubblico (es. esempio.com)" -ForegroundColor Green
Write-Host "  ✅ DNS configurato con A record che punta al server" -ForegroundColor Green
Write-Host "  ✅ Porta 80 aperta per validazione HTTP-01" -ForegroundColor Green
Write-Host "  ✅ Server raggiungibile da internet" -ForegroundColor Green

if ($DomainName -eq "localhost" -or $DomainName -match "^\d+\.\d+\.\d+\.\d+$" -or $DomainName -match "192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.) {
    Write-Host "`n[ERRORE] Let's Encrypt non funziona con localhost o IP privati!" -ForegroundColor Red
    Write-Host "`nAlternative:" -ForegroundColor Yellow
    Write-Host "  1. Usa mkcert per localhost (vedi generate_trusted_ssl_certs.ps1)" -ForegroundColor White
    Write-Host "  2. Configura un dominio pubblico e usa questo script" -ForegroundColor White
    Write-Host "  3. Usa un servizio come ngrok per esporre localhost" -ForegroundColor White
    exit 1
}

# Verifica se Certbot è installato
$certbotInstalled = Get-Command certbot -ErrorAction SilentlyContinue

if (-not $certbotInstalled) {
    Write-Host "`n[!] Certbot non trovato. Installazione necessaria..." -ForegroundColor Yellow
    
    $chocoInstalled = Get-Command choco -ErrorAction SilentlyContinue
    if ($chocoInstalled) {
        Write-Host "[OK] Trovato Chocolatey. Installazione Certbot..." -ForegroundColor Green
        choco install certbot -y
    } else {
        Write-Host "[ERRORE] Chocolatey non trovato." -ForegroundColor Red
        Write-Host "`nInstalla Certbot manualmente:" -ForegroundColor Yellow
        Write-Host "  1. Installa Chocolatey: https://chocolatey.org/install" -ForegroundColor White
        Write-Host "  2. Poi esegui: choco install certbot -y" -ForegroundColor White
        exit 1
    }
}

# Verifica privilegi amministratore
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "[ERRORE] Privilegi amministratore richiesti per Certbot." -ForegroundColor Red
    Write-Host "Esegui PowerShell come Administrator." -ForegroundColor Yellow
    exit 1
}

Write-Host "`n[OK] Certbot trovato. Configurazione certificati per: $DomainName" -ForegroundColor Green

# Se email non specificata, chiedi all'utente
if (-not $Email) {
    $Email = Read-Host "Inserisci email per notifiche Let's Encrypt (opzionale ma consigliato)"
}

# Parametri Certbot
$certbotParams = @(
    "certonly"
    "--standalone"
    "--preferred-challenges", "http"
    "-d", $DomainName
    "--non-interactive"
    "--agree-tos"
)

# Aggiungi email se specificata
if ($Email) {
    $certbotParams += "--email", $Email
} else {
    $certbotParams += "--register-unsafely-without-email"
}

# Aggiungi --dry-run se richiesto (per test)
if ($DryRun) {
    $certbotParams += "--dry-run"
    Write-Host "`n[TEST] Modalità dry-run attiva (nessun certificato reale verrà generato)" -ForegroundColor Yellow
}

# Verifica che nginx non sia in esecuzione (Certbot ha bisogno della porta 80)
Write-Host "`n⚠️  ATTENZIONE:" -ForegroundColor Yellow
Write-Host "  Certbot deve usare la porta 80 per validazione." -ForegroundColor Yellow
Write-Host "  nginx deve essere FERMATO durante la generazione." -ForegroundColor Yellow
$continue = Read-Host "`nVuoi continuare? (S/N)"

if ($continue -ne "S" -and $continue -ne "s") {
    Write-Host "Operazione annullata." -ForegroundColor Yellow
    exit 0
}

# Ferma nginx temporaneamente
Write-Host "`nFermo nginx..." -ForegroundColor Cyan
docker stop sistema54_nginx 2>&1 | Out-Null

try {
    # Genera certificati Let's Encrypt
    Write-Host "`nGenerazione certificati Let's Encrypt..." -ForegroundColor Cyan
    & certbot @certbotParams
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n[OK] Certificati generati con successo!" -ForegroundColor Green
        
        # Trova il percorso dei certificati Let's Encrypt
        $letsEncryptPath = "C:\Certbot\live\$DomainName"
        
        if (Test-Path $letsEncryptPath) {
            Write-Host "`nCopia certificati in nginx/ssl..." -ForegroundColor Cyan
            
            # Crea directory se non esiste
            if (-not (Test-Path "nginx\ssl")) {
                New-Item -ItemType Directory -Path "nginx\ssl" -Force | Out-Null
            }
            
            # Copia certificati
            Copy-Item "$letsEncryptPath\fullchain.pem" "nginx\ssl\cert.pem" -Force
            Copy-Item "$letsEncryptPath\privkey.pem" "nginx\ssl\key.pem" -Force
            
            Write-Host "[OK] Certificati copiati in nginx/ssl/" -ForegroundColor Green
            
            # Aggiorna nginx.conf per usare il dominio
            Write-Host "`n⚠️  IMPORTANTE:" -ForegroundColor Yellow
            Write-Host "  Aggiorna nginx.conf per usare il dominio '$DomainName'" -ForegroundColor Yellow
            Write-Host "  E aggiorna docker-compose con il dominio corretto" -ForegroundColor Yellow
            
            Write-Host "`nProssimi passi:" -ForegroundColor Cyan
            Write-Host "  1. Aggiorna nginx/nginx.conf con server_name $DomainName" -ForegroundColor White
            Write-Host "  2. Riavvia nginx: docker start sistema54_nginx" -ForegroundColor White
            Write-Host "  3. Accedi a: https://$DomainName" -ForegroundColor White
            Write-Host "`nIl certificato sarà trusted automaticamente da tutti i browser!" -ForegroundColor Green
            
            # Setup rinnovo automatico
            Write-Host "`nConfigurazione rinnovo automatico..." -ForegroundColor Cyan
            Write-Host "  Let's Encrypt richiede rinnovo ogni 90 giorni" -ForegroundColor Yellow
            Write-Host "  Crea un task schedulato Windows per:" -ForegroundColor Yellow
            Write-Host "    certbot renew --quiet && docker cp nginx\ssl\cert.pem sistema54_nginx:/etc/nginx/ssl/cert.pem && docker restart sistema54_nginx" -ForegroundColor Gray
        }
    } else {
        Write-Host "`n[ERRORE] Generazione certificati fallita." -ForegroundColor Red
        Write-Host "Verifica:" -ForegroundColor Yellow
        Write-Host "  - DNS configurato correttamente" -ForegroundColor White
        Write-Host "  - Porta 80 aperta e raggiungibile da internet" -ForegroundColor White
        Write-Host "  - Dominio raggiungibile dal server" -ForegroundColor White
    }
} catch {
    Write-Host "`n[ERRORE] Errore durante la generazione: $_" -ForegroundColor Red
} finally {
    # Riavvia nginx
    Write-Host "`nRiavvio nginx..." -ForegroundColor Cyan
    docker start sistema54_nginx 2>&1 | Out-Null
}
