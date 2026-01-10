# Istruzioni Compilazione APK Sistema54

## Prerequisiti

1. **Android Studio** (ultima versione)
   - Download: https://developer.android.com/studio
   - Richiede JDK 17 o superiore

2. **Dispositivo Android** o **Emulatore**
   - Minimo Android 7.0 (API 24)
   - Connessione internet per prima configurazione

## Configurazione Iniziale

### 1. Apri il Progetto

```bash
cd android-app
```

Apri la cartella `android-app` in Android Studio (File → Open → Seleziona cartella `android-app`)

### 2. Configura VPN Keys

**IMPORTANTE**: Prima di compilare, configura le chiavi VPN nel file:

`app/src/main/java/com/sistema54/vpn/VPNConfig.kt`

Sostituisci:
```kotlin
const val serverIP = "YOUR_SERVER_IP"
const val serverPublicKey = "SERVER_PUBLIC_KEY"
const val clientPrivateKey = "CLIENT_PRIVATE_KEY"
```

Con i tuoi valori reali (vedi `SETUP_SERVER.md` per generare le chiavi).

### 3. Sincronizza Gradle

Android Studio dovrebbe sincronizzare automaticamente. Se no:
- File → Sync Project with Gradle Files

## Compilazione

### Debug APK (per test)

1. Build → Build Bundle(s) / APK(s) → Build APK(s)
2. L'APK sarà in: `app/build/outputs/apk/debug/app-debug.apk`
3. Installa sul dispositivo: `adb install app-debug.apk`

### Release APK (per produzione)

1. Crea keystore (se non esiste):
```bash
keytool -genkey -v -keystore sistema54-release.keystore -alias sistema54 -keyalg RSA -keysize 2048 -validity 10000
```

2. Configura `app/build.gradle` con keystore (vedi sotto)

3. Build → Generate Signed Bundle / APK → APK

4. Seleziona keystore e password

5. L'APK sarà in: `app/build/outputs/apk/release/app-release.apk`

### Configurazione Keystore (Release)

Aggiungi in `app/build.gradle`:

```gradle
android {
    signingConfigs {
        release {
            storeFile file('path/to/sistema54-release.keystore')
            storePassword 'your-store-password'
            keyAlias 'sistema54'
            keyPassword 'your-key-password'
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
        }
    }
}
```

## Installazione

### Via ADB
```bash
adb install app-debug.apk
```

### Via File Manager
1. Copia APK sul dispositivo Android
2. Apri file manager
3. Tocca APK e segui istruzioni installazione
4. Abilita "Installa app da sorgenti sconosciute" se richiesto

## Test

1. **Installa APK** sul dispositivo
2. **Apri l'app** - dovrebbe richiedere permesso VPN
3. **Accetta permesso VPN** quando richiesto
4. L'app dovrebbe:
   - Inizializzare WireGuard
   - Connettersi al server VPN
   - Aprire automaticamente la web app in WebView

## Troubleshooting

### Errore "Configurazione VPN non valida"
- Verifica che `VPNConfig.kt` abbia chiavi corrette
- Non lasciare valori placeholder ("YOUR_SERVER_IP", ecc.)

### VPN non si connette
- Verifica che il server WireGuard sia attivo
- Controlla che porta 51820 sia aperta
- Verifica IP server e chiavi pubbliche/private

### WebView non carica
- Verifica URL web app in `VPNConfig.kt` (default: `http://10.0.0.1:26081`)
- Verifica che il backend sia raggiungibile dall'IP VPN (10.0.0.1)
- Controlla log Android: `adb logcat | grep Sistema54`

### Errore compilazione
- Verifica che Android Studio sia aggiornato
- Sincronizza Gradle: File → Sync Project with Gradle Files
- Invalidate caches: File → Invalidate Caches / Restart

## Debug

### Visualizza Log
```bash
adb logcat | grep -E "Sistema54|WireGuard|WebView"
```

### Test Connessione VPN
```bash
# Da dispositivo Android (via ADB shell)
adb shell ping 10.0.0.1
```

### Verifica Stato VPN
Nelle impostazioni Android → Reti → VPN dovresti vedere "sistema54-vpn" attivo

## Note Importanti

1. **NON commitare chiavi private** nel repository Git
2. Usa `.gitignore` per escludere `VPNConfig.kt` o file sensibili
3. In produzione, considera:
   - Download configurazione da server remoto
   - Cifratura chiavi con Android Keystore
   - QR code per configurazione facile
