-- Migrazione: Aggiunge il campo deleted_at alle tabelle utenti e interventi per supportare soft delete
-- 
-- Uso:
--   1. Dentro il container database:
--      docker-compose -f docker-compose.desktop.prod.namedvol.yml exec db psql -U admin -d sistema54_db -f /path/to/migrate_add_soft_delete.sql
--
--   2. Oppure copiare il contenuto e eseguirlo in pgAdmin o un client PostgreSQL

-- 1. Aggiungi deleted_at a utenti se non esiste
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='utenti' AND column_name='deleted_at'
    ) THEN
        ALTER TABLE utenti ADD COLUMN deleted_at TIMESTAMP NULL;
        CREATE INDEX IF NOT EXISTS idx_utenti_deleted_at ON utenti(deleted_at);
        RAISE NOTICE 'Colonna deleted_at aggiunta alla tabella utenti con indice';
    ELSE
        RAISE NOTICE 'Colonna deleted_at già presente in utenti';
    END IF;
END $$;

-- 2. Aggiungi deleted_at a interventi se non esiste
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='interventi' AND column_name='deleted_at'
    ) THEN
        ALTER TABLE interventi ADD COLUMN deleted_at TIMESTAMP NULL;
        CREATE INDEX IF NOT EXISTS idx_interventi_deleted_at ON interventi(deleted_at);
        RAISE NOTICE 'Colonna deleted_at aggiunta alla tabella interventi con indice';
    ELSE
        RAISE NOTICE 'Colonna deleted_at già presente in interventi';
    END IF;
END $$;

-- Verifica che le colonne siano state aggiunte
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name IN ('utenti', 'interventi') 
    AND column_name = 'deleted_at'
ORDER BY table_name;
