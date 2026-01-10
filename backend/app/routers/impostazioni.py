from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status, UploadFile, File, Query, Request
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import Response, FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta, time as dt_time

from .. import models, schemas, database, auth
from ..services import pdf_service, email_service, two_factor_service
from ..services.backup_service import (
    list_backups,
    create_backup,
    delete_backup,
    restore_backup,
    get_backup_info,
    get_backup_status,
)

router = APIRouter()
import logging
from datetime import datetime, timedelta
from typing import Optional

logger = logging.getLogger(__name__)

# -------------------- CACHING SETTINGS AZIENDA --------------------
# Cache in memoria per settings azienda (TTL: 5 minuti)
_settings_cache = {
    "data": None,
    "timestamp": None,
    "ttl_seconds": 300  # 5 minuti
}

def get_settings_or_default(db: Session, force_refresh: bool = False) -> models.ImpostazioniAzienda:
    """
    Restituisce le impostazioni azienda con caching.
    Cache invalidata automaticamente dopo TTL o manualmente con force_refresh=True.
    """
    global _settings_cache
    
    # Verifica se la cache è valida
    if not force_refresh and _settings_cache["data"] and _settings_cache["timestamp"]:
        age = (datetime.now() - _settings_cache["timestamp"]).total_seconds()
        if age < _settings_cache["ttl_seconds"]:
            # Cache valida, ritorna dati cached
            return _settings_cache["data"]
    
    # Cache scaduta o force_refresh, carica da DB
    settings = db.query(models.ImpostazioniAzienda).first()
    if settings:
        # Aggiorna cache
        _settings_cache["data"] = settings
        _settings_cache["timestamp"] = datetime.now()
        return settings

    # crea defaults (evita 500 su /impostazioni/public al primo avvio)
    settings = models.ImpostazioniAzienda(
        logo_url="",
        nome_azienda="GIT - Gestione Interventi Tecnici",
        colore_primario="#4F46E5",
    )
    db.add(settings)
    db.commit()
    db.refresh(settings)
    
    # Aggiorna cache
    _settings_cache["data"] = settings
    _settings_cache["timestamp"] = datetime.now()
    
    return settings

def invalidate_settings_cache():
    """Invalida la cache delle settings (chiamato dopo update)"""
    global _settings_cache
    _settings_cache["data"] = None
    _settings_cache["timestamp"] = None
# ------------------ /CACHING SETTINGS AZIENDA ---------------------


@router.get("/impostazioni/public", tags=["Configurazione"])
def read_impostazioni_public(db: Session = Depends(database.get_db)):
    """Endpoint pubblico per ottenere logo, nome azienda e colore primario (senza autenticazione)"""
    try:
        settings = get_settings_or_default(db)
        return {
            "logo_url": settings.logo_url if settings.logo_url else "",
            "nome_azienda": settings.nome_azienda if settings.nome_azienda else "GIT - Gestione Interventi Tecnici",
            "colore_primario": settings.colore_primario if settings.colore_primario else "#4F46E5"
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Errore caricamento impostazioni: {str(e)}")


@router.get("/impostazioni/", response_model=schemas.ImpostazioniAziendaResponse, tags=["Configurazione"])
def read_impostazioni(db: Session = Depends(database.get_db), current_user: models.Utente = Depends(auth.get_current_active_user)):
    return get_settings_or_default(db)


@router.put("/impostazioni/", response_model=schemas.ImpostazioniAziendaResponse, tags=["Configurazione"])
def update_impostazioni(settings: schemas.ImpostazioniAziendaCreate, db: Session = Depends(database.get_db), current_user: models.Utente = Depends(auth.require_admin)):
    db_settings = db.query(models.ImpostazioniAzienda).first()
    if not db_settings:
        db_settings = models.ImpostazioniAzienda(**settings.model_dump())
        db.add(db_settings)
    else:
        for key, value in settings.model_dump().items():
            setattr(db_settings, key, value)
    db.commit()
    db.refresh(db_settings)
    
    # Invalida cache settings dopo update
    invalidate_settings_cache()
    
    # Ricarica gli scheduler backup se sono stati modificati i parametri di scheduling
    schedule_keys = [
        'backup_local_schedule_enabled', 'backup_local_schedule_time',
        'backup_nas_schedule_enabled', 'backup_nas_schedule_time',
        'backup_cloud_schedule_enabled', 'backup_cloud_schedule_time'
    ]
    settings_dict = settings.model_dump(exclude_unset=False)
    if any(key in settings_dict for key in schedule_keys):
        try:
            # Importa lo scheduler globalmente definito in main
            from ..main import setup_backup_schedulers
            logger.info("[IMPOSTAZIONI] Ricaricamento scheduler backup dopo modifica impostazioni...")
            setup_backup_schedulers()
            logger.info("[IMPOSTAZIONI] Scheduler backup ricaricati con successo")
        except ImportError:
            import sys
            if 'app.main' in sys.modules:
                main_module = sys.modules['app.main']
                if hasattr(main_module, 'setup_backup_schedulers'):
                    logger.info("[IMPOSTAZIONI] Ricaricamento scheduler backup dopo modifica impostazioni (via sys.modules)...")
                    main_module.setup_backup_schedulers()
                    logger.info("[IMPOSTAZIONI] Scheduler backup ricaricati con successo")
                else:
                    logger.warning("[IMPOSTAZIONI] setup_backup_schedulers non trovato in main")
            else:
                logger.warning("[IMPOSTAZIONI] Modulo app.main non trovato in sys.modules")
        except Exception as e:
            import traceback
            logger.error(f"[IMPOSTAZIONI] Errore ricaricamento scheduler backup: {e}")
            logger.debug(f"[IMPOSTAZIONI] Traceback: {traceback.format_exc()}")
    
    return db_settings

# --- API LETTURE COPIE ---
