#!/usr/bin/env python3
"""
Script di inizializzazione database
Esegue automaticamente le migrazioni necessarie all'avvio
"""

import os
import sys
from pathlib import Path

# Aggiungi il percorso dello script al PYTHONPATH
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Configurazione database
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://admin:sistema54secure@db:5432/sistema54_db")

def run_migrations():
    """Esegue tutte le migrazioni necessarie"""
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        print("🔄 Verifica migrazioni database...")
        
        # Migrazione email_pec
        check_column = text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='clienti' AND column_name='email_pec'
        """)
        result = session.execute(check_column).fetchone()
        
        if not result:
            print("📋 Aggiunta colonna email_pec...")
            add_column = text("ALTER TABLE clienti ADD COLUMN email_pec VARCHAR")
            session.execute(add_column)
            session.commit()
            print("✅ Colonna email_pec aggiunta")
        else:
            print("✅ Colonna email_pec già presente")
        
        print("✅ Migrazioni completate")
        
    except Exception as e:
        print(f"⚠️  Errore durante le migrazioni (non critico): {e}")
        session.rollback()
    finally:
        session.close()

if __name__ == "__main__":
    run_migrations()


