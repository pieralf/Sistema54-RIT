import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app.services.backup_service import _send_backup_notification_email


def main() -> None:
    db = SessionLocal()
    try:
        _send_backup_notification_email(
            db=db,
            success=True,
            backup_id="TEST_GIT_BACKUP.tar.gz",
            file_size_mb=12.34,
            upload_results=[{"name": "Backup locale", "success": True}],
        )
        _send_backup_notification_email(
            db=db,
            success=False,
            backup_id="TEST_GIT_BACKUP.tar.gz",
            error="Errore simulato test backup",
        )
        print("Test email backup completato.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
