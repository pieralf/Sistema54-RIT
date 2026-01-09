#!/usr/bin/env python3
"""Migrazione: aggiunge supporto inviti/reset password

- aggiunge colonna utenti.must_change_password (se mancante)
- crea tabella password_reset_tokens (se mancante)
"""

import os, sys
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

db_host = os.getenv("DATABASE_HOST", "db")
DATABASE_URL = os.getenv("DATABASE_URL") or f"postgresql://admin:sistema54secure@{db_host}:5432/sistema54_db"

def migrate():
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        print("🔄 Migrazione inviti/reset: must_change_password + password_reset_tokens...")

        session.execute(text("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name='utenti' AND column_name='must_change_password'
            ) THEN
                ALTER TABLE utenti ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
            END IF;
        END $$;
        """))

        session.execute(text("""
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES utenti(id) ON DELETE CASCADE,
            token_hash TEXT UNIQUE NOT NULL,
            purpose TEXT NOT NULL DEFAULT 'invite',
            expires_at TIMESTAMPTZ NOT NULL,
            used_at TIMESTAMPTZ NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        """))
        session.execute(text("CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);"))
        session.execute(text("CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);"))

        session.commit()
        print("✅ Migrazione inviti/reset completata.")
    except Exception as e:
        session.rollback()
        print(f"❌ Errore migrazione inviti/reset: {e}")
        sys.exit(1)
    finally:
        session.close()

if __name__ == "__main__":
    migrate()
