# Installazione APK sul Dispositivo Android

## APK Generato

**Percorso:** `app\build\outputs\apk\debug\app-debug.apk`

## Metodo 1: Via USB (ADB) - Consigliato

### Prerequisiti:
1. **Abilita Opzioni Sviluppatore** sul dispositivo Android:
   - Impostazioni → Info telefono
   - Tocca "Numero build" 7 volte
   - Ora hai "Opzioni sviluppatore" nelle Impostazioni

2. **Abilita Debug USB**:
   - Impostazioni → Opzioni sviluppatore
   - Attiva "Debug USB"

3. **Installa ADB** (se non già installato):
   - Android Studio lo include automaticamente
   - Oppure scarica Android Platform Tools: https://developer.android.com/tools/releases/platform-tools

### Installazione:
```bash
# Dal terminale, nella cartella android-app
adb install app\build\outputs\apk\debug\app-debug.apk
```

Oppure da Android Studio:
- Run → Run 'app'
- Seleziona il dispositivo connesso
- Android Studio installerà automaticamente l'APK

## Metodo 2: Via File Manager

1. **Copia APK sul dispositivo**:
   - Via USB (modalità trasferimento file)
   - Via email/cloud (Google Drive, OneDrive, ecc.)
   - Via Wi-Fi (condivisione file)

2. **Installa APK**:
   - Apri File Manager sul dispositivo
   - Trova il file `app-debug.apk`
   - Tocca il file e segui le istruzioni
   - Se richiesto, abilita "Installa app da sorgenti sconosciute"

### Permessi necessari:
- **Android 7.0-8.0**: Impostazioni → Sicurezza → Attiva "Origini sconosciute"
- **Android 8.0+**: Permessi per singola app durante installazione

## Metodo 3: Via Email/Cloud

1. Invia l'APK via email o caricalo su cloud
2. Apri email/cloud sul dispositivo Android
3. Scarica l'APK
4. Apri il file e segui le istruzioni installazione

## Test dell'App

Dopo l'installazione:

1. **Apri l'app "GIT"** sul dispositivo
2. **Al primo avvio:**
   - L'app richiederà permesso VPN (accetta)
   - Se non hai configurazione WireGuard, l'app mostrerà pulsante "Importa file .conf"
   - Importa il file .conf WireGuard quando richiesto
3. **Dopo importazione configurazione:**
   - L'app si connetterà automaticamente alla VPN
   - Apre automaticamente la web app in WebView

## Troubleshooting

### "App non installata"
- Verifica che Debug USB sia attivo
- Prova a disinstallare versioni precedenti dell'app
- Verifica che ci sia spazio sufficiente sul dispositivo

### "Errore parsing pacchetto"
- Verifica che l'APK non sia corrotto (ricompila)
- Assicurati di usare APK debug, non release

### VPN non si connette
- Verifica che il file .conf WireGuard sia valido
- Controlla che il server WireGuard sia raggiungibile
- Verifica IP server e chiavi pubbliche/private

### WebView non carica
- Verifica URL web app in VPNConfig.kt (default: http://10.0.0.1:26080)
- Controlla che il backend sia raggiungibile dall'IP VPN
- Verifica log Android: `adb logcat | grep -E "GIT|WireGuard|WebView"`

## Note Importanti

- **APK Debug**: Questo è un APK debug, adatto per test. Per produzione, compila un APK release firmato.
- **Firma APK**: Per distribuzione pubblica, serve firmare l'APK con keystore.
- **Permessi VPN**: L'app richiede permesso VPN per funzionare.
- **File .conf**: L'app richiede un file .conf WireGuard valido per connettersi.

## Compilazione Release (per produzione)

Per creare un APK release firmato:

1. Build → Generate Signed Bundle / APK
2. Seleziona APK
3. Crea o seleziona keystore
4. Compila APK release
5. APK in: `app\build\outputs\apk\release\app-release.apk`
