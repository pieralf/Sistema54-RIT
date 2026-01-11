# Script per installare Android Studio
# Guida l'utente nel processo di installazione

Write-Host ""
Write-Host "=== INSTALLAZIONE ANDROID STUDIO ===" -ForegroundColor Cyan
Write-Host ""

# Verifica se Android Studio è già installato
$androidStudioPaths = @(
    "$env:LOCALAPPDATA\Programs\Android\Android Studio",
    "$env:ProgramFiles\Android\Android Studio",
    "$env:ProgramFiles(x86)\Android\Android Studio"
)

$found = $false
foreach ($path in $androidStudioPaths) {
    if (Test-Path $path) {
        Write-Host "[OK] Android Studio già installato in: $path" -ForegroundColor Green
        $found = $true
        break
    }
}

if ($found) {
    Write-Host ""
    Write-Host "Android Studio è già installato!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Prossimi passi:" -ForegroundColor Yellow
    Write-Host "  1. Apri Android Studio" -ForegroundColor White
    Write-Host "  2. File -> Open -> Seleziona cartella 'android-app'" -ForegroundColor White
    Write-Host "  3. Attendi sincronizzazione Gradle" -ForegroundColor White
    Write-Host "  4. Build -> Build Bundle(s) / APK(s) -> Build APK(s)" -ForegroundColor White
    Write-Host ""
    exit 0
}

Write-Host "Android Studio non trovato nei percorsi standard." -ForegroundColor Yellow
Write-Host ""

# Verifica se c'è un file di installazione locale
$installerPath = Join-Path $PSScriptRoot "android-studio*.exe"
$installer = Get-ChildItem -Path $installerPath -ErrorAction SilentlyContinue | Select-Object -First 1

if ($installer) {
    Write-Host "[INFO] Trovato file di installazione: $($installer.Name)" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Per installare Android Studio:" -ForegroundColor Yellow
    Write-Host "  1. Esegui il file: $($installer.FullName)" -ForegroundColor White
    Write-Host "  2. Segui le istruzioni dell'installer" -ForegroundColor White
    Write-Host "  3. Dopo l'installazione, riavvia questo script per verificare" -ForegroundColor White
    Write-Host ""
    Write-Host "Vuoi aprire l'installer ora? (S/N): " -ForegroundColor Cyan -NoNewline
    $response = Read-Host
    if ($response -eq "S" -or $response -eq "s" -or $response -eq "Y" -or $response -eq "y") {
        Start-Process $installer.FullName
        Write-Host ""
        Write-Host "[OK] Installer avviato. Attendi il completamento dell'installazione." -ForegroundColor Green
        Write-Host ""
    }
    exit 0
}

# Fornisce istruzioni per il download
Write-Host "=== ISTRUZIONI INSTALLAZIONE ===" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. DOWNLOAD ANDROID STUDIO:" -ForegroundColor Cyan
Write-Host "   - Vai a: https://developer.android.com/studio" -ForegroundColor White
Write-Host "   - Clicca su 'Download Android Studio'" -ForegroundColor White
Write-Host "   - Scarica il file .exe per Windows" -ForegroundColor White
Write-Host ""
Write-Host "2. INSTALLAZIONE:" -ForegroundColor Cyan
Write-Host "   - Esegui il file .exe scaricato" -ForegroundColor White
Write-Host "   - Segui le istruzioni dell'installer" -ForegroundColor White
Write-Host "   - Durante l'installazione:" -ForegroundColor White
Write-Host "     * Accetta le licenze" -ForegroundColor Gray
Write-Host "     * Installa Android SDK (consigliato)" -ForegroundColor Gray
Write-Host "     * Installa Android Virtual Device (opzionale, per emulatore)" -ForegroundColor Gray
Write-Host ""
Write-Host "3. DOPO L'INSTALLAZIONE:" -ForegroundColor Cyan
Write-Host "   - Apri Android Studio" -ForegroundColor White
Write-Host "   - Completa la configurazione iniziale (Setup Wizard)" -ForegroundColor White
Write-Host "   - Attendi il download dei componenti aggiuntivi (potrebbe richiedere tempo)" -ForegroundColor White
Write-Host ""
Write-Host "4. APRI IL PROGETTO:" -ForegroundColor Cyan
Write-Host "   - File -> Open -> Seleziona cartella 'android-app'" -ForegroundColor White
Write-Host "   - Attendi sincronizzazione Gradle (automatica)" -ForegroundColor White
Write-Host ""
Write-Host "5. COMPILA APK:" -ForegroundColor Cyan
Write-Host "   - Build -> Build Bundle(s) / APK(s) -> Build APK(s)" -ForegroundColor White
Write-Host "   - APK generato in: app\build\outputs\apk\debug\app-debug.apk" -ForegroundColor White
Write-Host ""
Write-Host "=== DOWNLOAD DIRETTO ===" -ForegroundColor Yellow
Write-Host ""
Write-Host "Link diretto download:" -ForegroundColor Cyan
Write-Host "  https://redirector.gvt1.com/edgedl/android/studio/install/2023.2.1.27/android-studio-2023.2.1.27-windows.exe" -ForegroundColor White
Write-Host ""
Write-Host "Vuoi aprire il browser per il download? (S/N): " -ForegroundColor Cyan -NoNewline
$response = Read-Host
if ($response -eq "S" -or $response -eq "s" -or $response -eq "Y" -or $response -eq "y") {
    Start-Process "https://developer.android.com/studio"
    Write-Host ""
    Write-Host "[OK] Browser aperto. Scarica Android Studio." -ForegroundColor Green
    Write-Host ""
}

Write-Host ""
Write-Host "=== NOTE IMPORTANTI ===" -ForegroundColor Yellow
Write-Host ""
Write-Host "- L'installazione richiede circa 1-2 GB di spazio" -ForegroundColor White
Write-Host "- Il primo avvio può richiedere 5-10 minuti (download componenti)" -ForegroundColor White
Write-Host "- Richiede connessione internet per download componenti" -ForegroundColor White
Write-Host "- Dopo l'installazione, riavvia questo script per verificare" -ForegroundColor White
Write-Host ""
