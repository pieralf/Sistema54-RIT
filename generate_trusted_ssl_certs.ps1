# Script PowerShell per generare certificati SSL trusted usando mkcert
# Questo script installa mkcert e genera certificati validi per localhost

Write-Host "`n=== GENERAZIONE CERTIFICATI SSL TRUSTED ===" -ForegroundColor Green
Write-Host "`nQuesto script utilizzerà mkcert per generare certificati trusted." -ForegroundColor Yellow

# Verifica se mkcert è installato
$mkcertInstalled = Get-Command mkcert -ErrorAction SilentlyContinue

if (-not $mkcertInstalled) {
    Write-Host "`n[!] mkcert non trovato. Installazione necessaria..." -ForegroundColor Yellow
    
    # Verifica se Chocolatey è installato
    $chocoInstalled = Get-Command choco -ErrorAction SilentlyContinue
    
    if ($chocoInstalled) {
        Write-Host "[OK] Trovato Chocolatey. Installazione mkcert..." -ForegroundColor Green
        choco install mkcert -y
    } else {
        Write-Host "[ERRORE] Chocolatey non trovato." -ForegroundColor Red
        Write-Host "`nInstalla Chocolatey da: https://chocolatey.org/install" -ForegroundColor Yellow
        Write-Host "Oppure installa mkcert manualmente da: https://github.com/FiloSottile/mkcert" -ForegroundColor Yellow
        Write-Host "`nPer installare Chocolatey, esegui come Administrator:" -ForegroundColor Cyan
        Write-Host '  Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString("https://community.chocolatey.org/install.ps1"))' -ForegroundColor White
        exit 1
    }
}

# Re-verifica mkcert dopo installazione
$mkcertInstalled = Get-Command mkcert -ErrorAction SilentlyContinue
if (-not $mkcertInstalled) {
    Write-Host "[ERRORE] mkcert non installato correttamente." -ForegroundColor Red
    exit 1
}

Write-Host "`n[OK] mkcert trovato. Generazione certificati..." -ForegroundColor Green

# Crea directory per certificati se non esiste
$sslDir = "nginx\ssl"
if (-not (Test-Path $sslDir)) {
    New-Item -ItemType Directory -Path $sslDir -Force | Out-Null
    Write-Host "[OK] Creata directory: $sslDir" -ForegroundColor Green
}

# Installa root CA locale (solo una volta)
Write-Host "`nInstallazione root CA locale (solo se non già installato)..." -ForegroundColor Cyan
mkcert -install 2>&1 | Out-Null

# Genera certificati per localhost e 127.0.0.1
Write-Host "`nGenerazione certificati per localhost e 127.0.0.1..." -ForegroundColor Cyan
Push-Location $sslDir
try {
    mkcert localhost 127.0.0.1 ::1
    
    # Rinomina i file generati
    if (Test-Path "localhost+2.pem") {
        Move-Item "localhost+2.pem" "cert.pem" -Force
        Write-Host "[OK] Certificato creato: cert.pem" -ForegroundColor Green
    }
    if (Test-Path "localhost+2-key.pem") {
        Move-Item "localhost+2-key.pem" "key.pem" -Force
        Write-Host "[OK] Chiave privata creata: key.pem" -ForegroundColor Green
    }
} catch {
    Write-Host "[ERRORE] Errore durante la generazione dei certificati: $_" -ForegroundColor Red
    exit 1
} finally {
    Pop-Location
}

Write-Host "`n[OK] Certificati generati con successo!" -ForegroundColor Green
Write-Host "`nI certificati sono validi per 10 anni e sono trusted dal sistema Windows." -ForegroundColor Cyan
Write-Host "`n⚠️  IMPORTANTE PER FIREFOX:" -ForegroundColor Yellow
Write-Host "  Firefox ha il proprio certificate store separato da Windows!" -ForegroundColor Yellow
Write-Host "  Devi importare il certificato anche in Firefox:" -ForegroundColor Yellow
Write-Host "`n  1. Apri Firefox → about:preferences#privacy" -ForegroundColor White
Write-Host "  2. Scrolla fino a 'Certificati' → 'Visualizza certificati'" -ForegroundColor White
Write-Host "  3. Tab 'Autorità' → 'Importa...'" -ForegroundColor White
Write-Host "  4. Seleziona: nginx\ssl\cert.pem" -ForegroundColor White
Write-Host "  5. Seleziona: 'Fiducia per questo certificato per identificare siti web'" -ForegroundColor White
Write-Host "  6. Click OK e riavvia Firefox" -ForegroundColor White
Write-Host "`n  Vedi import_certificate_firefox.md per istruzioni dettagliate" -ForegroundColor Cyan
Write-Host "`nProssimi passi:" -ForegroundColor Yellow
Write-Host "  1. Importa il certificato in Firefox (vedi sopra)" -ForegroundColor White
Write-Host "  2. Riavvia i container Docker:" -ForegroundColor White
Write-Host "     docker compose -f docker-compose.desktop.prod.namedvol.yml restart nginx" -ForegroundColor Gray
Write-Host "`n  3. Accedi all'applicazione:" -ForegroundColor White
Write-Host "     https://localhost:26443" -ForegroundColor Gray
Write-Host "`nNote:" -ForegroundColor Yellow
Write-Host "  - I certificati sono validi solo per localhost e 127.0.0.1" -ForegroundColor Gray
Write-Host "  - Per altri domini/IP, aggiungili al comando mkcert" -ForegroundColor Gray
Write-Host "  - Esempio: mkcert localhost 127.0.0.1 192.168.1.100 mydomain.local" -ForegroundColor Gray
