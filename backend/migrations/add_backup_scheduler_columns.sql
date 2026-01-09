-- Migrazione: Aggiunta colonne scheduler e retention backup alla tabella impostazioni_azienda
-- Data: 2025-01-XX
-- Descrizione: Aggiunge campi per configurazione scheduler e retention backup per locale, NAS e cloud

-- Aggiungi colonne scheduler e retention backup
ALTER TABLE impostazioni_azienda ADD COLUMN IF NOT EXISTS backup_local_keep_count INTEGER DEFAULT 10;
ALTER TABLE impostazioni_azienda ADD COLUMN IF NOT EXISTS backup_local_schedule_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE impostazioni_azienda ADD COLUMN IF NOT EXISTS backup_local_schedule_time VARCHAR DEFAULT '02:00';
ALTER TABLE impostazioni_azienda ADD COLUMN IF NOT EXISTS backup_nas_keep_count INTEGER DEFAULT 10;
ALTER TABLE impostazioni_azienda ADD COLUMN IF NOT EXISTS backup_nas_schedule_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE impostazioni_azienda ADD COLUMN IF NOT EXISTS backup_nas_schedule_time VARCHAR DEFAULT '02:00';
ALTER TABLE impostazioni_azienda ADD COLUMN IF NOT EXISTS backup_cloud_keep_count INTEGER DEFAULT 10;
ALTER TABLE impostazioni_azienda ADD COLUMN IF NOT EXISTS backup_cloud_schedule_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE impostazioni_azienda ADD COLUMN IF NOT EXISTS backup_cloud_schedule_time VARCHAR DEFAULT '02:00';

-- Commenti sulle colonne
COMMENT ON COLUMN impostazioni_azienda.backup_local_keep_count IS 'Numero di backup locali da mantenere';
COMMENT ON COLUMN impostazioni_azienda.backup_local_schedule_enabled IS 'Abilita scheduler backup locale giornaliero';
COMMENT ON COLUMN impostazioni_azienda.backup_local_schedule_time IS 'Orario backup locale giornaliero (HH:MM)';
COMMENT ON COLUMN impostazioni_azienda.backup_nas_keep_count IS 'Numero di backup NAS da mantenere';
COMMENT ON COLUMN impostazioni_azienda.backup_nas_schedule_enabled IS 'Abilita scheduler backup NAS giornaliero';
COMMENT ON COLUMN impostazioni_azienda.backup_nas_schedule_time IS 'Orario backup NAS giornaliero (HH:MM)';
COMMENT ON COLUMN impostazioni_azienda.backup_cloud_keep_count IS 'Numero di backup cloud da mantenere';
COMMENT ON COLUMN impostazioni_azienda.backup_cloud_schedule_enabled IS 'Abilita scheduler backup cloud giornaliero';
COMMENT ON COLUMN impostazioni_azienda.backup_cloud_schedule_time IS 'Orario backup cloud giornaliero (HH:MM)';
