# Miglioramenti Sicurezza - Sistema54-RIT

## Vulnerabilità Identificate e Correzioni

### 1. ✅ Correzioni Applicate

#### Rate Limiting
- Implementare rate limiting per endpoint sensibili (login, registrazione)

#### Input Validation
- ✅ Validazione Partita IVA implementata
- ✅ Validazione Codice Fiscale implementata
- Validazione XSS: verificare tutti gli input utente

#### Permessi Admin
- ✅ Admin non può creare SuperAdmin
- ✅ Admin non può abilitare `can_edit_settings` e `can_delete_interventi`
- ✅ Link impostazioni nascosto per Admin

### 2. 🔄 Da Implementare

#### A. Rate Limiting Backend

**File: `backend/app/main.py`**
```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.post("/api/auth/login")
@limiter.limit("5/minute")  # Max 5 tentativi al minuto
async def login(request: Request, ...):
    ...
```

#### B. Content Security Policy

**File: `backend/app/main.py`**
```python
from fastapi.middleware.cors import CORSMiddleware

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response
```

#### C. Sanitizzazione Input

**File: `backend/app/utils.py`**
```python
import html

def sanitize_input(text: str) -> str:
    """Rimuove caratteri potenzialmente pericolosi"""
    if not text:
        return ""
    # Escape HTML
    text = html.escape(text)
    # Rimuovi script tags
    text = re.sub(r'<script[^>]*>.*?</script>', '', text, flags=re.IGNORECASE | re.DOTALL)
    return text
```

#### D. Validazione JWT più Rigorosa

**File: `backend/app/routers/auth.py`**
```python
# Verifica expiration più rigorosa
# Verifica audience e issuer
# Implementa refresh token rotation
```

#### E. Logging Sicurezza

```python
# Log di tutti i tentativi di accesso falliti
# Log di modifiche critiche (eliminazioni, cambio permessi)
# Alert per attività sospette
```

### 3. Checklist Sicurezza

- [ ] Rate limiting su tutti gli endpoint pubblici
- [ ] HTTPS enforcement in produzione
- [ ] Validazione e sanitizzazione tutti gli input
- [ ] Content Security Policy headers
- [ ] Audit log completo per operazioni sensibili
- [ ] Password policy enforcement
- [ ] 2FA obbligatorio per SuperAdmin
- [ ] Backup encryption
- [ ] Secrets management (non hardcode)
- [ ] SQL injection protection (già usiamo SQLAlchemy ORM)
- [ ] CSRF protection per form critici

### 4. Test Vulnerabilità

#### Strumenti Consigliati
- **OWASP ZAP**: Scansione automatica vulnerabilità web
- **Bandit**: Static analysis per Python
- **npm audit**: Vulnerabilità dipendenze Node.js
- **Trivy**: Scansione vulnerabilità Docker images

#### Comandi Test

```bash
# Backend Python
bandit -r backend/app

# Frontend npm
cd frontend && npm audit

# Docker images
trivy image sistema54_rit-backend:latest

# Web app scan (richiede OWASP ZAP installato)
zap-cli quick-scan --self-contained --start-options '-config api.disablekey=true' http://localhost:26080
```

### 5. Configurazione Produzione

#### Variabili d'Ambiente Critiche

```bash
# .env.production
JWT_SECRET=<genera-una-chiave-casuale-minimo-32-caratteri>
POSTGRES_PASSWORD=<password-forte-minimo-16-caratteri>
PGADMIN_PASSWORD=<password-forte-minimo-16-caratteri>
CORS_ORIGINS=https://tuodominio.com,https://www.tuodominio.com
```

#### Generazione Password Sicure

```bash
# Linux/Mac
openssl rand -base64 32

# Windows PowerShell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | % {[char]$_})
```

### 6. Monitoring e Alerting

- [ ] Setup log aggregation (ELK stack o simile)
- [ ] Alert per login falliti multipli
- [ ] Alert per modifiche critiche
- [ ] Monitor performance e errori
