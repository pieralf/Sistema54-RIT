# Script per compilare APK Android
# Richiede: Android Studio installato o Android SDK configurato

param(
    [switch]$Force
)

Write-Host ""
Write-Host "=== COMPILAZIONE APK ANDROID - GIT ===" -ForegroundColor Cyan
Write-Host ""

# Verifica prerequisiti
$hasJava = Get-Command java -ErrorAction SilentlyContinue
$hasAndroidStudio = Test-Path "$env:LOCALAPPDATA\Programs\Android\Android Studio"
$hasAndroidSdk = $env:ANDROID_HOME -ne $null -or (Test-Path "$env:LOCALAPPDATA\Android\Sdk")

if (-not $hasJava) {
    Write-Host "[ERRORE] Java non trovato. Installa JDK 17+." -ForegroundColor Red
    exit 1
}

$javaVersion = java -version 2>&1 | Select-String -Pattern 'version' | Select-Object -First 1
Write-Host "[OK] Java trovato: $javaVersion" -ForegroundColor Green

if (-not $hasAndroidStudio -and -not $hasAndroidSdk) {
    Write-Host ""
    Write-Host "[ERRORE] Android Studio o Android SDK non trovati!" -ForegroundColor Red
    Write-Host ""
    Write-Host "OPZIONI:" -ForegroundColor Yellow
    Write-Host "  1. Installa Android Studio:" -ForegroundColor White
    Write-Host "     https://developer.android.com/studio" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  2. Oppure configura Android SDK manualmente:" -ForegroundColor White
    Write-Host "     - Installa Android SDK Command Line Tools" -ForegroundColor Gray
    Write-Host "     - Configura variabile ANDROID_HOME" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Dopo l'installazione:" -ForegroundColor Cyan
    Write-Host "  - Apri Android Studio" -ForegroundColor White
    Write-Host "  - File -> Open -> Seleziona cartella 'android-app'" -ForegroundColor White
    Write-Host "  - Build -> Build Bundle(s) / APK(s) -> Build APK(s)" -ForegroundColor White
    Write-Host ""
    exit 1
}

if ($hasAndroidStudio) {
    Write-Host "[OK] Android Studio trovato" -ForegroundColor Green
}

if ($hasAndroidSdk) {
    $sdkPath = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { "$env:LOCALAPPDATA\Android\Sdk" }
    Write-Host "[OK] Android SDK trovato: $sdkPath" -ForegroundColor Green
}

Write-Host ""
Write-Host "Verifica wrapper Gradle..." -ForegroundColor Yellow

# Cerca gradlew.bat
$gradlewPath = Join-Path $PSScriptRoot "gradlew.bat"
if (Test-Path $gradlewPath) {
    Write-Host "[OK] gradlew.bat trovato" -ForegroundColor Green
    Write-Host ""
    Write-Host "Avvio compilazione APK debug..." -ForegroundColor Cyan
    Write-Host ""
    
    # Compila APK debug
    & $gradlewPath clean assembleDebug
    
    if ($LASTEXITCODE -eq 0) {
        $apkPath = Join-Path $PSScriptRoot "app\build\outputs\apk\debug\app-debug.apk"
        if (Test-Path $apkPath) {
            Write-Host ""
            Write-Host "=== COMPILAZIONE COMPLETATA ===" -ForegroundColor Green
            Write-Host ""
            Write-Host "APK generato:" -ForegroundColor Cyan
            Write-Host "  $apkPath" -ForegroundColor White
            Write-Host ""
            Write-Host "Per installare sul dispositivo:" -ForegroundColor Yellow
            Write-Host "  adb install $apkPath" -ForegroundColor White
            Write-Host ""
        } else {
            Write-Host "[ERRORE] APK non trovato dopo compilazione" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host ""
        Write-Host "[ERRORE] Compilazione fallita. Controlla gli errori sopra." -ForegroundColor Red
        Write-Host ""
        Write-Host "SOLUZIONE ALTERNATIVA:" -ForegroundColor Yellow
        Write-Host "  Apri Android Studio -> File -> Open -> Seleziona 'android-app'" -ForegroundColor White
        Write-Host "  Build -> Build Bundle(s) / APK(s) -> Build APK(s)" -ForegroundColor White
        Write-Host ""
        exit 1
    }
} else {
    Write-Host "[INFO] gradlew.bat non trovato" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Il wrapper Gradle deve essere generato da Android Studio." -ForegroundColor Cyan
    Write-Host ""
    Write-Host "ISTRUZIONI:" -ForegroundColor Yellow
    Write-Host "  1. Apri Android Studio" -ForegroundColor White
    Write-Host "  2. File -> Open -> Seleziona cartella 'android-app'" -ForegroundColor White
    Write-Host "  3. Android Studio genererà automaticamente gradlew.bat" -ForegroundColor White
    Write-Host "  4. Build -> Build Bundle(s) / APK(s) -> Build APK(s)" -ForegroundColor White
    Write-Host ""
    Write-Host "  Oppure da terminale Android Studio:" -ForegroundColor White
    Write-Host "    .\gradlew.bat assembleDebug" -ForegroundColor Gray
    Write-Host ""
}
