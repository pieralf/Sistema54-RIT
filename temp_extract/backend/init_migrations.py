#!/usr/bin/env python3
"""
Runner unico delle migrazioni "manuali" (migrate_*.py) + bootstrap schema iniziale.

- Crea (se mancano) le tabelle base dai modelli SQLAlchemy (Base.metadata.create_all)
- Applica in sequenza deterministica tutti gli script migrate_*.py
- Registra le migrazioni applicate in tabella schema_migrations
- Se una migrazione fallisce: termina con errore (il container non deve partire in stato incoerente)
"""
import os
import sys
import importlib.util

from pathlib import Path
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.orm import sessionmaker



BASE_DIR = Path(__file__).resolve().parent
DATABASE_URL = os.getenv("DATABASE_URL")

def _load_module_from_path(py_file: Path):
    spec = importlib.util.spec_from_file_location(py_file.stem, str(py_file))
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module

def ensure_migrations_table(session):
    session.execute(text("""
        CREATE TABLE IF NOT EXISTS schema_migrations (
            id SERIAL PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    """))
    session.commit()

def is_applied(session, name: str) -> bool:
    res = session.execute(
        text("SELECT 1 FROM schema_migrations WHERE name = :name LIMIT 1"),
        {"name": name},
    ).fetchone()
    return res is not None

def mark_applied(session, name: str):
    session.execute(
        text("""
            INSERT INTO schema_migrations (name, applied_at)
            VALUES (:name, NOW())
            ON CONFLICT (name) DO NOTHING
        """),
        {"name": name},
    )
    session.commit()

def bootstrap_schema():
    """
    Crea le tabelle base dai modelli ORM (idempotente).
    Serve per DB nuovo/vergine: le migrate_*.py fanno ALTER TABLE e fallirebbero se le tabelle non esistono.
    """
    if not DATABASE_URL:
        print("❌ DATABASE_URL non impostata.")
        sys.exit(1)

    # Assicura che i moduli app.* vedano la stessa DATABASE_URL
    os.environ["DATABASE_URL"] = DATABASE_URL

    # Importa Base e modelli per registrare le tabelle
    sys.path.insert(0, str(BASE_DIR))  # per importare app/*
    from app.database import Base, engine  # noqa
    import app.models  # noqa: F401  (import necessario per registrare i modelli)

    print("🧱 Bootstrap schema: creazione tabelle base (se mancanti)...")
    Base.metadata.create_all(bind=engine)
    print("✅ Bootstrap schema completato.")

def run():
    if not DATABASE_URL:
        print("❌ DATABASE_URL non impostata.")
        sys.exit(1)

    # 1) Bootstrap schema base
    bootstrap_schema()

    # 2) Avvia sessione per tracking schema_migrations
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        ensure_migrations_table(session)

        migration_files = sorted(BASE_DIR.glob("migrate_*.py"))
        if not migration_files:
            print("ℹ️ Nessun migrate_*.py trovato, niente da fare.")
            return

        print(f"🔄 Migrazioni trovate: {len(migration_files)}")

        for py_file in migration_files:
            name = py_file.name

            if is_applied(session, name):
                print(f"✅ Skip (già applicata): {name}")
                continue

            print(f"▶️ Applico: {name}")
            mod = _load_module_from_path(py_file)

            if not hasattr(mod, "migrate"):
                raise RuntimeError(f"{name} non espone una funzione migrate()")

            mod.migrate()

            mark_applied(session, name)
            print(f"✅ OK: {name}")

        print("✅ Tutte le migrazioni completate.")
    finally:
        session.close()

if __name__ == "__main__":
    run()
