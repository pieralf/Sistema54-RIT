# Script per leggere i log dell'app GIT da Android
# Uso: .\leggi_log.ps1

Write-Host "=== LETTURA LOG APP GIT ===" -ForegroundColor Cyan
Write-Host ""

# Verifica se ADB è disponibile
$adbPath = Get-Command adb -ErrorAction SilentlyContinue
if (-not $adbPath) {
    Write-Host "ERRORE: ADB non trovato!" -ForegroundColor Red
    Write-Host "Installa Android SDK Platform Tools o Android Studio" -ForegroundColor Yellow
    Write-Host "Download: https://developer.android.com/tools/releases/platform-tools" -ForegroundColor Yellow
    exit 1
}

# Verifica connessione dispositivo
Write-Host "Verifica dispositivi connessi..." -ForegroundColor Yellow
$devices = adb devices
Write-Host $devices

if ($devices -notmatch "device$") {
    Write-Host "`nERRORE: Nessun dispositivo connesso!" -ForegroundColor Red
    Write-Host "Assicurati di:" -ForegroundColor Yellow
    Write-Host "  1. Aver collegato il telefono via USB" -ForegroundColor White
    Write-Host "  2. Aver abilitato Debug USB nelle opzioni sviluppatore" -ForegroundColor White
    Write-Host "  3. Aver autorizzato il PC sul telefono" -ForegroundColor White
    exit 1
}

Write-Host "`n=== OPZIONI ===" -ForegroundColor Cyan
Write-Host "1. Log in tempo reale (filtro GIT)" -ForegroundColor White
Write-Host "2. Log in tempo reale (tutti i log)" -ForegroundColor White
Write-Host "3. Salva log in file" -ForegroundColor White
Write-Host "4. Solo errori e warning" -ForegroundColor White
Write-Host "5. Pulisci log e inizia da zero" -ForegroundColor White
Write-Host ""

$scelta = Read-Host "Scegli opzione (1-5)"

switch ($scelta) {
    "1" {
        Write-Host "`nAvvio log in tempo reale (filtro GIT)..." -ForegroundColor Green
        Write-Host "Premi Ctrl+C per fermare`n" -ForegroundColor Yellow
        adb logcat -v time | Select-String -Pattern "MainActivity|WebAppActivity|WireGuardManager|VPN|git" -Context 0,1
    }
    "2" {
        Write-Host "`nAvvio log in tempo reale (tutti)..." -ForegroundColor Green
        Write-Host "Premi Ctrl+C per fermare`n" -ForegroundColor Yellow
        adb logcat -v time
    }
    "3" {
        $fileName = "log_git_$(Get-Date -Format 'yyyyMMdd_HHmmss').txt"
        Write-Host "`nSalvataggio log in: $fileName" -ForegroundColor Green
        Write-Host "Premi Ctrl+C per fermare`n" -ForegroundColor Yellow
        adb logcat -v time | Tee-Object -FilePath $fileName
    }
    "4" {
        Write-Host "`nMostro solo errori e warning..." -ForegroundColor Green
        Write-Host "Premi Ctrl+C per fermare`n" -ForegroundColor Yellow
        adb logcat *:E *:W
    }
    "5" {
        Write-Host "`nPulizia log vecchi..." -ForegroundColor Yellow
        adb logcat -c
        Write-Host "Log puliti! Avvio lettura..." -ForegroundColor Green
        Write-Host "Premi Ctrl+C per fermare`n" -ForegroundColor Yellow
        adb logcat -v time | Select-String -Pattern "MainActivity|WebAppActivity|WireGuardManager|VPN|git" -Context 0,1
    }
    default {
        Write-Host "Opzione non valida!" -ForegroundColor Red
    }
}
