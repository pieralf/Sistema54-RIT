#!/usr/bin/env python3
"""
Migrazione per gestione assegnazione DDT:
- Aggiunge colonne assegnazione e log note su ritiri_prodotti
- Aggiunge configurazioni modalità assegnazione su impostazioni_azienda
"""
import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker


def _get_database_url() -> str:
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        db_host = os.getenv("DB_HOST", "localhost")
        db_name = os.getenv("DB_NAME", "sistema54")
        db_user = os.getenv("DB_USER", "postgres")
        db_pass = os.getenv("DB_PASSWORD", "postgres")
        return f"postgresql://{db_user}:{db_pass}@{db_host}:5432/{db_name}"
    return db_url


def _add_column_if_missing(session, table: str, column: str, ddl: str):
    exists = session.execute(
        text(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = :table_name AND column_name = :column_name
            """
        ),
        {"table_name": table, "column_name": column},
    ).fetchone()
    if not exists:
        session.execute(text(ddl))
        session.commit()
        print(f"✅ Colonna {column} aggiunta a {table}.")
    else:
        print(f"✅ Colonna {column} già presente in {table}.")


def migrate():
    db_url = _get_database_url()
    engine = create_engine(db_url)
    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        print("🔄 Migrazione assegnazioni DDT...")

        _add_column_if_missing(
            session,
            "ritiri_prodotti",
            "assegnazione_stato",
            "ALTER TABLE ritiri_prodotti ADD COLUMN assegnazione_stato VARCHAR DEFAULT 'da_assegnare' NOT NULL;",
        )
        _add_column_if_missing(
            session,
            "ritiri_prodotti",
            "tecnico_assegnato_id",
            "ALTER TABLE ritiri_prodotti ADD COLUMN tecnico_assegnato_id INTEGER REFERENCES utenti(id);",
        )
        _add_column_if_missing(
            session,
            "ritiri_prodotti",
            "tecnico_assegnazione_pending_id",
            "ALTER TABLE ritiri_prodotti ADD COLUMN tecnico_assegnazione_pending_id INTEGER REFERENCES utenti(id);",
        )
        _add_column_if_missing(
            session,
            "ritiri_prodotti",
            "assegnazioni_log",
            "ALTER TABLE ritiri_prodotti ADD COLUMN assegnazioni_log JSONB DEFAULT '[]'::jsonb;",
        )
        _add_column_if_missing(
            session,
            "ritiri_prodotti",
            "note_log",
            "ALTER TABLE ritiri_prodotti ADD COLUMN note_log JSONB DEFAULT '[]'::jsonb;",
        )
        _add_column_if_missing(
            session,
            "ritiri_prodotti",
            "stato_updated_at",
            "ALTER TABLE ritiri_prodotti ADD COLUMN stato_updated_at TIMESTAMP;",
        )

        # Backfill stato_updated_at se null
        session.execute(text("""
            UPDATE ritiri_prodotti
            SET stato_updated_at = COALESCE(stato_updated_at, data_ritiro, NOW())
        """))
        session.commit()

        _add_column_if_missing(
            session,
            "impostazioni_azienda",
            "ddt_assegnazione_modalita",
            "ALTER TABLE impostazioni_azienda ADD COLUMN ddt_assegnazione_modalita VARCHAR DEFAULT 'manual';",
        )
        _add_column_if_missing(
            session,
            "impostazioni_azienda",
            "ddt_assegnazione_alert_abilitato",
            "ALTER TABLE impostazioni_azienda ADD COLUMN ddt_assegnazione_alert_abilitato BOOLEAN DEFAULT TRUE;",
        )

        print("✅ Migrazione completata.")
    except Exception as e:
        session.rollback()
        print(f"❌ Errore durante la migrazione: {e}")
        raise
    finally:
        session.close()


if __name__ == "__main__":
    migrate()
