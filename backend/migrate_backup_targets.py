#!/usr/bin/env python3
"""Migrazione: crea tabella backup_targets per destinazioni backup (cloud/lan).

Tabella semplice con configurazione JSONB (token OAuth rclone / credenziali SMB).
"""

import os
import sys

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker


db_host = os.getenv("DATABASE_HOST", "db")
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"postgresql://admin:sistema54secure@{db_host}:5432/sistema54_db",
)


def migrate():
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        session.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS backup_targets (
                    id SERIAL PRIMARY KEY,
                    name TEXT UNIQUE NOT NULL,
                    kind TEXT NOT NULL,
                    remote_path TEXT,
                    config JSONB NOT NULL DEFAULT '{}'::jsonb,
                    enabled BOOLEAN NOT NULL DEFAULT TRUE,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );

                CREATE INDEX IF NOT EXISTS ix_backup_targets_name ON backup_targets (name);
                CREATE INDEX IF NOT EXISTS ix_backup_targets_kind ON backup_targets (kind);
                """
            )
        )
        session.commit()
        print("✅ Migrazione backup_targets completata")
    except Exception as e:
        session.rollback()
        print(f"❌ Errore migrazione backup_targets: {e}")
        sys.exit(1)
    finally:
        session.close()


if __name__ == "__main__":
    migrate()
