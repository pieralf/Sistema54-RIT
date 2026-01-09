from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status, UploadFile, File, Query, Request
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import Response, FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta, time as dt_time
import os
from slowapi import Limiter
from slowapi.util import get_remote_address

from .. import models, schemas, database, auth
from ..services import pdf_service, email_service, two_factor_service
from ..services.app_audit import log_app_event
from ..utils import get_default_permessi
from ..services.backup_service import (
    list_backups,
    create_backup,
    delete_backup,
    restore_backup,
    get_backup_info,
    get_backup_status,
)

router = APIRouter()

# Rate limiter - verrà collegato all'app nel main.py
def get_limiter():
    """Ottiene il limiter dall'app"""
    from ..main import app
    return app.state.limiter

# Usa una funzione helper per ottenere il limiter
limiter = Limiter(key_func=get_remote_address)


@router.post("/api/auth/login", response_model=schemas.Token, tags=["Autenticazione"])
@limiter.limit("5/minute")  # Max 5 tentativi di login al minuto
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(database.get_db),
    two_factor_code: str = Query(None, description="Codice 2FA per superadmin")
):
    """Login con email e password, con supporto 2FA per superadmin
    
    Se two_factor_code è presente come query parameter, viene usato per verificare 2FA.
    """
    # Verifica se l'utente esiste, altrimenti prova a crearlo
    user_db = db.query(models.Utente).filter(models.Utente.email == form_data.username).first()
    if not user_db:
        # Se non esiste e sono le credenziali di default, crealo
        if form_data.username == "admin@sistema54.it":
            init_superadmin(db)
            user_db = db.query(models.Utente).filter(models.Utente.email == form_data.username).first()
    
    if not user_db:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o password non corretti",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user = auth.authenticate_user(db, form_data.username, form_data.password)
    if not user:
        # Audit: login fallito (utente esistente)
        try:
            from app.audit_logger import log_action
            ip = request.client.host if request and request.client else None
            log_action(db, user_db, 'LOGIN_FAILED', 'auth', user_db.id, entity_name=user_db.email, changes={'reason': 'invalid_credentials'}, ip_address=ip)
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o password non corretti",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Se è superadmin e ha 2FA abilitato, richiedi verifica
    if user.ruolo == models.RuoloUtente.SUPERADMIN and user.two_factor_enabled:
        if not two_factor_code:
            # Richiedi codice 2FA
            return {
                "access_token": "",
                "token_type": "bearer",
        "must_change_password": bool(getattr(user, "must_change_password", False)),
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "nome_completo": user.nome_completo,
                    "ruolo": user.ruolo.value
                },
                "requires_2fa": True,
                "must_change_password": False
            }
        
        # Verifica codice 2FA
        is_valid = False
        updated_backup_codes = user.two_factor_backup_codes or []
        
        # Prova prima con TOTP
        if user.two_factor_secret:
            is_valid = two_factor_service.verify_totp(user.two_factor_secret, two_factor_code)
        
        # Se non valido, prova con backup codes
        if not is_valid and updated_backup_codes:
            is_valid, updated_backup_codes = two_factor_service.verify_backup_code(
                updated_backup_codes, two_factor_code
            )
            if is_valid:
                # Aggiorna backup codes nel database
                user.two_factor_backup_codes = updated_backup_codes
                db.commit()
        
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Codice 2FA non valido",
                headers={"WWW-Authenticate": "Bearer"},
            )


    # Se l'utente è stato invitato o deve cambiare password, impedisci il login
    if getattr(user, 'must_change_password', False):
        raise HTTPException(status_code=403, detail='PASSWORD_CHANGE_REQUIRED')
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.email, "ruolo": user.ruolo.value},
        expires_delta=access_token_expires
    )
    # Audit: login riuscito
    try:
        from app.audit_logger import log_action
        ip = request.client.host if request and request.client else None
        log_action(db, user, 'LOGIN_SUCCESS', 'auth', user.id, entity_name=user.email, changes={'result': 'success'}, ip_address=ip)
    except Exception:
        pass
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "must_change_password": bool(getattr(user, "must_change_password", False)),
        "user": {
            "id": user.id,
            "email": user.email,
            "nome_completo": user.nome_completo,
            "ruolo": user.ruolo.value
        },
        "requires_2fa": False
    }


@router.post("/api/auth/register", response_model=schemas.UserResponse, tags=["Autenticazione"])
@limiter.limit("3/hour")  # Max 3 registrazioni all'ora (solo admin possono registrare)
def register(
    request: Request,
    user_data: schemas.UserCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(database.get_db),
    current_user: models.Utente = Depends(auth.require_admin),
):
    """
    Crea un nuovo utente (solo admin/superadmin) e invia un'email di invito.
    L'utente dovrà impostare la password al primo accesso tramite link.
    """
    import traceback, secrets, hashlib
    from datetime import datetime, timedelta

    # 1) Email univoca
    existing = db.query(models.Utente).filter(models.Utente.email == user_data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email già registrata")

    # 2) Ruolo - RESTRIZIONI PER ADMIN
    try:
        ruolo_enum = user_data.ruolo if isinstance(user_data.ruolo, models.RuoloUtente) else models.RuoloUtente(str(user_data.ruolo).lower())
    except Exception:
        ruolo_enum = models.RuoloUtente.OPERATORE
    
    # Un Admin non può creare SuperAdmin
    if current_user.ruolo != models.RuoloUtente.SUPERADMIN and ruolo_enum == models.RuoloUtente.SUPERADMIN:
        raise HTTPException(status_code=403, detail="Non puoi creare un utente SuperAdmin")

    # 3) Password temporanea (non comunicata), forza cambio password
    temp_password = secrets.token_urlsafe(18)
    try:
        password_hash = auth.get_password_hash(temp_password)
    except Exception as e:
        print("❌ Errore hash password temporanea:", repr(e))
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Errore interno (hash password)")

    # Prepara permessi - RESTRIZIONI PER ADMIN
    permessi_finali = user_data.permessi if getattr(user_data, 'permessi', None) is not None else get_default_permessi(ruolo_enum.value)
    
    # Un Admin non può abilitare can_edit_settings e can_delete_interventi a nessuno
    if current_user.ruolo != models.RuoloUtente.SUPERADMIN:
        if isinstance(permessi_finali, dict):
            permessi_finali = permessi_finali.copy()
            permessi_finali["can_edit_settings"] = False
            permessi_finali["can_delete_interventi"] = False
        else:
            permessi_finali = {
                **get_default_permessi(ruolo_enum.value),
                "can_edit_settings": False,
                "can_delete_interventi": False
            }
    
    # Sanitizza input utente
    email_sanitized = sanitize_email(user_data.email)
    nome_completo_sanitized = sanitize_input(user_data.nome_completo, max_length=255) if user_data.nome_completo else None
    
    db_user = models.Utente(
        email=email_sanitized,
        password_hash=password_hash,
        nome_completo=nome_completo_sanitized,
        ruolo=ruolo_enum,
        is_active=True,
        must_change_password=True,
        permessi=permessi_finali,
    )
    db.add(db_user)
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        print("❌ Errore DB commit (creazione utente):", repr(e))
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Errore salvataggio DB")
    db.refresh(db_user)
    print(f"✅ Creato utente id={db_user.id} email={db_user.email} ruolo={db_user.ruolo}")
    # Audit log (visibile in UI)
    try:
        log_app_event(
            db,
            user=current_user,
            action="CREATE",
            entity_type="utente",
            entity_id=db_user.id,
            entity_name=db_user.email,
            changes={
                "email": {"old": None, "new": db_user.email},
                "ruolo": {"old": None, "new": str(db_user.ruolo)},
            },
            ip_address=(request.client.host if request.client else None),
        )
    except Exception:
        pass




    # 4) Crea token invito (48h)
    raw_token = secrets.token_urlsafe(48)
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    expires_at = datetime.utcnow() + timedelta(hours=48)

    token_row = models.PasswordResetToken(
        user_id=db_user.id,
        token_hash=token_hash,
        purpose="invite",
        expires_at=expires_at,
        used_at=None,
    )
    db.add(token_row)
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        print("❌ Errore DB commit (token invito):", repr(e))
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Errore salvataggio token invito")

    # 5) Base URL dinamico (installazione-agnostica)
    # Prova in ordine: variabile d'ambiente, header origin, header referer, default
    base_url = (
        os.getenv("FRONTEND_URL") or 
        os.getenv("BASE_URL") or
        request.headers.get("origin") or 
        request.headers.get("referer") or 
        ""
    )
    # Rimuovi path dopo il dominio (es: http://example.com/path -> http://example.com)
    if base_url:
        try:
            from urllib.parse import urlparse
            parsed = urlparse(base_url)
            base_url = f"{parsed.scheme}://{parsed.netloc}".rstrip("/")
        except Exception:
            base_url = base_url.rstrip("/")
    
    # Fallback: costruisci da request se possibile, altrimenti usa default configurabile
    if not base_url:
        # Prova a costruire da request
        scheme = request.url.scheme
        host = request.headers.get("host") or request.url.hostname
        if host:
            base_url = f"{scheme}://{host}"
        else:
            # Ultimo fallback: variabile d'ambiente o default generico
            frontend_port = os.getenv("FRONTEND_PORT", "26080")
            base_url = f"http://localhost:{frontend_port}"

    invite_link = f"{base_url}/set-password?token={raw_token}"

    # 6) Email invito (usa la stessa logica/config azienda)
    def _send():
        try:
            company = db.query(models.ImpostazioniAzienda).first()
            nome_azienda = (company.nome_azienda if company else None) or "Sistema54"
            subject = f"[{nome_azienda}] Invito accesso - imposta la password"
            instructions = (
                "Per completare l'attivazione del tuo account, imposta una nuova password seguendo questi criteri:\n"
                "- almeno 10 caratteri\n"
                "- almeno 1 carattere speciale\n"
                "- almeno 1 lettera maiuscola\n"
                "- almeno 1 numero\n"
            )
            body_text = f"Ciao {db_user.nome_completo or ''},\n\n{instructions}\nLink: {invite_link}\n\nSe non hai richiesto questo accesso, ignora questa email."
            body_html = f"""
            <p>Ciao <strong>{db_user.nome_completo or ''}</strong>,</p>
            <p>Per completare l'attivazione del tuo account, imposta una nuova password seguendo questi criteri:</p>
            <ul>
              <li>almeno 10 caratteri</li>
              <li>almeno 1 carattere speciale</li>
              <li>almeno 1 lettera maiuscola</li>
              <li>almeno 1 numero</li>
            </ul>
            <p><a href="{invite_link}">Imposta la tua password</a></p>
            <p>Se non hai richiesto questo accesso, ignora questa email.</p>
            """
            email_service.send_email(db_user.email, subject, body_html, body_text=body_text, db=db)
        except Exception as e:
            print("❌ Errore invio email invito:", repr(e))
            traceback.print_exc()


    # Pianifica invio email invito (background)
    background_tasks.add_task(_send)
    print(f"📧 Invito password pianificato per {db_user.email}")

    return db_user


@router.post("/api/auth/regenerate-access/{user_id}", tags=["Autenticazione"])
@limiter.limit("5/hour")  # Max 5 rigenerazioni accesso all'ora (solo admin)
def regenerate_access(
    request: Request,
    user_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(database.get_db),
    current_user: models.Utente = Depends(auth.require_admin),
):
    """
    Rigenera un link di accesso (tipo recupera password) e invia email all'utente.
    """
    import traceback, secrets, hashlib
    from datetime import datetime, timedelta

    user = db.query(models.Utente).filter(models.Utente.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utente non trovato")

    # forza cambio password
    user.must_change_password = True
    db.add(user)

    # invalida token precedenti non usati (opzionale)
    db.query(models.PasswordResetToken).filter(
        models.PasswordResetToken.user_id == user.id,
        models.PasswordResetToken.used_at.is_(None),
        models.PasswordResetToken.expires_at > datetime.utcnow(),
    ).update({"used_at": datetime.utcnow()})

    raw_token = secrets.token_urlsafe(48)
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    expires_at = datetime.utcnow() + timedelta(hours=48)

    token_row = models.PasswordResetToken(
        user_id=user.id,
        token_hash=token_hash,
        purpose="reset",
        expires_at=expires_at,
        used_at=None,
    )
    db.add(token_row)

    try:
        # Audit log (rigenerazione accesso)
        try:
            log_app_event(
                db,
                user=current_user,
                action="UPDATE",
                entity_type="utente",
                entity_id=user.id,
                entity_name=user.email,
                changes={"regenerate_access": {"old": None, "new": True}},
                ip_address=(request.client.host if request.client else None),
            )
        except Exception:
            pass

        db.commit()
    except Exception as e:
        db.rollback()
        print("❌ Errore rigenerazione accesso:", repr(e))
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Errore rigenerazione accesso")

    # Base URL dinamico (stessa logica di register)
    base_url = (
        os.getenv("FRONTEND_URL") or 
        os.getenv("BASE_URL") or
        request.headers.get("origin") or 
        request.headers.get("referer") or 
        ""
    )
    if base_url:
        try:
            from urllib.parse import urlparse
            parsed = urlparse(base_url)
            base_url = f"{parsed.scheme}://{parsed.netloc}".rstrip("/")
        except Exception:
            base_url = base_url.rstrip("/")
    
    if not base_url:
        scheme = request.url.scheme
        host = request.headers.get("host") or request.url.hostname
        if host:
            base_url = f"{scheme}://{host}"
        else:
            frontend_port = os.getenv("FRONTEND_PORT", "26080")
            base_url = f"http://localhost:{frontend_port}"
    link = f"{base_url}/set-password?token={raw_token}"

    def _send():
        db2 = database.SessionLocal()
        try:
            user2 = db2.query(models.Utente).filter(models.Utente.id == user_id).first()
            if not user2:
                return
            company = db2.query(models.ImpostazioniAzienda).first()
            nome_azienda = (company.nome_azienda if company else None) or "Sistema54"
            subject = f"[{nome_azienda}] Rigenerazione accesso - imposta la password"
            body_text = (
                f"Ciao {user2.nome_completo or ''},\n\n"
                f"Per ripristinare l'accesso, imposta una nuova password dal link: {link}\n\n"
                "Requisiti password: almeno 10 caratteri, 1 speciale, 1 maiuscola, 1 numero."
            )
            body_html = f"""
            <p>Ciao <strong>{user2.nome_completo or ''}</strong>,</p>
            <p>Per ripristinare l'accesso, imposta una nuova password dal link:</p>
            <p><a href=\"{link}\">Imposta la tua password</a></p>
            <p><em>Requisiti:</em> almeno 10 caratteri, 1 speciale, 1 maiuscola, 1 numero.</p>
            """
            email_service.send_email(user2.email, subject, body_html, body_text=body_text, db=db2)
            print(f"✅ Email rigenerazione inviata a {user2.email}")
        except Exception as e:
            print("❌ Errore invio email rigenerazione:", repr(e))
            traceback.print_exc()
        finally:
            db2.close()

    background_tasks.add_task(_send)
    return {"ok": True}


@router.post("/api/auth/set-password", tags=["Autenticazione"])
@limiter.limit("3/hour")  # Max 3 tentativi di impostazione password all'ora
def set_password(request: Request, payload: schemas.PasswordSet, db: Session = Depends(database.get_db)):
    """
    Imposta una nuova password tramite token (invito o reset).
    """
    import re, hashlib
    from datetime import datetime

    # Validazione password
    pw = payload.new_password or ""
    if len(pw) < 10:
        raise HTTPException(status_code=400, detail="Password troppo corta (min 10 caratteri)")
    if not re.search(r"[A-Z]", pw):
        raise HTTPException(status_code=400, detail="La password deve contenere almeno una maiuscola")
    if not re.search(r"[0-9]", pw):
        raise HTTPException(status_code=400, detail="La password deve contenere almeno un numero")
    if not re.search(r"[^A-Za-z0-9]", pw):
        raise HTTPException(status_code=400, detail="La password deve contenere almeno un carattere speciale")

    token_hash = hashlib.sha256(payload.token.encode("utf-8")).hexdigest()
    row = db.query(models.PasswordResetToken).filter(models.PasswordResetToken.token_hash == token_hash).first()
    if not row:
        raise HTTPException(status_code=400, detail="Token non valido")
    if row.used_at is not None:
        raise HTTPException(status_code=400, detail="Token già utilizzato")
    if row.expires_at <= datetime.utcnow():
        raise HTTPException(status_code=400, detail="Token scaduto")

    user = db.query(models.Utente).filter(models.Utente.id == row.user_id).first()
    if not user:
        raise HTTPException(status_code=400, detail="Utente non trovato")

    user.password_hash = auth.get_password_hash(pw)
    user.must_change_password = False
    row.used_at = datetime.utcnow()

    db.add(user)
    db.add(row)
    # Audit log (impostazione password via token)
    try:
        log_app_event(
            db,
            user=user_obj,
            action="UPDATE",
            entity_type="utente",
            entity_id=user.id,
            entity_name=user.email,
            changes={"set_password": {"old": None, "new": True}},
            ip_address=(request.client.host if request.client else None),
        )
    except Exception:
        pass

    db.commit()

    return {"ok": True}
@router.get("/api/auth/me", response_model=schemas.UserResponse, tags=["Autenticazione"])
def get_current_user_info(current_user: models.Utente = Depends(auth.get_current_active_user)):
    """Ottiene informazioni sull'utente corrente"""
    return current_user

# --- API 2FA (Solo SuperAdmin) ---


@router.post("/api/auth/2fa/setup", response_model=schemas.TwoFactorSetupResponse, tags=["Autenticazione"])
def setup_2fa(
    current_user: models.Utente = Depends(auth.require_superadmin),
    db: Session = Depends(database.get_db)
):
    """Genera secret e QR code per configurare 2FA (solo superadmin)"""
    if current_user.ruolo != models.RuoloUtente.SUPERADMIN:
        raise HTTPException(status_code=403, detail="Solo i superadmin possono configurare 2FA")
    
    # Genera nuovo secret
    secret = two_factor_service.generate_secret()
    
    # Genera QR code
    qr_code = two_factor_service.generate_qr_code(secret, current_user.email)
    
    # Genera codici di backup
    backup_codes = two_factor_service.generate_backup_codes(10)
    
    # Salva secret e backup codes nel database (ma non abilita ancora 2FA)
    current_user.two_factor_secret = secret
    current_user.two_factor_backup_codes = backup_codes
    db.commit()
    
    return {
        "secret": secret,
        "qr_code": qr_code,
        "backup_codes": backup_codes
    }


@router.post("/api/auth/2fa/enable", tags=["Autenticazione"])
def enable_2fa(
    verify_request: schemas.TwoFactorVerifyRequest,
    current_user: models.Utente = Depends(auth.require_superadmin),
    db: Session = Depends(database.get_db)
):
    """Abilita 2FA dopo aver verificato il codice (solo superadmin)"""
    if current_user.ruolo != models.RuoloUtente.SUPERADMIN:
        raise HTTPException(status_code=403, detail="Solo i superadmin possono abilitare 2FA")
    
    if not current_user.two_factor_secret:
        raise HTTPException(status_code=400, detail="Devi prima configurare 2FA")
    
    # Verifica il codice
    is_valid = two_factor_service.verify_totp(current_user.two_factor_secret, verify_request.code)
    
    if not is_valid:
        raise HTTPException(status_code=400, detail="Codice 2FA non valido")
    
    # Abilita 2FA
    current_user.two_factor_enabled = True
    db.commit()
    
    return {"message": "2FA abilitato con successo"}


@router.post("/api/auth/2fa/disable", tags=["Autenticazione"])
def disable_2fa(
    verify_request: schemas.TwoFactorVerifyRequest,
    current_user: models.Utente = Depends(auth.require_superadmin),
    db: Session = Depends(database.get_db)
):
    """Disabilita 2FA dopo aver verificato il codice (solo superadmin)"""
    if current_user.ruolo != models.RuoloUtente.SUPERADMIN:
        raise HTTPException(status_code=403, detail="Solo i superadmin possono disabilitare 2FA")
    
    if not current_user.two_factor_enabled:
        raise HTTPException(status_code=400, detail="2FA non è abilitato")
    
    # Verifica il codice prima di disabilitare
    is_valid = False
    if current_user.two_factor_secret:
        is_valid = two_factor_service.verify_totp(current_user.two_factor_secret, verify_request.code)
    
    # Se non valido, prova con backup codes
    if not is_valid and current_user.two_factor_backup_codes:
        is_valid, _ = two_factor_service.verify_backup_code(
            current_user.two_factor_backup_codes, verify_request.code
        )
    
    if not is_valid:
        raise HTTPException(status_code=400, detail="Codice 2FA non valido")
    
    # Disabilita 2FA
    current_user.two_factor_enabled = False
    current_user.two_factor_secret = None
    current_user.two_factor_backup_codes = None
    db.commit()
    
    return {"message": "2FA disabilitato con successo"}


@router.post("/api/auth/2fa/regenerate-backup", tags=["Autenticazione"])
def regenerate_backup_codes(
    current_user: models.Utente = Depends(auth.require_superadmin),
    db: Session = Depends(database.get_db)
):
    """Rigenera codici di backup per 2FA (solo superadmin)"""
    if current_user.ruolo != models.RuoloUtente.SUPERADMIN:
        raise HTTPException(status_code=403, detail="Solo i superadmin possono rigenerare backup codes")
    
    if not current_user.two_factor_enabled:
        raise HTTPException(status_code=400, detail="2FA non è abilitato")
    
    # Genera nuovi backup codes
    backup_codes = two_factor_service.generate_backup_codes(10)
    current_user.two_factor_backup_codes = backup_codes
    db.commit()
    
    return {"backup_codes": backup_codes}


@router.post("/api/auth/oauth", response_model=schemas.Token, tags=["Autenticazione"])
def oauth_login(oauth_data: schemas.OAuthLoginRequest, db: Session = Depends(database.get_db)):
    """Login con OAuth (Google, Microsoft) - Placeholder per implementazione futura"""
    # TODO: Implementare verifica token OAuth
    raise HTTPException(status_code=501, detail="OAuth non ancora implementato")

# --- API UTENTI (Solo Admin) ---
