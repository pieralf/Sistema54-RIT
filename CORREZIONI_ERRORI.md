# Correzioni Errori Rclone e Scheduler

## Problemi Risolti

### 1. Errore 500 su POST /api/backup-targets
**Problema**: Quando si incollava la configurazione rclone, si verificava un errore 500.

**Correzioni applicate**:
- ✅ Migliorato parsing della configurazione JSON quando arriva come stringa
- ✅ Gestione token rclone: ora gestisce correttamente token come stringa JSON, dict o list
- ✅ Aggiunto logging dettagliato con traceback completo per debug
- ✅ Gestione errori in `build_rclone_conf` non blocca più l'upsert del target
- ✅ Validazione migliorata dei dati di input

**File modificati**:
- `backend/app/routers/backups.py` - Logging migliorato
- `backend/app/services/backup_service.py` - Parsing token migliorato, gestione errori

### 2. Scheduler non si attivano
**Problema**: Gli scheduler backup non si attivavano quando configurati.

**Correzioni applicate**:
- ✅ Risolto problema import circolare in `setup_backup_schedulers`
- ✅ Scheduler vengono rimossi e ricreati correttamente quando si aggiornano le impostazioni
- ✅ Sostituiti `print()` con `logger` per logging strutturato
- ✅ Migliorata gestione errori nella configurazione scheduler

**File modificati**:
- `backend/app/main.py` - Migliorata funzione `setup_backup_schedulers`
- `backend/app/routers/impostazioni.py` - Import scheduler migliorato

---

## Come Testare

### Test Rclone Configuration

1. **Riavvia il backend**:
   ```powershell
   docker restart sistema54_rit-backend-1
   ```

2. **Vai alla sezione Backup nell'admin**

3. **Configura un target cloud**:
   - Nome: es. "Google Drive"
   - Tipo: Google Drive (o OneDrive/Dropbox)
   - Percorso remoto: es. "Sistema54/backups"
   - Config: incolla la configurazione rclone JSON

4. **Clicca "Aggiungi"**

5. **Verifica i log**:
   ```powershell
   docker logs sistema54_rit-backend-1 --tail 50 -f
   ```
   Dovresti vedere:
   - Log dettagliati della configurazione
   - Se c'è un errore, vedrai il traceback completo

### Test Scheduler

1. **Configura lo scheduler**:
   - Vai alla sezione Backup
   - Abilita "Scheduler" per Locale/NAS/Cloud
   - Imposta orario (es: 02:00)
   - Imposta retention (es: 10 backup)
   - Salva le impostazioni

2. **Verifica i log all'avvio/salvataggio**:
   ```powershell
   docker logs sistema54_rit-backend-1 | Select-String "BACKUP SCHEDULER"
   ```
   Dovresti vedere:
   ```
   [BACKUP SCHEDULER] Configurato backup locale: ogni giorno alle 02:00
   ```

3. **Verifica che gli scheduler siano attivi**:
   Controlla i log per conferma che gli scheduler sono stati configurati.

---

## Formato Configurazione Rclone Atteso

### Google Drive / OneDrive / Dropbox
```json
{
  "token": "{\"access_token\":\"...\",\"refresh_token\":\"...\"}"
}
```

Oppure puoi incollare direttamente il token object:
```json
{
  "access_token": "...",
  "refresh_token": "...",
  "token_type": "Bearer",
  "expiry": "2025-01-01T00:00:00Z"
}
```

### SMB/NAS
```json
{
  "host": "192.168.1.100",
  "share": "Backups",
  "user": "username",
  "pass": "password",
  "domain": "",
  "port": 445
}
```

---

## Troubleshooting

### Se vedi ancora errore 500 su rclone:

1. **Controlla i log dettagliati**:
   ```powershell
   docker logs sistema54_rit-backend-1 --tail 100 | Select-String -Pattern "Error|Exception|Traceback" -Context 10
   ```

2. **Verifica il formato JSON**:
   - Assicurati che la configurazione sia JSON valido
   - Usa un validatore JSON online se necessario

3. **Verifica i permessi rclone**:
   - Il token deve essere valido
   - Per Google Drive/OneDrive, il token deve essere generato con `rclone authorize`

### Se gli scheduler non si attivano:

1. **Verifica che la migrazione sia stata eseguita**:
   ```powershell
   docker exec -i sistema54_rit-db-1 psql -U admin -d sistema54_db -c "\d impostazioni_azienda" | Select-String "schedule"
   ```

2. **Riavvia il backend dopo aver salvato le impostazioni**

3. **Controlla i log**:
   ```powershell
   docker logs sistema54_rit-backend-1 | Select-String "BACKUP SCHEDULER"
   ```

4. **Verifica che le impostazioni siano salvate**:
   - Controlla che `backup_local_schedule_enabled` sia `true` nel database
   - Verifica che `backup_local_schedule_time` sia nel formato `HH:MM`

---

## Note Importanti

- **Backend deve essere riavviato** dopo queste modifiche per applicare i cambiamenti
- **I log ora sono più dettagliati** - controlla sempre i log per capire eventuali errori
- **Gli scheduler si ricaricano automaticamente** quando salvi le impostazioni di backup
- **Il target rclone viene salvato anche se c'è un errore nella generazione di rclone.conf** - puoi riprovare dopo

---

**Ultima modifica**: 2025-01-XX
