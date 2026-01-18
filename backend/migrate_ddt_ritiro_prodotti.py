#!/usr/bin/env python3
"""
Migrazione per aggiungere supporto DDT (Ritiro Prodotti):
- Crea tabella ritiri_prodotti (viene creata automaticamente da SQLAlchemy)
- Aggiunge campi configurazione alert DDT a impostazioni_azienda
"""
import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

def _get_database_url() -> str:
    """Ottiene DATABASE_URL dalle variabili d'ambiente"""
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        # Fallback: prova a costruire da variabili separate (per compatibilità)
        db_host = os.getenv("DB_HOST", "localhost")
        db_name = os.getenv("DB_NAME", "sistema54")
        db_user = os.getenv("DB_USER", "postgres")
        db_pass = os.getenv("DB_PASSWORD", "postgres")
        return f"postgresql://{db_user}:{db_pass}@{db_host}:5432/{db_name}"
    return db_url

def migrate():
    """Aggiunge campi configurazione alert DDT a impostazioni_azienda"""
    db_url = _get_database_url()
    engine = create_engine(db_url)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        print("🔄 Aggiungo campi configurazione alert DDT a impostazioni_azienda...")
        
        # Verifica se i campi esistono già
        check_query = text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'impostazioni_azienda' 
            AND column_name = 'email_responsabile_ddt'
        """)
        result = session.execute(check_query).fetchone()
        
        if not result:
            # Aggiungi campi configurazione alert DDT
            session.execute(text("""
                ALTER TABLE impostazioni_azienda
                ADD COLUMN IF NOT EXISTS email_responsabile_ddt VARCHAR,
                ADD COLUMN IF NOT EXISTS ddt_alert_giorni_1 INTEGER DEFAULT 30,
                ADD COLUMN IF NOT EXISTS ddt_alert_giorni_2 INTEGER DEFAULT 60,
                ADD COLUMN IF NOT EXISTS ddt_alert_giorni_3 INTEGER DEFAULT 90,
                ADD COLUMN IF NOT EXISTS ddt_alert_abilitato BOOLEAN DEFAULT TRUE
            """))
            session.commit()
            print("✅ Campi configurazione alert DDT aggiunti.")
        else:
            print("✅ Campi configurazione alert DDT già presenti.")
        
        # La tabella ritiri_prodotti viene creata automaticamente da SQLAlchemy
        # tramite Base.metadata.create_all() in init_migrations.py
        
    except Exception as e:
        session.rollback()
        print(f"❌ Errore durante la migrazione: {e}")
        raise
    finally:
        session.close()

if __name__ == "__main__":
    migrate()
