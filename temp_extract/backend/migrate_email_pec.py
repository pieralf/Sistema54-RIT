#!/usr/bin/env python3
"""
Script di migrazione per aggiungere colonna email_pec alla tabella clienti
"""

import sys
import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Configurazione database (usa le stesse credenziali di database.py)
# Prova prima con 'db' (Docker), poi 'localhost' (locale)
db_host = os.getenv("DATABASE_HOST", "db")
DATABASE_URL = f"postgresql://admin:sistema54secure@{db_host}:5432/sistema54_db"

def migrate():
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        print("🔄 Aggiunta colonna email_pec alla tabella clienti...")
        
        # Verifica se la colonna esiste già
        check_column = text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='clienti' AND column_name='email_pec'
        """)
        result = session.execute(check_column).fetchone()
        
        if result:
            print("✅ Colonna 'email_pec' già esistente, skip...")
        else:
            # Aggiungi colonna email_pec
            add_column = text("""
                ALTER TABLE clienti 
                ADD COLUMN email_pec VARCHAR
            """)
            session.execute(add_column)
            session.commit()
            print("✅ Colonna 'email_pec' aggiunta con successo!")
        
        # Aggiungi commento sulla colonna
        try:
            add_comment = text("""
                COMMENT ON COLUMN clienti.email_pec IS 'PEC (Posta Elettronica Certificata) per fatturazione elettronica PA'
            """)
            session.execute(add_comment)
            session.commit()
            print("✅ Commento aggiunto alla colonna")
        except Exception as e:
            print(f"⚠️  Impossibile aggiungere commento (non critico): {e}")
        
        print("✅ Migrazione completata!")
        
    except Exception as e:
        session.rollback()
        print(f"❌ Errore durante la migrazione: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        session.close()

if __name__ == "__main__":
    migrate()


