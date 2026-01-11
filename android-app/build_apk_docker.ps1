# Script per compilare APK Android usando Docker
# Non richiede Android Studio installato

Write-Host ""
Write-Host "=== COMPILAZIONE APK ANDROID CON DOCKER ===" -ForegroundColor Cyan
Write-Host ""

# Verifica Docker
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "[ERRORE] Docker non trovato. Installa Docker Desktop:" -ForegroundColor Red
    Write-Host "  https://www.docker.com/products/docker-desktop" -ForegroundColor White
    exit 1
}

Write-Host "[OK] Docker trovato" -ForegroundColor Green

# Verifica che Docker sia in esecuzione
try {
    docker ps | Out-Null
    Write-Host "[OK] Docker in esecuzione" -ForegroundColor Green
} catch {
    Write-Host "[ERRORE] Docker non in esecuzione. Avvia Docker Desktop." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Avvio compilazione APK in container Docker..." -ForegroundColor Yellow
Write-Host ""

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$outputDir = Join-Path $scriptDir "output"

# Crea directory output se non esiste
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

# Costruisci immagine e compila
Write-Host "Fase 1: Preparazione ambiente Docker..." -ForegroundColor Cyan
docker build -t android-build:latest -f Dockerfile.build .

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERRORE] Build Docker fallita" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Fase 2: Estrazione APK dal container..." -ForegroundColor Cyan

# Crea container temporaneo e copia APK
$containerId = docker create android-build:latest
docker cp "${containerId}:/app/app/build/outputs/apk/debug/app-debug.apk" "$outputDir/app-debug.apk"
docker rm $containerId

if (Test-Path "$outputDir/app-debug.apk") {
    Write-Host ""
    Write-Host "=== COMPILAZIONE COMPLETATA ===" -ForegroundColor Green
    Write-Host ""
    Write-Host "APK generato:" -ForegroundColor Cyan
    Write-Host "  $outputDir/app-debug.apk" -ForegroundColor White
    Write-Host ""
    Write-Host "Per installare sul dispositivo Android:" -ForegroundColor Yellow
    Write-Host "  adb install $outputDir/app-debug.apk" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "[ERRORE] APK non generato correttamente" -ForegroundColor Red
    exit 1
}
