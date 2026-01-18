#!/usr/bin/env python3
"""
Migrazione per ampliare la gestione DDT:
- Aggiunge campo tipo_ddt (ingresso/uscita)
- Aggiunge campo ddt_ingresso_id (per collegare DDT uscita al DDT ingresso)
- Aggiunge campo in_attesa_cliente (flag sospensione)
- Aggiunge campo note_lavoro (note sul lavoro eseguito)
- Aggiunge campo ricambi_utilizzati (JSONB array)
- Aggiunge campo costi_extra (Numeric)
- Aggiunge campo descrizione_extra (Text)
- Aggiorna stati possibili: aggiunge riparato, respinto, in_attesa_cliente
"""
import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

from sqlalchemy import create_engine, text, inspect
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
    """Esegue la migrazione"""
    db_url = _get_database_url()
    engine = create_engine(db_url)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        print("🔄 Migrazione ampliamento DDT...")
        
        inspector = inspect(engine)
        columns = [col['name'] for col in inspector.get_columns('ritiri_prodotti')]
        
        # 1. Aggiungi tipo_ddt
        if 'tipo_ddt' not in columns:
            print("Aggiungo colonna tipo_ddt...")
            session.execute(text("ALTER TABLE ritiri_prodotti ADD COLUMN tipo_ddt VARCHAR DEFAULT 'ingresso' NOT NULL"))
            session.commit()
            print("✅ Colonna tipo_ddt aggiunta")
        else:
            print("⏭️ Colonna tipo_ddt già esistente")
        
        # 2. Aggiungi ddt_ingresso_id
        if 'ddt_ingresso_id' not in columns:
            print("Aggiungo colonna ddt_ingresso_id...")
            session.execute(text("ALTER TABLE ritiri_prodotti ADD COLUMN ddt_ingresso_id INTEGER REFERENCES ritiri_prodotti(id)"))
            session.commit()
            print("✅ Colonna ddt_ingresso_id aggiunta")
        else:
            print("⏭️ Colonna ddt_ingresso_id già esistente")
        
        # 3. Aggiungi in_attesa_cliente
        if 'in_attesa_cliente' not in columns:
            print("Aggiungo colonna in_attesa_cliente...")
            session.execute(text("ALTER TABLE ritiri_prodotti ADD COLUMN in_attesa_cliente BOOLEAN DEFAULT FALSE NOT NULL"))
            session.commit()
            print("✅ Colonna in_attesa_cliente aggiunta")
        else:
            print("⏭️ Colonna in_attesa_cliente già esistente")
        
        # 4. Aggiungi note_lavoro
        if 'note_lavoro' not in columns:
            print("Aggiungo colonna note_lavoro...")
            session.execute(text("ALTER TABLE ritiri_prodotti ADD COLUMN note_lavoro TEXT"))
            session.commit()
            print("✅ Colonna note_lavoro aggiunta")
        else:
            print("⏭️ Colonna note_lavoro già esistente")
        
        # 5. Aggiungi ricambi_utilizzati
        if 'ricambi_utilizzati' not in columns:
            print("Aggiungo colonna ricambi_utilizzati...")
            session.execute(text("ALTER TABLE ritiri_prodotti ADD COLUMN ricambi_utilizzati JSONB DEFAULT '[]'::jsonb"))
            session.commit()
            print("✅ Colonna ricambi_utilizzati aggiunta")
        else:
            print("⏭️ Colonna ricambi_utilizzati già esistente")
        
        # 6. Aggiungi costi_extra
        if 'costi_extra' not in columns:
            print("Aggiungo colonna costi_extra...")
            session.execute(text("ALTER TABLE ritiri_prodotti ADD COLUMN costi_extra NUMERIC(10,2) DEFAULT 0 NOT NULL"))
            session.commit()
            print("✅ Colonna costi_extra aggiunta")
        else:
            print("⏭️ Colonna costi_extra già esistente")
        
        # 7. Aggiungi descrizione_extra
        if 'descrizione_extra' not in columns:
            print("Aggiungo colonna descrizione_extra...")
            session.execute(text("ALTER TABLE ritiri_prodotti ADD COLUMN descrizione_extra TEXT"))
            session.commit()
            print("✅ Colonna descrizione_extra aggiunta")
        else:
            print("⏭️ Colonna descrizione_extra già esistente")
        
        print("✅ Migrazione completata con successo!")
        
    except Exception as e:
        session.rollback()
        print(f"❌ Errore durante la migrazione: {e}")
        raise
    finally:
        session.close()

if __name__ == "__main__":
    migrate()
