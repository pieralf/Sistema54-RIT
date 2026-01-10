# Riepilogo Modifiche Branding GIT

## ✅ Modifiche Completate

### 1. Frontend Web App
- **Favicon**: Configurato in `index.html` - richiede file `favicon.png` in `frontend/public/`
- **Titolo**: Cambiato da "SISTEMA54 Digital" a "GIT - Gestione Interventi Tecnici"
- **Pagina Login**: 
  - Rimossa scritta credenziali default
  - Versione: "GIT - Versione 1.0"
  - Nome azienda default: "GIT - Gestione Interventi Tecnici"

### 2. Backend
- **Super Admin Default**:
  - Email: `git@git.it`
  - Password: `git@4683`
- **Nome Azienda Default**: "GIT - Gestione Interventi Tecnici" in tutti i modelli e servizi
- **API Title**: "GIT - Gestione Interventi Tecnici API - CMMS"

### 3. Android App
- **Struttura icone creata**: Cartelle `mipmap-*` per tutte le densità schermo
- **Script generazione icone**: `generate_icons.ps1` e `generate_icons.md`

## 📋 Azioni Richieste

### Per Web App (Frontend):
1. **Salva il logo GIT come `favicon.png`** in `frontend/public/`
   - Formato: PNG
   - Dimensioni consigliate: 32x32 o 64x64 pixel

### Per Android App:
1. **Genera le icone Android** usando uno di questi metodi:
   - **Metodo 1 (Consigliato)**: Vai su https://icon.kitchen/
     - Carica l'immagine del logo GIT
     - Seleziona "Android" come piattaforma
     - Scarica il pacchetto ZIP
     - Estrai le cartelle `mipmap-*` in `android-app/app/src/main/res/`
   
   - **Metodo 2**: Usa lo script PowerShell (richiede ImageMagick):
     ```powershell
     cd android-app
     .\generate_icons.ps1 -SourceImage "percorso/logo_git.png"
     ```

## 📁 File Modificati

### Frontend:
- `frontend/index.html` - Favicon e titolo
- `frontend/src/pages/LoginPage.tsx` - Rimozione credenziali, versione
- `frontend/src/pages/DashboardAdminPage.tsx` - Nome azienda
- `frontend/src/pages/DashboardOperatorePage.tsx` - Nome azienda
- `frontend/src/components/AppHeader.tsx` - Nome azienda
- `frontend/src/store/settingsStore.ts` - Nome azienda default

### Backend:
- `backend/app/main.py` - Super Admin, nome azienda, API title
- `backend/app/routers/auth.py` - Super Admin default, nome azienda
- `backend/app/routers/impostazioni.py` - Nome azienda default
- `backend/app/models.py` - Nome azienda default
- `backend/app/services/email_service.py` - Nome azienda default
- `backend/app/services/backup_service.py` - Nome azienda default
- `backend/app/services/two_factor_service.py` - Nome app
- `backend/app/templates/prelievo_copie_template.html` - Nome azienda default

## 🔄 Prossimi Passi

1. **Aggiungi favicon.png** in `frontend/public/`
2. **Genera icone Android** usando Android Asset Studio o script PowerShell
3. **Rebuild applicazioni**:
   ```powershell
   # Frontend
   docker compose -f docker-compose.desktop.prod.namedvol.yml up -d --build frontend
   
   # Backend
   docker compose -f docker-compose.desktop.prod.namedvol.yml up -d --build backend
   
   # Android - Compila in Android Studio
   ```

## 📝 Note

- La favicon è hardcoded in `index.html` quindi non può essere modificata dall'utente
- L'icona Android è referenziata automaticamente tramite `AndroidManifest.xml`
- Tutte le stringhe "SISTEMA54" sono state sostituite con "GIT - Gestione Interventi Tecnici"
- Le nuove credenziali Super Admin saranno create automaticamente al primo avvio del backend
