# Sistema54 Android App

App Android per connettersi alla web app tramite WireGuard VPN.

## Quick Start

1. Apri il progetto in Android Studio
2. Configura le chiavi VPN nel file `VPNConfig.kt`
3. Compila e installa su dispositivo Android
4. L'app avvierà automaticamente la VPN e aprirà la web app

## Configurazione

### VPN Keys
Le chiavi VPN devono essere configurate prima della compilazione:
- Server IP e porta
- Chiavi pubbliche/private (generare con WireGuard)
- IP network VPN (default: 10.0.0.0/8)

### Build
```bash
./gradlew assembleDebug  # Build APK debug
./gradlew assembleRelease  # Build APK release (richiede keystore)
```

## Struttura

- `app/src/main/java/com/sistema54/` - Codice sorgente Kotlin
- `app/src/main/res/` - Risorse (layout, drawable, values)
- `app/build.gradle` - Configurazione build
