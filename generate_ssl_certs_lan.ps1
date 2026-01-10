# Script PowerShell per generare certificati SSL trusted per LAN aziendale e localhost
# Usa mkcert per creare certificati validi per IP LAN, hostname e localhost

param(
    [Parameter(Mandatory=$false)]
    [string[]]$IPAddresses = @(),
    
    [Parameter(Mandatory=$false)]
    [string[]]$Hostnames = @(),
    
    [Parameter(Mandatory=$false)]
    [switch]$AutoDetectLAN = $false
)

Write-Host "`n=== GENERAZIONE CERTIFICATI SSL PER LAN AZIENDALE ===" -ForegroundColor Green
Write-Host "`nQuesto script genera certificati trusted per:" -ForegroundColor Yellow
Write-Host "  - localhost / 127.0.0.1" -ForegroundColor White
Write-Host "  - IP LAN aziendale" -ForegroundColor White
Write-Host "  - Hostname del server" -ForegroundColor White
Write-Host "  - Domini .local / .lan" -ForegroundColor White

# Verifica se mkcert è installato
$mkcertInstalled = Get-Command mkcert -ErrorAction SilentlyContinue

if (-not $mkcertInstalled) {
    Write-Host "`n[!] mkcert non trovato. Installazione necessaria..." -ForegroundColor Yellow
    
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

# Re-verifica mkcert
$mkcertInstalled = Get-Command mkcert -ErrorAction SilentlyContinue
if (-not $mkcertInstalled) {
    Write-Host "[ERRORE] mkcert non installato correttamente." -ForegroundColor Red
    exit 1
}

Write-Host "`n[OK] mkcert trovato." -ForegroundColor Green

# Installa root CA locale (solo una volta)
Write-Host "`nInstallazione root CA locale..." -ForegroundColor Cyan
mkcert -install 2>&1 | Out-Null
Write-Host "[OK] Root CA installata" -ForegroundColor Green

# Crea directory per certificati
$sslDir = "nginx\ssl"
if (-not (Test-Path $sslDir)) {
    New-Item -ItemType Directory -Path $sslDir -Force | Out-Null
    Write-Host "[OK] Creata directory: $sslDir" -ForegroundColor Green
}

# Raccogli tutti i nomi/IP per il certificato
$certNames = @("localhost", "127.0.0.1", "::1")

# Aggiungi hostname del computer
$hostname = $env:COMPUTERNAME
if ($hostname) {
    $certNames += $hostname.ToLower()
    Write-Host "[OK] Aggiunto hostname: $hostname" -ForegroundColor Green
}

# Auto-detect IP LAN se richiesto
if ($AutoDetectLAN) {
    Write-Host "`nRilevamento automatico IP LAN..." -ForegroundColor Cyan
    $networkAdapters = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { 
        $_.IPAddress -notmatch "^127\." -and 
        $_.IPAddress -notmatch "^169\.254\." -and 
        $_.IPAddress -notmatch "^0\.0\.0\.0$"
    }
    
    foreach ($adapter in $networkAdapters) {
        $ip = $adapter.IPAddress
        if ($ip -match "^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)") {
            $certNames += $ip
            Write-Host "[OK] Aggiunto IP LAN: $ip" -ForegroundColor Green
        }
    }
}

# Aggiungi IP forniti manualmente
foreach ($ip in $IPAddresses) {
    if ($ip -notin $certNames) {
        $certNames += $ip
        Write-Host "[OK] Aggiunto IP: $ip" -ForegroundColor Green
    }
}

# Aggiungi hostname forniti manualmente
foreach ($hostname in $Hostnames) {
    if ($hostname -notin $certNames) {
        $certNames += $hostname.ToLower()
        Write-Host "[OK] Aggiunto hostname: $hostname" -ForegroundColor Green
    }
}

# Rimuovi duplicati
$certNames = $certNames | Select-Object -Unique

Write-Host "`nGenerazione certificato per:" -ForegroundColor Cyan
foreach ($name in $certNames) {
    Write-Host "  - $name" -ForegroundColor Gray
}

# Genera certificati
Write-Host "`nGenerazione certificati..." -ForegroundColor Cyan
Push-Location $sslDir
try {
    # Genera certificati (mkcert accetta array di nomi)
    # Esempio: mkcert localhost 127.0.0.1 192.168.1.100 server.local
    $certNamesString = $certNames -join " "
    Write-Host "Esecuzione: mkcert $certNamesString" -ForegroundColor Gray
    
    # Converti array in argomenti separati
    & mkcert $certNames
    
    # Trova i file generati (mkcert crea nome in base ai domini)
    $certFiles = Get-ChildItem -Filter "*.pem" | Where-Object { $_.Name -like "*-key.pem" -or $_.Name -like "*.pem" -and $_.Name -notlike "*-key.pem" }
    
    # Rinomina i file
    foreach ($file in $certFiles) {
        if ($file.Name -match "-key\.pem$") {
            Move-Item $file.FullName "key.pem" -Force
            Write-Host "[OK] Chiave privata: key.pem" -ForegroundColor Green
        } else {
            Move-Item $file.FullName "cert.pem" -Force
            Write-Host "[OK] Certificato: cert.pem" -ForegroundColor Green
        }
    }
    
    # Se non trovati, cerca con pattern alternativo
    if (-not (Test-Path "cert.pem")) {
        $allPemFiles = Get-ChildItem -Filter "*.pem"
        if ($allPemFiles.Count -ge 2) {
            # Ordina per data (il più recente è quello generato)
            $newest = $allPemFiles | Sort-Object LastWriteTime -Descending | Select-Object -First 2
            if ($newest.Count -eq 2) {
                $newest[0].Name | Out-Null  # Ignora il key
                Move-Item $newest[1].FullName "cert.pem" -Force
                Move-Item $newest[0].FullName "key.pem" -Force
                Write-Host "[OK] Certificati rinominati" -ForegroundColor Green
            }
        }
    }
    
} catch {
    Write-Host "[ERRORE] Errore durante la generazione: $_" -ForegroundColor Red
    exit 1
} finally {
    Pop-Location
}

# Verifica che i certificati siano stati creati
if (Test-Path "$sslDir\cert.pem" -and Test-Path "$sslDir\key.pem") {
    Write-Host "`n[OK] Certificati generati con successo!" -ForegroundColor Green
    
    Write-Host "`nCertificato valido per:" -ForegroundColor Cyan
    foreach ($name in $certNames) {
        Write-Host "  ✅ $name" -ForegroundColor Green
    }
    
    Write-Host "`n⚠️  IMPORTANTE PER LA LAN AZIENDALE:" -ForegroundColor Yellow
    Write-Host "  I certificati sono trusted SOLO sul computer corrente!" -ForegroundColor Yellow
    Write-Host "  Per usare su altri computer LAN:" -ForegroundColor Yellow
    Write-Host "  1. Copia il root CA (vedi comando sotto)" -ForegroundColor White
    Write-Host "  2. Importalo su ogni computer client" -ForegroundColor White
    Write-Host "  3. O usa una CA interna aziendale (vedi SETUP_CA_AZIENDALE.md)" -ForegroundColor White
    
    # Trova il percorso del root CA di mkcert
    $mkcertCARoot = $env:LOCALAPPDATA + "\mkcert"
    if (Test-Path "$mkcertCARoot\rootCA.pem") {
        Write-Host "`nPercorso root CA per distribuzione LAN:" -ForegroundColor Cyan
        Write-Host "  $mkcertCARoot\rootCA.pem" -ForegroundColor Gray
        Write-Host "`nCopia questo file su ogni computer e importalo come trusted root CA" -ForegroundColor Yellow
    }
    
    Write-Host "`nProssimi passi:" -ForegroundColor Yellow
    Write-Host "  1. Copia certificati nel container Docker:" -ForegroundColor White
    Write-Host "     docker cp nginx\ssl\cert.pem sistema54_nginx:/etc/nginx/ssl/cert.pem" -ForegroundColor Gray
    Write-Host "     docker cp nginx\ssl\key.pem sistema54_nginx:/etc/nginx/ssl/key.pem" -ForegroundColor Gray
    Write-Host "`n  2. Riavvia nginx:" -ForegroundColor White
    Write-Host "     docker restart sistema54_nginx" -ForegroundColor Gray
    Write-Host "`n  3. Per distribuire su altri PC LAN:" -ForegroundColor White
    Write-Host "     Vedi DISTRIBUIZIONE_CERTIFICATI_LAN.md" -ForegroundColor Gray
    
} else {
    Write-Host "`n[ERRORE] Certificati non trovati!" -ForegroundColor Red
    exit 1
}
