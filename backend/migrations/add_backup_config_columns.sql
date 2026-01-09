-- Migrazione: Aggiunta colonne configurazione backup alla tabella impostazioni_azienda
-- Data: 2025-01-XX
-- Descrizione: Aggiunge campi per configurazione backup NAS e Cloud Storage

-- Aggiungi colonne configurazione backup
ALTER TABLE impostazioni_azienda ADD COLUMN IF NOT EXISTS backup_nas_path VARCHAR;
ALTER TABLE impostazioni_azienda ADD COLUMN IF NOT EXISTS backup_nas_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE impostazioni_azienda ADD COLUMN IF NOT EXISTS backup_cloud_provider VARCHAR;
ALTER TABLE impostazioni_azienda ADD COLUMN IF NOT EXISTS backup_cloud_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE impostazioni_azienda ADD COLUMN IF NOT EXISTS backup_local_path VARCHAR;
ALTER TABLE impostazioni_azienda ADD COLUMN IF NOT EXISTS backup_keep_count INTEGER DEFAULT 10;

-- Commenti sulle colonne
COMMENT ON COLUMN impostazioni_azienda.backup_nas_path IS 'Percorso NAS per backup (es: /mnt/nas/backups o \\server\backups)';
COMMENT ON COLUMN impostazioni_azienda.backup_nas_enabled IS 'Abilita backup automatico su NAS';
COMMENT ON COLUMN impostazioni_azienda.backup_cloud_provider IS 'Provider cloud storage: onedrive, gdrive, dropbox';
COMMENT ON COLUMN impostazioni_azienda.backup_cloud_enabled IS 'Abilita backup automatico su cloud storage';
COMMENT ON COLUMN impostazioni_azienda.backup_local_path IS 'Percorso locale per backup (es: C:\Backups\Sistema54 o /home/user/backups)';
COMMENT ON COLUMN impostazioni_azienda.backup_keep_count IS 'Numero di backup da mantenere localmente';

