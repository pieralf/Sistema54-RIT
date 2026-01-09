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


def get_settings_or_default(db: Session) -> models.ImpostazioniAzienda:
    """Restituisce le impostazioni azienda; se mancanti crea un record di default (idempotente)."""
    settings = db.query(models.ImpostazioniAzienda).first()
    if settings:
        return settings

    # crea defaults (evita 500 su /impostazioni/public al primo avvio)
    settings = models.ImpostazioniAzienda(
        logo_url="",
        nome_azienda="SISTEMA54",
        colore_primario="#4F46E5",
    )
    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings


@router.get("/impostazioni/public", tags=["Configurazione"])
def read_impostazioni_public(db: Session = Depends(database.get_db)):
    """Endpoint pubblico per ottenere logo, nome azienda e colore primario (senza autenticazione)"""
    try:
        settings = get_settings_or_default(db)
        return {
            "logo_url": settings.logo_url if settings.logo_url else "",
            "nome_azienda": settings.nome_azienda if settings.nome_azienda else "SISTEMA54",
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
    return db_settings

# --- API LETTURE COPIE ---
