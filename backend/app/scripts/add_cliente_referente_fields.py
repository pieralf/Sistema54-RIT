import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text  # noqa: E402

from app import database  # noqa: E402


def main() -> None:
    session = database.SessionLocal()
    try:
        session.execute(text("ALTER TABLE clienti ADD COLUMN IF NOT EXISTS referente_nome VARCHAR;"))
        session.execute(text("ALTER TABLE clienti ADD COLUMN IF NOT EXISTS referente_cellulare VARCHAR;"))
        session.commit()
        print("Colonne referente_nome e referente_cellulare aggiunte (se mancavano).")
    finally:
        session.close()


if __name__ == "__main__":
    main()
