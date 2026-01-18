import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text  # noqa: E402

from app import database  # noqa: E402


def main() -> None:
    session = database.SessionLocal()
    try:
        session.execute(text("ALTER TABLE impostazioni_azienda ADD COLUMN IF NOT EXISTS contratti_alert_emails VARCHAR;"))
        session.execute(text("ALTER TABLE impostazioni_azienda ADD COLUMN IF NOT EXISTS contratti_alert_giorni_1 INTEGER;"))
        session.execute(text("ALTER TABLE impostazioni_azienda ADD COLUMN IF NOT EXISTS contratti_alert_giorni_2 INTEGER;"))
        session.execute(text("ALTER TABLE impostazioni_azienda ADD COLUMN IF NOT EXISTS contratti_alert_giorni_3 INTEGER;"))
        session.execute(text("ALTER TABLE impostazioni_azienda ADD COLUMN IF NOT EXISTS contratti_alert_abilitato BOOLEAN;"))
        session.execute(text("ALTER TABLE impostazioni_azienda ADD COLUMN IF NOT EXISTS letture_copie_alert_emails VARCHAR;"))
        session.execute(text("ALTER TABLE impostazioni_azienda ADD COLUMN IF NOT EXISTS letture_copie_alert_giorni_1 INTEGER;"))
        session.execute(text("ALTER TABLE impostazioni_azienda ADD COLUMN IF NOT EXISTS letture_copie_alert_giorni_2 INTEGER;"))
        session.execute(text("ALTER TABLE impostazioni_azienda ADD COLUMN IF NOT EXISTS letture_copie_alert_giorni_3 INTEGER;"))
        session.execute(text("ALTER TABLE impostazioni_azienda ADD COLUMN IF NOT EXISTS letture_copie_alert_abilitato BOOLEAN;"))
        session.execute(text("ALTER TABLE impostazioni_azienda ADD COLUMN IF NOT EXISTS backup_alert_emails VARCHAR;"))
        session.execute(text("ALTER TABLE impostazioni_azienda ADD COLUMN IF NOT EXISTS backup_alert_abilitato BOOLEAN;"))
        session.commit()
        print("Colonne alert contratti/letture copie aggiunte (se mancavano).")
    finally:
        session.close()


if __name__ == "__main__":
    main()
