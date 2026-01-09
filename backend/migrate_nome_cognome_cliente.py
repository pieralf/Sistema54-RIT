#!/usr/bin/env python3
"""
Script di migrazione per aggiungere nome_cliente e cognome_cliente a interventi
"""

import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker


def _get_database_url() -> str:
    """
    Preferisce DATABASE_URL (docker-compose/portainer).
    Fallback: costruisce da DATABASE_HOST (compatibilità con vecchi script).
    """
    db_url = os.getenv("DATABASE_URL")
    if db_url:
        return db_url

    db_host = os.getenv("DATABASE_HOST", "db")
    db_user = os.getenv("POSTGRES_USER", "admin")
    db_pass = os.getenv("POSTGRES_PASSWORD", "sistema54secure")
    db_name = os.getenv("POSTGRES_DB", "sistema54_db")
    return f"postgresql://{db_user}:{db_pass}@{db_host}:5432/{db_name}"


def migrate():
    database_url = _get_database_url()
    engine = create_engine(database_url)
    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        print("🔄 Aggiunta campi nome_cliente e cognome_cliente...")

        session.execute(text("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name='interventi' AND column_name='nome_cliente'
                ) THEN
                    ALTER TABLE interventi ADD COLUMN nome_cliente VARCHAR;
                END IF;
            END $$;
        """))

        session.execute(text("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name='interventi' AND column_name='cognome_cliente'
                ) THEN
                    ALTER TABLE interventi ADD COLUMN cognome_cliente VARCHAR;
                END IF;
            END $$;
        """))

        session.commit()
        print("✅ Migrazione completata!")

    except Exception as e:
        session.rollback()
        print(f"❌ Errore migrazione: {e}")
        raise
    finally:
        session.close()


if __name__ == "__main__":
    migrate()
