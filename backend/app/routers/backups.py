from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status, UploadFile, File, Query, Request
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import Response, FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta, time as dt_time

import logging
import traceback
import shutil
import json

from .. import models, schemas, database, auth
from ..services import pdf_service, email_service, two_factor_service
from ..config import BACKUPS_DIR
from ..audit_logger import log_action
from ..services.backup_service import (
    list_backups,
    create_backup,
    delete_backup,
    restore_backup,
    get_backup_info,
    get_backup_status,
    list_backup_targets,
    upsert_backup_target,
    delete_backup_target,
    push_backup_to_target,
    pull_backup_from_target,
)

logger = logging.getLogger(__name__)


def _client_ip(request: Request | None) -> str | None:
    try:
        return request.client.host if request and request.client else None
    except Exception:
        return None

router = APIRouter()


@router.get("/api/backups/", response_model=List[schemas.BackupInfo], tags=["Backup"])
def get_backups(
    db: Session = Depends(database.get_db),
    current_user: models.Utente = Depends(auth.require_superadmin)
):
    """Ottiene la lista di tutti i backup disponibili"""
    try:
        backups = list_backups()
        return backups
    except Exception as e:
        logger.exception("Errore endpoint")
        raise HTTPException(status_code=500, detail=f"Errore durante il recupero dei backup: {str(e)}")


@router.get("/api/backups/status", response_model=schemas.BackupStatusResponse, tags=["Backup"])
def get_backup_status_endpoint(
    db: Session = Depends(database.get_db),
    current_user: models.Utente = Depends(auth.require_superadmin)
):
    """Ottiene lo stato corrente del backup"""
    try:
        status = get_backup_status()
        return status
    except Exception as e:
        logger.exception("Errore endpoint")
        raise HTTPException(status_code=500, detail=f"Errore durante il recupero dello stato: {str(e)}")


@router.get("/api/backups/{backup_id}", response_model=schemas.BackupInfo, tags=["Backup"])
def get_backup(
    backup_id: str,
    db: Session = Depends(database.get_db),
    current_user: models.Utente = Depends(auth.require_superadmin)
):
    """Ottiene informazioni dettagliate su un backup specifico"""
    backup_info = get_backup_info(backup_id)
    if not backup_info:
        raise HTTPException(status_code=404, detail="Backup non trovato")
    return backup_info


@router.post("/api/backups/create", response_model=schemas.BackupCreateResponse, tags=["Backup"])
def create_backup_endpoint(
    background_tasks: BackgroundTasks,
    request: Request,
    target_ids: str | None = None,
    db: Session = Depends(database.get_db),
    current_user: models.Utente = Depends(auth.require_superadmin)
):
    """Crea un nuovo backup completo"""
    try:
        # Log audit (usiamo 0 come ID placeholder per i backup che non hanno un ID nel database)
        log_action(
            db=db,
            user=current_user,
            action="CREATE",
            entity_type="backup",
            entity_id=0,
            entity_name="Backup completo",
            ip_address=(request.client.host if request and request.client else None)
        )
        
        ids: list[int] | None = None
        if target_ids:
            try:
                ids = [int(x.strip()) for x in target_ids.split(",") if x.strip()]
            except Exception:
                raise HTTPException(status_code=400, detail="target_ids non valido (usa lista separata da virgole)")

        result = create_backup(background=True, db=db, target_ids=ids)
        return result
    except Exception as e:
        logger.exception("Errore create_backup_endpoint")
        raise HTTPException(status_code=500, detail=f"Errore durante la creazione del backup: {str(e)}")


@router.delete("/api/backups/{backup_id}", tags=["Backup"])
def delete_backup_endpoint(
    backup_id: str,
    request: Request,
    db: Session = Depends(database.get_db),
    current_user: models.Utente = Depends(auth.require_superadmin)
):
    """Elimina un backup"""
    try:
        delete_backup(backup_id)
        
        # Log audit (usiamo 0 come ID placeholder per i backup che non hanno un ID nel database)
        log_action(
            db=db,
            user=current_user,
            action="DELETE",
            entity_type="backup",
            entity_id=0,
            entity_name=backup_id,
            ip_address=(request.client.host if request and request.client else None)
        )
        
        return {"message": "Backup eliminato con successo"}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Backup non trovato")
    except Exception as e:
        logger.exception("Errore endpoint")
        raise HTTPException(status_code=500, detail=f"Errore durante l'eliminazione del backup: {str(e)}")


@router.get("/api/backups/{backup_id}/download", tags=["Backup"])
def download_backup(
    backup_id: str,
    db: Session = Depends(database.get_db),
    current_user: models.Utente = Depends(auth.require_superadmin)
):
    """Scarica un file di backup"""
    # Percorsi assoluti/centralizzati (evita problemi di cwd in Docker)
    backup_file = (BACKUPS_DIR / backup_id).resolve()
    
    # Safety: deve rimanere dentro BACKUPS_DIR
    if not str(backup_file).startswith(str(BACKUPS_DIR.resolve())):
        raise HTTPException(status_code=400, detail="ID backup non valido")

    if not backup_file.exists():
        raise HTTPException(status_code=404, detail="Backup non trovato")
    
    return FileResponse(
        path=str(backup_file),
        filename=backup_id,
        media_type="application/octet-stream"
    )


@router.get("/api/backups/{backup_id}/restore", tags=["Backup"])
def restore_backup_method_guard(backup_id: str):
    """Guard per impedire chiamate GET all'endpoint di restore.

    Il browser/DevTools (o estensioni) possono provare a fare GET sull'URL dopo un POST fallito.
    Non vogliamo che questo generi 401 (mancanza token) e confonda: deve essere chiaramente 405.
    """
    raise HTTPException(
        status_code=405,
        detail="Metodo non consentito: usa POST /api/backups/{backup_id}/restore",
    )


@router.post("/api/backups/{backup_id}/restore", response_model=schemas.BackupRestoreResponse, tags=["Backup"])
def restore_backup_endpoint(
    backup_id: str,
    restore_request: schemas.BackupRestoreRequest,
    request: Request,
    db: Session = Depends(database.get_db),
    current_user: models.Utente = Depends(auth.require_superadmin)
):
    logger.info(
        "🔁 Restore richiesto: backup_id=%s restore_type=%s user=%s ip=%s",
        backup_id,
        restore_request.restore_type,
        getattr(current_user, "email", None),
        _client_ip(request),
    )
    """Ripristina un backup"""
    try:
        # Log audit (usiamo 0 come ID placeholder per i backup che non hanno un ID nel database)
        log_action(
            db=db,
            user=current_user,
            action="RESTORE",
            entity_type="backup",
            entity_id=0,
            entity_name=f"{backup_id} (tipo: {restore_request.restore_type})",
            ip_address=(request.client.host if request and request.client else None)
        )
        
        result = restore_backup(backup_id, restore_request.restore_type)
        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        # Stampa lo stacktrace anche su stdout per renderlo sempre visibile nei docker logs
        logger.exception("❌ Errore restore_backup_endpoint")
        print(traceback.format_exc(), flush=True)
        raise HTTPException(status_code=500, detail=f"Errore durante il ripristino: {str(e)}")
    

@router.post("/api/backups/upload-restore", response_model=schemas.BackupRestoreResponse, tags=["Backup"])
def upload_and_restore_backup(
    file: UploadFile = File(...),
    restore_type: str = Query("full", description="Tipo di ripristino: full, database, volumes, config"),
    request: Request = None,
    db: Session = Depends(database.get_db),
    current_user: models.Utente = Depends(auth.require_superadmin)
):
    """Carica un file di backup e lo ripristina"""
    from pathlib import Path
    
    try:
        # Verifica estensione file
        if not file.filename.endswith(('.tar.gz', '.zip')):
            raise HTTPException(status_code=400, detail="Il file deve essere un backup valido (.tar.gz o .zip)")
        
        # Salva il file temporaneamente nella directory backups
        backup_dir = Path("backups")
        backup_dir.mkdir(exist_ok=True)
        
        # Genera nome file univoco
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        uploaded_filename = f"uploaded_backup_{timestamp}_{file.filename}"
        backup_file_path = backup_dir / uploaded_filename
        
        # Salva il file
        with open(backup_file_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
        
        # Log audit
        log_action(
            db=db,
            user=current_user,
            action="RESTORE",
            entity_type="backup",
            entity_id=0,
            entity_name=f"{uploaded_filename} (tipo: {restore_type}, upload)",
            ip_address=(request.client.host if request and request.client else None)
        )
        
        # Ripristina il backup
        result = restore_backup(uploaded_filename, restore_type)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Errore endpoint")
        raise HTTPException(status_code=500, detail=f"Errore durante il caricamento e ripristino: {str(e)}")

# -----------------------------
# Destinazioni backup (Cloud / LAN) via rclone
# -----------------------------

@router.get("/api/backup-targets", tags=["Backup"])
def get_backup_targets(
    db: Session = Depends(database.get_db),
    current_user: models.Utente = Depends(auth.require_superadmin),
):
    return list_backup_targets(db)


@router.post("/api/backup-targets", tags=["Backup"])
def create_or_update_backup_target(
    payload: dict,
    request: Request,
    db: Session = Depends(database.get_db),
    current_user: models.Utente = Depends(auth.require_superadmin),
):
    """Crea o aggiorna una destinazione backup.
    
    payload atteso:
    {id?, name, kind: onedrive|gdrive|dropbox|smb|ftp|sftp, remote_path, enabled, config:{...}}
    """
    try:
        # Log dettagliato per debug
        print(f"[BACKUP TARGET] POST ricevuto: payload={payload}")
        logger.info(f"Creazione/aggiornamento backup target: payload={payload}")
        logger.debug(f"Payload type: {type(payload)}, keys: {payload.keys() if isinstance(payload, dict) else 'not a dict'}")
        
        # --- Normalizzazione input ---
        # 0) Alias per compatibilità: il frontend può inviare "provider" invece di "kind"
        if "provider" in payload and "kind" not in payload:
            payload["kind"] = payload.pop("provider")
        
        # 0.1) Alias per compatibilità: il frontend può inviare "drive" per Google Drive
        if isinstance(payload.get("kind"), str):
            k = payload["kind"].strip().lower()
            if k == "drive":
                payload["kind"] = "gdrive"

        # 1) config può arrivare come stringa JSON dal textarea
        cfg = payload.get("config")
        if isinstance(cfg, str) and cfg.strip():
            try:
                payload["config"] = json.loads(cfg)
            except json.JSONDecodeError as e:
                logger.error(f"Errore parsing JSON config: {str(e)}")
                raise HTTPException(status_code=400, detail=f"Config non valida: deve essere JSON valido. Errore: {str(e)}")

        cfg = payload.get("config")

        # 2) Per rclone cloud: accettiamo sia {"token":{...}} che direttamente il token {access_token,...}
        kind = (payload.get("kind") or "").lower().strip()
        if kind in {"onedrive", "gdrive", "dropbox"} and isinstance(cfg, dict):
            if "token" not in cfg and ("access_token" in cfg or "refresh_token" in cfg):
                # l'utente ha incollato direttamente il token
                cfg = {"token": json.dumps(cfg, ensure_ascii=False)}
                payload["config"] = cfg
            elif "token" in cfg and isinstance(cfg.get("token"), (dict, list)):
                cfg["token"] = json.dumps(cfg["token"], ensure_ascii=False)
                payload["config"] = cfg

        # 3) remote_path: permettiamo anche input tipo "gdrive:Cartella" o "remote:Cartella"
        rp = payload.get("remote_path")
        if isinstance(rp, str) and ":" in rp and not rp.startswith("//"):
            # prendo la parte dopo il primo ':'
            payload["remote_path"] = rp.split(":", 1)[1].lstrip("/")
        
        # 4) Validazione base
        if not payload.get("name") or not payload.get("name").strip():
            raise HTTPException(status_code=400, detail="Nome destinazione obbligatorio")
        if not payload.get("kind") or not payload.get("kind").strip():
            raise HTTPException(status_code=400, detail="Tipo destinazione obbligatorio")
        
        t = upsert_backup_target(db, payload)
        
        logger.info(f"Backup target creato/aggiornato con successo: {t.name} (ID: {t.id})")
        
        log_action(
            db=db,
            user=current_user,
            action="UPDATE" if payload.get("id") else "CREATE",
            entity_type="backup_target",
            entity_id=t.id,
            entity_name=t.name,
            ip_address=(request.client.host if request and request.client else None),
        )
        return {"ok": True, "target": {"id": t.id, "name": t.name, "kind": t.kind, "remote_path": t.remote_path, "enabled": t.enabled}}
    
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Errore validazione backup target: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception(f"Errore creazione/aggiornamento backup target: {str(e)}")
        import traceback
        error_detail = f"Errore interno: {str(e)}"
        logger.error(f"Traceback completo:\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=error_detail)


@router.delete("/api/backup-targets/{target_id}", tags=["Backup"])
def remove_backup_target(
    target_id: int,
    request: Request,
    db: Session = Depends(database.get_db),
    current_user: models.Utente = Depends(auth.require_superadmin),
):
    deleted = delete_backup_target(db, target_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Target non trovato")
    log_action(
        db=db,
        user=current_user,
        action="DELETE",
        entity_type="backup_target",
        entity_id=target_id,
        entity_name=str(target_id),
        ip_address=(request.client.host if request and request.client else None),
    )
    return {"ok": True}


@router.post("/api/backups/{backup_id}/push/{target_id}", tags=["Backup"])
def push_backup(
    backup_id: str,
    target_id: int,
    request: Request,
    db: Session = Depends(database.get_db),
    current_user: models.Utente = Depends(auth.require_superadmin),
):
    try:
        res = push_backup_to_target(db, backup_id, target_id)
        log_action(
            db=db,
            user=current_user,
            action="CREATE",
            entity_type="backup_upload",
            entity_id=0,
            entity_name=f"{backup_id} -> target:{target_id}",
            ip_address=(request.client.host if request and request.client else None),
        )
        return {"ok": True, "result": res}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception("Errore endpoint")
        raise HTTPException(status_code=500, detail=f"Errore upload backup: {str(e)}")


@router.post("/api/backups/pull", tags=["Backup"])
def pull_backup(
    target_id: int = Query(..., description="ID target backup"),
    remote_filename: str = Query(..., description="Nome file backup remoto"),
    request: Request = None,
    db: Session = Depends(database.get_db),
    current_user: models.Utente = Depends(auth.require_superadmin),
):
    """Scarica un backup da un target verso BACKUPS_DIR."""
    try:
        local_name = pull_backup_from_target(db, target_id, remote_filename)
        log_action(
            db=db,
            user=current_user,
            action="CREATE",
            entity_type="backup_download",
            entity_id=0,
            entity_name=f"{remote_filename} <- target:{target_id} as {local_name}",
            ip_address=(request.client.host if request and request.client else None),
        )
        return {"ok": True, "backup_id": local_name}
    except Exception as e:
        logger.exception("Errore endpoint")
        raise HTTPException(status_code=500, detail=f"Errore download backup: {str(e)}")