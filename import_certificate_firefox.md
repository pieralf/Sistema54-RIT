# Importare Certificato SSL in Firefox

Firefox ha il **proprio certificate store separato** da Windows, quindi anche se hai importato il certificato in Windows, Firefox potrebbe ancora bloccarlo.

## Metodo 1: Importazione Manuale (Consigliato)

1. **Apri Firefox** e vai a:
   ```
   about:preferences#privacy
   ```
   Oppure: Menu → Impostazioni → Privacy e sicurezza

2. **Scorri fino alla sezione "Certificati"** → Click su **"Visualizza certificati"**

3. **Tab "Autorità"** → Click su **"Importa..."**

4. **Seleziona il file certificato**:
   - `nginx\ssl\cert.pem` (certificato pubblico)
   - **NON** selezionare `key.pem` (chiave privata)

5. **Nella finestra di conferma**, seleziona:
   ✅ **"Fiducia per questo certificato per identificare siti web"**

6. Click **"OK"**

7. **Riavvia Firefox** completamente (chiudi tutte le finestre)

8. **Riprova ad accedere** a `https://localhost:26443`

## Metodo 2: Importazione Automatica via Script

Puoi usare lo script PowerShell incluso per automatizzare il processo.

## Verifica

Dopo l'importazione:

1. Vai a `about:preferences#privacy`
2. Click "Visualizza certificati" → Tab "Autorità"
3. Cerca "mkcert" o "localhost" nella lista
4. Se lo trovi, il certificato è importato correttamente

## Troubleshooting

### Firefox mostra ancora l'errore

- **Verifica che hai selezionato il certificato CORRETTO** (`cert.pem`, non `key.pem`)
- **Riavvia Firefox completamente** (non solo ricarica la pagina)
- **Pulisci cache SSL**: `about:preferences#privacy` → "Pulisci dati..." → Seleziona "Cache" → "Pulisci adesso"

### Errore "Il certificato non è valido"

- Verifica che il certificato sia stato generato correttamente con `mkcert`
- Rigenera i certificati: `.\generate_trusted_ssl_certs.ps1`
- Assicurati di aver eseguito `mkcert -install` per installare la root CA

### Certificato valido ma Firefox ancora blocca

- Verifica che l'URL sia esattamente `https://localhost:26443` (non `http://`)
- Controlla che nginx stia usando i certificati corretti
- Verifica i log nginx per errori SSL
