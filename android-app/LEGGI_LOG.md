# Come Leggere i Log dell'App Android

## Metodo 1: Usando ADB (Android Debug Bridge) - Consigliato

### Prerequisiti:
1. **Abilita le opzioni sviluppatore** sul telefono:
   - Vai su `Impostazioni` → `Informazioni sul telefono`
   - Tocca 7 volte su "Numero build" o "Versione MIUI" (a seconda del telefono)
   - Apparirà il messaggio "Sei diventato uno sviluppatore"

2. **Abilita il debug USB**:
   - Vai su `Impostazioni` → `Opzioni sviluppatore`
   - Attiva "Debug USB"
   - Attiva "Installa via USB" (opzionale ma consigliato)

3. **Installa ADB sul PC**:
   - Windows: Scarica da https://developer.android.com/tools/releases/platform-tools
   - Oppure installa Android Studio (include ADB)

### Comandi ADB:

#### 1. Verifica connessione:
```bash
adb devices
```
Dovresti vedere il tuo dispositivo connesso.

#### 2. Vedi tutti i log in tempo reale:
```bash
adb logcat
```

#### 3. Filtra solo i log dell'app GIT:
```bash
adb logcat -s MainActivity:D WebAppActivity:D WireGuardManager:D
```

#### 4. Filtra per tag specifici (più dettagliato):
```bash
adb logcat | grep -E "MainActivity|WebAppActivity|WireGuardManager|VPN"
```

#### 5. Salva i log in un file:
```bash
adb logcat > log_app.txt
```
Premi `Ctrl+C` per fermare la registrazione.

#### 6. Pulisci i log vecchi e inizia da zero:
```bash
adb logcat -c
adb logcat > log_app.txt
```

#### 7. Filtra solo errori e warning:
```bash
adb logcat *:E *:W
```

#### 8. Log specifici per GIT con timestamp:
```bash
adb logcat -v time | grep -E "MainActivity|WebAppActivity|WireGuardManager|git"
```

---

## Metodo 2: Usando Android Studio

1. Apri Android Studio
2. Collega il telefono via USB
3. Vai su `View` → `Tool Windows` → `Logcat`
4. Seleziona il tuo dispositivo e l'app "GIT"
5. I log appariranno in tempo reale

---

## Metodo 3: App per Android (senza PC)

### App consigliate:
- **Logcat Reader** (richiede root)
- **MatLog** (richiede root o debug USB)
- **aLogcat** (richiede root)

**Nota**: La maggior parte delle app richiede root o debug USB attivo.

---

## Metodo 4: Script PowerShell (Windows)

Crea un file `leggi_log.ps1`:

```powershell
# Verifica connessione
Write-Host "Verifica dispositivi connessi..." -ForegroundColor Cyan
adb devices

Write-Host "`nAvvio lettura log (premi Ctrl+C per fermare)..." -ForegroundColor Green
Write-Host "Filtro: MainActivity, WebAppActivity, WireGuardManager`n" -ForegroundColor Yellow

# Filtra e mostra solo i log rilevanti
adb logcat -v time | Select-String -Pattern "MainActivity|WebAppActivity|WireGuardManager|VPN|git" -Context 0,2
```

Esegui con:
```powershell
.\leggi_log.ps1
```

---

## Tag di Log Utili per Debug

I tag che abbiamo aggiunto nel codice:
- `MainActivity` - Log della main activity
- `WebAppActivity` - Log della webview
- `WireGuardManager` - Log della gestione VPN
- `VPN` - Log generali VPN

---

## Esempio di Output Atteso

Quando avvii l'app, dovresti vedere log come:
```
MainActivity: Creazione configurazione VPN con:
MainActivity:   Server: 31.7.147.6:11000
MainActivity:   Client IP: 10.10.2.3/32
MainActivity: Tentativo connessione VPN: 1/3
MainActivity: VPN avviata con successo al tentativo 1
MainActivity: Verifica stato VPN (tentativo 1/20): UP
WebAppActivity: === INIZIALIZZAZIONE WEBVIEW ===
WebAppActivity: URL da caricare: http://192.168.1.119:26080
WebAppActivity: Stato VPN: UP
```

---

## Troubleshooting

### ADB non trova il dispositivo:
1. Verifica che il debug USB sia attivo
2. Prova un cavo USB diverso
3. Installa i driver USB del telefono sul PC
4. Su Windows, potrebbe servire installare i driver ADB

### Log troppo rumorosi:
Usa filtri più specifici:
```bash
adb logcat MainActivity:D WebAppActivity:D *:S
```
(`*:S` silenzia tutti gli altri log)

### Salvare log durante un crash:
```bash
adb logcat -b crash > crash_log.txt
```

---

## Comandi Rapidi

```bash
# Solo errori
adb logcat *:E

# Solo log GIT
adb logcat | grep git

# Log con timestamp
adb logcat -v time

# Salva e visualizza
adb logcat > log.txt && notepad log.txt
```
