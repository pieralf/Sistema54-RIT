#!/usr/bin/env python3
"""Migrazione: rendi audit_logs.user_id nullable e FK ON DELETE SET NULL.

Serve per permettere hard-delete utenti mantenendo lo storico audit (snapshot email/nome già presenti).
"""

import os
import sys
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

db_host = os.getenv("DATABASE_HOST", "db")
DATABASE_URL = os.getenv("DATABASE_URL") or f"postgresql://admin:sistema54secure@{db_host}:5432/sistema54_db"

def migrate():
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        print("🔄 Migrazione audit_logs.user_id nullable + ON DELETE SET NULL...")

        # 1) drop FK (nome standard postgres: audit_logs_user_id_fkey). Se diverso, proviamo anche via catalog.
        session.execute(text("""
            DO $$
            DECLARE
                c_name text;
            BEGIN
                SELECT conname INTO c_name
                FROM pg_constraint
                WHERE conrelid = 'audit_logs'::regclass
                  AND contype = 'f'
                  AND pg_get_constraintdef(oid) ILIKE '%(user_id)%'
                LIMIT 1;

                IF c_name IS NOT NULL THEN
                    EXECUTE format('ALTER TABLE audit_logs DROP CONSTRAINT %I', c_name);
                END IF;
            END $$;
        """))

        # 2) make column nullable
        session.execute(text("""
            ALTER TABLE audit_logs
            ALTER COLUMN user_id DROP NOT NULL;
        """))

        # 3) add FK with ON DELETE SET NULL
        session.execute(text("""
            ALTER TABLE audit_logs
            ADD CONSTRAINT audit_logs_user_id_fkey
            FOREIGN KEY (user_id) REFERENCES utenti(id)
            ON DELETE SET NULL;
        """))

        session.commit()
        print("✅ Migrazione audit_logs completata.")
    except Exception as e:
        session.rollback()
        print(f"❌ Errore migrazione audit_logs: {e}")
        sys.exit(1)
    finally:
        session.close()

if __name__ == "__main__":
    migrate()
