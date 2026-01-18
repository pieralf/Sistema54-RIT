#!/usr/bin/env python3
"""
Migrazione per aggiungere supporto a più prodotti nello stesso DDT:
- Aggiunge campo prodotti (JSONB) per array di prodotti
- Mantiene i campi esistenti per retrocompatibilità
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
        db_host = os.getenv("DB_HOST", "localhost")
        db_name = os.getenv("DB_NAME", "sistema54")
        db_user = os.getenv("DB_USER", "postgres")
        db_pass = os.getenv("DB_PASSWORD", "postgres")
        return f"postgresql://{db_user}:{db_pass}@{db_host}:5432/{db_name}"
    return db_url

def migrate():
    """Esegue la migrazione"""
    db_url = _get_database_url()
    engine = create_engine(db_url)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        print("🔄 Aggiungo campo prodotti (JSONB) per supportare più prodotti nello stesso DDT...")
        
        # Verifica se il campo esiste già
        check_query = text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'ritiri_prodotti' 
            AND column_name = 'prodotti'
        """)
        result = session.execute(check_query).fetchone()
        
        if not result:
            # Aggiungi campo prodotti (JSONB array)
            session.execute(text("""
                ALTER TABLE ritiri_prodotti
                ADD COLUMN prodotti JSONB DEFAULT '[]'::jsonb;
            """))
            session.commit()
            print("✅ Campo prodotti aggiunto a ritiri_prodotti.")
            
            # Migra i dati esistenti: converte i campi singoli in un array con un prodotto
            print("🔄 Migro dati esistenti...")
            session.execute(text("""
                UPDATE ritiri_prodotti
                SET prodotti = jsonb_build_array(
                    jsonb_build_object(
                        'tipo_prodotto', tipo_prodotto,
                        'marca', marca,
                        'modello', modello,
                        'serial_number', serial_number,
                        'descrizione_prodotto', descrizione_prodotto,
                        'difetto_segnalato', difetto_segnalato,
                        'difetto_appurato', difetto_appurato,
                        'foto_prodotto', COALESCE(foto_prodotto, '[]'::jsonb)
                    )
                )
                WHERE prodotti = '[]'::jsonb OR prodotti IS NULL;
            """))
            session.commit()
            print("✅ Dati esistenti migrati.")
        else:
            print("✅ Campo prodotti già presente in ritiri_prodotti.")
        
    except Exception as e:
        session.rollback()
        print(f"❌ Errore durante la migrazione: {e}")
        raise
    finally:
        session.close()

if __name__ == "__main__":
    migrate()
