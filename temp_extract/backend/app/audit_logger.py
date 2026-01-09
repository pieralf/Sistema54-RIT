"""Utility per registrare operazioni di audit log (visibili in Admin → Logs)."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from . import models


def log_action(
    db: Session,
    user: models.Utente,
    action: str,  # CREATE, UPDATE, DELETE
    entity_type: str,  # 'cliente', 'intervento', 'magazzino', 'utente', ...
    entity_id: int,
    entity_name: Optional[str] = None,
    changes: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None,
) -> None:
    """Registra una riga in `audit_logs`.

    È pensato per essere *best-effort*: se fallisce non deve bloccare la richiesta.
    Usa snapshot di email/nome per mantenere contesto storico.
    """
    try:
        db.add(
            models.AuditLog(
                user_id=user.id,
                user_email=user.email or "",
                user_nome=user.nome_completo or user.email or "",
                action=action,
                entity_type=entity_type,
                entity_id=entity_id,
                entity_name=entity_name,
                changes=changes,
                ip_address=ip_address,
                timestamp=datetime.now(),
            )
        )
        # Commit separato: gli endpoint spesso hanno già commitato l'entità principale
        db.commit()
    except Exception:
        try:
            db.rollback()
        except Exception:
            pass


def calculate_changes(old_obj: Any, new_obj: Any, fields: list[str]) -> Dict[str, Any]:
    """Calcola un dict {field: {old,new}} per i campi richiesti."""
    changes: Dict[str, Any] = {}
    for field in fields:
        old_value = getattr(old_obj, field, None)
        new_value = getattr(new_obj, field, None)
        if old_value != new_value:
            changes[field] = {"old": old_value, "new": new_value}
    return changes


# Backward compatible alias

def get_changes_dict(old_obj: Any, new_obj: Any, fields: list[str]) -> Dict[str, Any]:
    return calculate_changes(old_obj, new_obj, fields)
