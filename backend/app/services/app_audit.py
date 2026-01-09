from __future__ import annotations

from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from app import models


def log_app_event(
    db: Session,
    *,
    user: models.Utente,
    action: str,
    entity_type: str,
    entity_id: int,
    entity_name: Optional[str] = None,
    changes: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None,
) -> None:
    """Registra un evento applicativo in audit_logs (visibile nella UI).

    NOTE:
    - Non fa commit: l'operazione chiamante decide quando commit/rollback.
    - Usa snapshot email/nome per avere contesto anche se l'utente cambia in futuro.
    """
    try:
        log = models.AuditLog(
            user_id=user.id,
            user_email=user.email or "",
            user_nome=user.nome_completo or user.email or "",
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            entity_name=entity_name,
            changes=changes,
            ip_address=ip_address,
        )
        db.add(log)
    except Exception:
        # Non deve bloccare l'operazione principale
        pass
