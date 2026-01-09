"""
Migrazione: Aggiunge il campo deleted_at alle tabelle utenti e interventi per supportare soft delete

Uso:
    # Opzione 1: Eseguire dentro il container Docker (CONSIGLIATO)
    docker-compose -f docker-compose.desktop.prod.namedvol.yml exec backend python /app/migrate_add_soft_delete_utenti_interventi.py
    
    # Opzione 2: Eseguire localmente (se il database è accessibile da localhost)
    python migrate_add_soft_delete_utenti_interventi.py
"""

import os
import sys
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from urllib.parse import urlparse

def migrate():
    # Leggi DATABASE_URL dalle variabili d'ambiente (se disponibile) o usa valori di default
    database_url = os.getenv('DATABASE_URL')
    
    if database_url:
        # Parse DATABASE_URL (formato: postgresql://user:password@host:port/database)
        parsed = urlparse(database_url)
        db_config = {
            'host': parsed.hostname or 'db',
            'port': parsed.port or 5432,
            'database': parsed.path[1:] if parsed.path else 'sistema54_db',
            'user': parsed.username or 'admin',
            'password': parsed.password or 'sistema54secure'
        }
    else:
        # Valori di default per Docker Compose
        # Se eseguito dentro Docker, 'db' è il nome del servizio
        # Se eseguito localmente, usa 'localhost' con la porta esposta
        is_in_docker = os.path.exists('/.dockerenv')
        db_config = {
            'host': os.getenv('DB_HOST', 'db' if is_in_docker else 'localhost'),
            'port': int(os.getenv('DB_PORT', '5432' if is_in_docker else '26201')),  # Porta esposta su host
            'database': os.getenv('POSTGRES_DB', 'sistema54_db'),
            'user': os.getenv('POSTGRES_USER', 'admin'),
            'password': os.getenv('POSTGRES_PASSWORD', 'sistema54secure')
        }
    
    print(f"🔌 Connessione al database: {db_config['user']}@{db_config['host']}:{db_config['port']}/{db_config['database']}")
    
    try:
        conn = psycopg2.connect(**db_config)
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()
    except Exception as e:
        print(f"❌ Errore connessione database: {e}")
        print(f"   Config utilizzata: host={db_config['host']}, port={db_config['port']}, db={db_config['database']}, user={db_config['user']}")
        print("\n💡 Suggerimenti:")
        print("   - Se esegui da host, verifica che la porta del database sia esposta correttamente")
        print("   - Se esegui da Docker, usa: docker-compose exec backend python /app/migrate_add_soft_delete_utenti_interventi.py")
        sys.exit(1)
    
    try:
        print("🔄 Inizio migrazione soft delete per utenti e interventi...")
        
        # 1. Aggiungi deleted_at a utenti se non esiste
        print("📋 Aggiunta campo deleted_at a utenti...")
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='utenti' AND column_name='deleted_at'
        """)
        if not cursor.fetchone():
            cursor.execute("""
                ALTER TABLE utenti 
                ADD COLUMN deleted_at TIMESTAMP NULL;
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_utenti_deleted_at ON utenti(deleted_at);")
            print("✅ Colonna deleted_at aggiunta alla tabella utenti con indice")
        else:
            print("⏭️  Colonna deleted_at già presente in utenti")
        
        # 2. Aggiungi deleted_at a interventi se non esiste
        print("📋 Aggiunta campo deleted_at a interventi...")
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='interventi' AND column_name='deleted_at'
        """)
        if not cursor.fetchone():
            cursor.execute("""
                ALTER TABLE interventi 
                ADD COLUMN deleted_at TIMESTAMP NULL;
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_interventi_deleted_at ON interventi(deleted_at);")
            print("✅ Colonna deleted_at aggiunta alla tabella interventi con indice")
        else:
            print("⏭️  Colonna deleted_at già presente in interventi")
        
        print("✅ Migrazione soft delete completata con successo!")
        
    except Exception as e:
        print(f"❌ Errore durante la migrazione: {e}")
        raise
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    migrate()