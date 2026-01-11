# Script per risolvere errori Gradle
# Pulisce cache Gradle e riavvia sincronizzazione

Write-Host ""
Write-Host "=== RISOLUZIONE ERRORE GRADLE ===" -ForegroundColor Cyan
Write-Host ""

$projectDir = $PSScriptRoot
$gradleDir = "$env:USERPROFILE\.gradle"

Write-Host "Cartella progetto: $projectDir" -ForegroundColor Yellow
Write-Host "Cartella Gradle: $gradleDir" -ForegroundColor Yellow
Write-Host ""

# Soluzione 1: Pulisci cache locale del progetto
Write-Host "Soluzione 1: Pulizia cache locale progetto..." -ForegroundColor Cyan
$localCacheDirs = @(
    "$projectDir\.gradle",
    "$projectDir\app\build",
    "$projectDir\build"
)

foreach ($dir in $localCacheDirs) {
    if (Test-Path $dir) {
        Write-Host "  Rimozione: $dir" -ForegroundColor Gray
        Remove-Item -Path $dir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "[OK] Cache locale pulita" -ForegroundColor Green
Write-Host ""

# Soluzione 2: Stop Gradle daemons
Write-Host "Soluzione 2: Arresto Gradle daemons..." -ForegroundColor Cyan
if (Get-Command gradle -ErrorAction SilentlyContinue) {
    try {
        gradle --stop 2>&1 | Out-Null
        Write-Host "[OK] Gradle daemons arrestati" -ForegroundColor Green
    } catch {
        Write-Host "[INFO] Gradle daemons non in esecuzione" -ForegroundColor Yellow
    }
} else {
    Write-Host "[INFO] Gradle non nel PATH, uso metodo alternativo" -ForegroundColor Yellow
    # Prova a killare processi Java/Gradle
    $gradleProcesses = Get-Process -Name "java" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*gradle*" }
    if ($gradleProcesses) {
        $gradleProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
        Write-Host "[OK] Processi Gradle arrestati" -ForegroundColor Green
    }
}

Write-Host ""

# Soluzione 3: Pulisci cache Gradle globale (opzionale)
Write-Host "Soluzione 3: Cache Gradle globale (opzionale)..." -ForegroundColor Cyan
Write-Host "  Cartella cache: $gradleDir\caches" -ForegroundColor Gray
Write-Host "  [INFO] Per pulire cache globale, esegui manualmente:" -ForegroundColor Yellow
Write-Host "    Remove-Item -Path '$gradleDir\caches' -Recurse -Force" -ForegroundColor White
Write-Host "  ATTENZIONE: Questo rimuoverà TUTTE le cache Gradle!" -ForegroundColor Red
Write-Host ""

# Istruzioni per Android Studio
Write-Host "=== PROSSIMI PASSI IN ANDROID STUDIO ===" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Chiudi Android Studio completamente" -ForegroundColor White
Write-Host ""
Write-Host "2. Riapri Android Studio" -ForegroundColor White
Write-Host ""
Write-Host "3. File -> Invalidate Caches / Restart..." -ForegroundColor White
Write-Host "   - Seleziona: Invalidate and Restart" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Dopo il riavvio, File -> Sync Project with Gradle Files" -ForegroundColor White
Write-Host ""
Write-Host "5. Se l'errore persiste:" -ForegroundColor White
Write-Host "   - Build -> Clean Project" -ForegroundColor Gray
Write-Host "   - Build -> Rebuild Project" -ForegroundColor Gray
Write-Host ""
Write-Host "=== ALTERNATIVA: Pulizia Manuale ===" -ForegroundColor Yellow
Write-Host ""
Write-Host "Se l'errore persiste, pulisci manualmente:" -ForegroundColor White
Write-Host ""
Write-Host "1. Chiudi Android Studio" -ForegroundColor White
Write-Host ""
Write-Host "2. Elimina cartelle:" -ForegroundColor White
Write-Host "   - $projectDir\.gradle" -ForegroundColor Gray
Write-Host "   - $projectDir\build" -ForegroundColor Gray
Write-Host "   - $projectDir\app\build" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Riapri Android Studio" -ForegroundColor White
Write-Host "4. File -> Sync Project with Gradle Files" -ForegroundColor White
Write-Host ""
