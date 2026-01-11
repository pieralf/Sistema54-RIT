# Compilazione APK - Istruzioni

## Problema: APK non trovato dopo BUILD SUCCESSFUL

Se Gradle segnala "BUILD SUCCESSFUL" ma l'APK non viene trovato, significa che il task `assembleDebug` non è stato eseguito.

## Soluzione 1: Android Studio (Consigliato)

1. **Build → Build Bundle(s) / APK(s) → Build APK(s)**
   - ⚠️ **NON** usare "Build → Make Project" (non genera APK)
   - ⚠️ **NON** usare "Build → Rebuild Project" (pulisce ma non genera APK)
   - ✅ Usa **Build APK(s)** che esegue `assembleDebug`

2. **Attendi compilazione**
   - Gradle eseguirà il task `assembleDebug`
   - Dovrebbe apparire una notifica "APK(s) generated successfully"

3. **Trova l'APK**
   - Clicca su "locate" nella notifica per aprire la cartella
   - Oppure vai manualmente: `app\build\outputs\apk\debug\app-debug.apk`

## Soluzione 2: Terminale Gradle

### Da Android Studio Terminal:

1. Apri terminale in Android Studio (View → Tool Windows → Terminal)

2. Esegui:
   ```bash
   .\gradlew.bat assembleDebug
   ```

3. Attendi compilazione

4. APK generato in: `app\build\outputs\apk\debug\app-debug.apk`

### Da PowerShell (cartella android-app):

```powershell
cd C:\Progetti\Sistema54-RIT\android-app
.\gradlew.bat assembleDebug
```

## Verifica APK Generato

Dopo la compilazione, verifica che l'APK esista:

```powershell
# Verifica percorso
Test-Path "app\build\outputs\apk\debug\app-debug.apk"

# Apri cartella
explorer app\build\outputs\apk\debug\
```

## Problemi Comuni

### "BUILD SUCCESSFUL" ma nessun APK

**Causa**: Il task `assembleDebug` non è stato eseguito
**Soluzione**: Usa "Build → Build APK(s)" NON "Make Project"

### Errore durante compilazione

**Verifica log**:
- View → Tool Windows → Build
- Cerca errori rossi

**Pulisci e ricompila**:
1. Build → Clean Project
2. Build → Build APK(s)

### APK generato ma non trovato

**Cerca in tutte le posizioni**:
```powershell
Get-ChildItem -Path app\build -Recurse -Filter "*.apk"
```

## Nota Importante

- **Build → Make Project**: Compila codice, NON genera APK
- **Build → Rebuild Project**: Pulisce e compila, NON genera APK
- **Build → Build APK(s)**: Genera APK (task `assembleDebug`)
- **Build → Generate Signed Bundle / APK**: Genera APK release firmato

Per generare l'APK, usa **sempre** "Build → Build APK(s)" o `gradlew assembleDebug`.
