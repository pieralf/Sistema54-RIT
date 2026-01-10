# 🔒 Risolvere Problema SSL in Firefox

## Problema

Firefox blocca la connessione a `https://localhost:26443` con l'errore:
> **"Connessione interrotta: potenziale rischio per la sicurezza"**

## Causa

Firefox ha il **proprio certificate store separato** da Windows. Anche se i certificati sono validi per Chrome/Edge, Firefox richiede un'importazione manuale.

## Soluzione Rapida (3 minuti)

### Opzione 1: Importare Certificato Self-Signed Esistente

I certificati sono già stati generati automaticamente dal container nginx. Segui questi passi:

1. **Copia il certificato dal container** (se non già fatto):
   ```powershell
   docker cp sistema54_nginx:/etc/nginx/ssl/cert.pem nginx\ssl\cert.pem
   ```

2. **Apri Firefox** e vai a:
   ```
   about:preferences#privacy
   ```
   Oppure: Menu (☰) → Impostazioni → Privacy e sicurezza

3. **Scrolla fino a "Certificati"** → Click **"Visualizza certificati"**

4. **Tab "Autorità"** → Click **"Importa..."**

5. **Naviga e seleziona**:
   ```
   C:\Progetti\Sistema54-RIT\nginx\ssl\cert.pem
   ```
   ⚠️ **IMPORTANTE**: Seleziona `cert.pem` (NON `key.pem`!)

6. **Nella finestra di conferma**, seleziona:
   ✅ **"Fiducia per questo certificato per identificare siti web"**

7. Click **"OK"**

8. **Riavvia Firefox completamente** (chiudi tutte le finestre)

9. **Riprova ad accedere** a `https://localhost:26443`

✅ Il browser non mostrerà più l'errore!

---

### Opzione 2: Generare Certificati Trusted con mkcert (Migliore)

Per avere certificati trusted anche su Chrome/Edge **senza importazione manuale**:

1. **Genera certificati trusted**:
   ```powershell
   .\generate_trusted_ssl_certs.ps1
   ```
   (Esegui PowerShell come Administrator)

2. **Copia i nuovi certificati nel container**:
   ```powershell
   docker cp nginx\ssl\cert.pem sistema54_nginx:/etc/nginx/ssl/cert.pem
   docker cp nginx\ssl\key.pem sistema54_nginx:/etc/nginx/ssl/key.pem
   ```

3. **Riavvia nginx**:
   ```powershell
   docker restart sistema54_nginx
   ```

4. **Importa in Firefox** (vedi Opzione 1, passi 2-9)

---

## Verifica

Dopo l'importazione:

1. Vai a `about:preferences#privacy`
2. Click "Visualizza certificati" → Tab "Autorità"
3. Cerca "localhost" o "GIT" nella lista
4. Se lo trovi, il certificato è importato correttamente

## Troubleshooting

### Firefox mostra ancora l'errore

- ✅ **Verifica che hai selezionato `cert.pem`** (non `key.pem`)
- ✅ **Riavvia Firefox completamente** (non solo ricarica la pagina)
- ✅ **Pulisci cache SSL**: 
  - `about:preferences#privacy` 
  - Scrolla fino a "Certificati" 
  - Click "Pulisci dati SSL..." 
  - Click "Pulisci adesso"

### Errore "Il certificato non è valido"

- Verifica che il file `cert.pem` esista: `Test-Path nginx\ssl\cert.pem`
- Rigenera i certificati nel container: `docker restart sistema54_nginx`
- Oppure genera certificati trusted: `.\generate_trusted_ssl_certs.ps1`

### Certificato valido ma Firefox ancora blocca

- Verifica che l'URL sia esattamente `https://localhost:26443` (non `http://`)
- Controlla che nginx stia usando i certificati corretti:
  ```powershell
  docker exec sistema54_nginx nginx -t
  ```

## Vantaggi mkcert vs Self-Signed

| Caratteristica | Self-Signed (Attuale) | mkcert |
|----------------|----------------------|--------|
| Chrome/Edge | ❌ Richiede importazione | ✅ Trusted automaticamente |
| Firefox | ⚠️ Richiede importazione | ⚠️ Richiede importazione |
| Validità | 10 anni | 10 anni |
| Installazione | ✅ Automatica nel container | ⚠️ Richiede setup iniziale |

**Raccomandazione**: Usa mkcert per avere certificati trusted su tutti i browser (tranne Firefox che richiede comunque importazione manuale).
