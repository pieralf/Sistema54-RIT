import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text  # noqa: E402

from app import database  # noqa: E402


def main() -> None:
    session = database.SessionLocal()
    try:
        session.execute(text("ALTER TABLE dettagli_intervento ADD COLUMN IF NOT EXISTS difetto_segnalato TEXT;"))
        session.commit()
        print("Colonna difetto_segnalato aggiunta a dettagli_intervento (se mancava).")
    finally:
        session.close()


if __name__ == "__main__":
    main()
