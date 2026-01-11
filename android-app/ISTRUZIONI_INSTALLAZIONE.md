# Istruzioni Installazione Android Studio

## Download

1. Vai a: https://developer.android.com/studio
2. Clicca su "Download Android Studio" per Windows
3. Scarica il file .exe (circa 1 GB)

## Installazione

1. Esegui il file .exe scaricato
2. Segui l'installer:
   - Accetta le licenze
   - Installa Android SDK (consigliato)
   - Installa Android Virtual Device (opzionale, per emulatore)
3. Attendi completamento installazione (circa 5-10 minuti)

## Primo Avvio

1. Apri Android Studio
2. Completa Setup Wizard:
   - Attendi download componenti aggiuntivi (può richiedere 5-10 minuti)
   - Accetta licenze SDK
   - Configura impostazioni iniziali
3. Attendi completamento setup

## Apri il Progetto

1. File -> Open
2. Seleziona cartella: `C:\Progetti\Sistema54-RIT\android-app`
3. Attendi sincronizzazione Gradle (automatica, può richiedere alcuni minuti)

## Compila APK

1. Build -> Build Bundle(s) / APK(s) -> Build APK(s)
2. Attendi compilazione
3. APK generato in: `app\build\outputs\apk\debug\app-debug.apk`

## Installazione APK sul Dispositivo

### Via USB (ADB)

1. Abilita "Opzioni sviluppatore" sul dispositivo Android
2. Abilita "Debug USB"
3. Collega dispositivo via USB
4. In Android Studio: Run -> Run 'app' (o usa ADB da terminale)
5. Oppure da terminale: `adb install app-debug.apk`

### Via File Manager

1. Copia APK sul dispositivo (via USB, email, cloud, ecc.)
2. Apri file manager sul dispositivo
3. Tocca APK e segui istruzioni installazione
4. Abilita "Installa app da sorgenti sconosciute" se richiesto

## Note Importanti

- L'installazione richiede circa 1-2 GB di spazio su disco
- Il primo avvio può richiedere 5-10 minuti (download componenti)
- Richiede connessione internet per download componenti
- Il progetto è già configurato correttamente
- Android Studio risolverà automaticamente le dipendenze e gli errori API
