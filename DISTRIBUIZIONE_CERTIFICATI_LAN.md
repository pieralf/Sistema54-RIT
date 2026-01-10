# 📡 Distribuzione Certificati SSL su LAN Aziendale

Guida per distribuire certificati SSL trusted su tutti i computer della rete LAN aziendale.

## 🎯 Scopo

Permettere a tutti i computer della LAN di accedere a `https://tuoserver:26443` **senza avvisi di sicurezza**.

## 🔧 Opzioni Disponibili

### Opzione 1: mkcert (Consigliato per piccole reti - < 20 PC)

**Vantaggi:**
- ✅ Setup rapido
- ✅ Funziona per localhost e IP LAN
- ✅ Valido per 10 anni

**Svantaggi:**
- ⚠️ Richiede importazione manuale su ogni PC
- ⚠️ Gestione distribuita (ogni PC ha il suo root CA)

#### Passi

1. **Genera certificati sul server**:
   ```powershell
   .\generate_ssl_certs_lan.ps1 -AutoDetectLAN
   # Oppure specifica IP manualmente:
   .\generate_ssl_certs_lan.ps1 -IPAddresses @("192.168.1.100", "192.168.1.101")
   ```

2. **Trova il root CA di mkcert**:
   ```
   %LOCALAPPDATA%\mkcert\rootCA.pem
   ```
   Esempio: `C:\Users\TuoNome\AppData\Local\mkcert\rootCA.pem`

3. **Distribuisci il root CA su ogni PC client**:
   - **Via rete condivisa**: Copia `rootCA.pem` in una cartella condivisa
   - **Via email**: Invia `rootCA.pem` agli utenti
   - **Via Group Policy** (se hai Active Directory): Vedi sezione "Group Policy"

4. **Importa root CA su ogni PC Windows**:
   ```powershell
   # Esegui PowerShell come Administrator su ogni PC client
   certutil -addstore -f "ROOT" "\\server\share\rootCA.pem"
   ```
   
   Oppure manualmente:
   - Apri `certlm.msc` (LocalMachine) o `certmgr.msc` (CurrentUser)
   - Vai a **Trusted Root Certification Authorities** → **Certificates**
   - Click destro → **All Tasks** → **Import**
   - Seleziona `rootCA.pem`
   - Segui la procedura guidata

5. **Per Firefox** (su ogni PC):
   - Apri Firefox → `about:preferences#privacy`
   - Scrolla → "Certificati" → "Visualizza certificati"
   - Tab "Autorità" → "Importa..."
   - Seleziona `rootCA.pem`
   - ✅ Seleziona "Fiducia per questo certificato per identificare siti web"
   - Riavvia Firefox

---

### Opzione 2: CA Aziendale Interna (Consigliato per reti medie/grandi - > 20 PC)

**Vantaggi:**
- ✅ Gestione centralizzata
- ✅ Distribuzione automatica via Group Policy
- ✅ Revoca certificati centralmente
- ✅ Più sicuro

**Svantaggi:**
- ⚠️ Setup più complesso
- ⚠️ Richiede Windows Server (opzionale, ma raccomandato)

Vedi `SETUP_CA_AZIENDALE.md` per setup completo.

---

### Opzione 3: Script di Distribuzione Automatica

Crea uno script PowerShell per distribuire automaticamente il root CA a tutti i PC della rete.

**`distribuisci_certificato_lan.ps1`**:

```powershell
# Script per distribuire root CA mkcert su PC LAN
# Esegui questo script sul server centrale

param(
    [Parameter(Mandatory=$true)]
    [string[]]$ComputerNames,
    
    [Parameter(Mandatory=$false)]
    [string]$SharedPath = "\\server\share\certificati"
)

# Path root CA mkcert
$rootCAPath = "$env:LOCALAPPDATA\mkcert\rootCA.pem"

if (-not (Test-Path $rootCAPath)) {
    Write-Host "[ERRORE] root CA non trovato in: $rootCAPath" -ForegroundColor Red
    Write-Host "Esegui prima: .\generate_ssl_certs_lan.ps1" -ForegroundColor Yellow
    exit 1
}

# Copia root CA in cartella condivisa
Write-Host "Copia root CA in cartella condivisa..." -ForegroundColor Cyan
if (-not (Test-Path $SharedPath)) {
    New-Item -ItemType Directory -Path $SharedPath -Force | Out-Null
}
Copy-Item $rootCAPath "$SharedPath\rootCA.pem" -Force
Write-Host "[OK] Root CA copiato in: $SharedPath" -ForegroundColor Green

# Distribuisci a ogni PC
foreach ($computer in $ComputerNames) {
    Write-Host "`nDistribuzione a: $computer" -ForegroundColor Cyan
    
    try {
        # Verifica che il PC sia raggiungibile
        if (Test-Connection -ComputerName $computer -Count 1 -Quiet) {
            # Importa root CA via Invoke-Command
            Invoke-Command -ComputerName $computer -ScriptBlock {
                param($caPath)
                certutil -addstore -f "ROOT" $caPath
            } -ArgumentList "$SharedPath\rootCA.pem" -ErrorAction Stop
            
            Write-Host "[OK] Certificato importato su $computer" -ForegroundColor Green
        } else {
            Write-Host "[ERRORE] PC $computer non raggiungibile" -ForegroundColor Red
        }
    } catch {
        Write-Host "[ERRORE] Impossibile importare su $computer: $_" -ForegroundColor Red
    }
}

Write-Host "`n[OK] Distribuzione completata!" -ForegroundColor Green
Write-Host "`n⚠️  IMPORTANTE: Firefox richiede importazione manuale su ogni PC" -ForegroundColor Yellow
```

**Uso**:
```powershell
# Lista PC della LAN
$pcs = @("PC1", "PC2", "PC3", "PC4")
.\distribuisci_certificato_lan.ps1 -ComputerNames $pcs -SharedPath "\\server\share\certificati"
```

---

## 🏢 Group Policy (Active Directory)

Se hai **Windows Server** con **Active Directory**, puoi distribuire il certificato automaticamente a tutti i PC del dominio.

### Passi

1. **Prepara il certificato**:
   ```powershell
   # Esporta root CA in formato .cer
   certutil -export -f "$env:LOCALAPPDATA\mkcert\rootCA.pem" "\\server\share\rootCA.cer"
   ```

2. **Crea GPO (Group Policy Object)**:
   - Apri **Group Policy Management Console** (`gpmc.msc`)
   - Crea nuovo GPO: "Trusted Root CA - mkcert"
   - Vai a: **Computer Configuration** → **Policies** → **Windows Settings** → **Security Settings** → **Public Key Policies** → **Trusted Root Certification Authorities**
   - Click destro → **Import...**
   - Seleziona `rootCA.cer`
   - Link il GPO al tuo dominio/OU

3. **Applicazione**:
   - I PC aggiornano le policy al prossimo riavvio o con `gpupdate /force`
   - Il certificato sarà trusted automaticamente su tutti i PC del dominio

4. **Per Firefox** (sempre manuale):
   - Firefox usa il proprio certificate store
   - Richiede importazione manuale o script distribuito

---

## 🧪 Test

Dopo la distribuzione, testa su un PC client:

1. **Chrome/Edge**:
   - Vai a `https://tuoserver:26443`
   - Dovrebbe mostrare il lucchetto verde (nessun avviso)

2. **Firefox**:
   - Se hai importato manualmente: nessun avviso
   - Se non importato: mostrerà ancora l'avviso

3. **Verifica certificato**:
   - Click sul lucchetto → "Certificate" / "Certificato"
   - Verifica "Issued by: mkcert" o "Emesso da: mkcert"

---

## 🔒 Sicurezza

**IMPORTANTE**: Il root CA di mkcert è valido per **10 anni** e permette di firmare certificati per qualsiasi dominio.

**Raccomandazioni**:
- ✅ Proteggi il file `rootCA.pem` (non distribuirlo pubblicamente)
- ✅ Usa solo su reti LAN private
- ✅ Per produzione aziendale, considera una CA interna aziendale
- ✅ Revoca/distribuisci nuovi certificati se il root CA viene compromesso

---

## 📋 Checklist Distribuzione

- [ ] Genera certificati sul server: `.\generate_ssl_certs_lan.ps1`
- [ ] Copia certificati nel container Docker
- [ ] Riavvia nginx
- [ ] Trova root CA: `%LOCALAPPDATA%\mkcert\rootCA.pem`
- [ ] Distribuisci root CA su PC client (via condivisa/email/script/GPO)
- [ ] Importa root CA su Windows (certutil o GUI)
- [ ] Importa root CA su Firefox (manuale su ogni PC)
- [ ] Testa accesso HTTPS da client
- [ ] Documenta percorso root CA per futuri aggiornamenti

---

## 🔄 Aggiornamento Certificati

Se generi nuovi certificati (es. aggiungi nuovi IP):

1. **Sul server**:
   ```powershell
   .\generate_ssl_certs_lan.ps1 -AutoDetectLAN
   docker cp nginx\ssl\cert.pem sistema54_nginx:/etc/nginx/ssl/cert.pem
   docker restart sistema54_nginx
   ```

2. **Su client**:
   - Non necessario riimportare il root CA (è lo stesso)
   - I nuovi certificati funzioneranno automaticamente

---

## 📚 Riferimenti

- mkcert: https://github.com/FiloSottile/mkcert
- Certutil: https://docs.microsoft.com/en-us/windows-server/administration/windows-commands/certutil
- Group Policy: https://docs.microsoft.com/en-us/windows/security/threat-protection/security-policy-settings/trusted-root-certification-authorities
