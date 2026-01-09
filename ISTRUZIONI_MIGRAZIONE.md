# Istruzioni per eseguire la migrazione Soft Delete

La migrazione aggiunge il campo `deleted_at` alle tabelle `utenti` e `interventi` per supportare il soft delete.

## Metodo 1: Esecuzione dentro il container Docker (CONSIGLIATO)

### Passo 1: Avvia i container Docker
```powershell
cd C:\Progetti\Sistema54-RIT
docker-compose -f docker-compose.desktop.prod.namedvol.yml up -d
```

### Passo 2: Esegui la migrazione Python (metodo A)
```powershell
docker-compose -f docker-compose.desktop.prod.namedvol.yml exec backend python /app/migrate_add_soft_delete_utenti_interventi.py
```

### Passo 2 Alternativo: Esegui la migrazione SQL (metodo B)
Prima copia il file SQL nel container, poi eseguilo:
```powershell
# Copia il file SQL nel container database
docker cp backend/migrate_add_soft_delete.sql sistema54-rit-db-1:/tmp/migrate.sql

# Esegui la migrazione
docker-compose -f docker-compose.desktop.prod.namedvol.yml exec db psql -U admin -d sistema54_db -f /tmp/migrate.sql

# Oppure esegui direttamente SQL
docker-compose -f docker-compose.desktop.prod.namedvol.yml exec db psql -U admin -d sistema54_db -c "ALTER TABLE utenti ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL; CREATE INDEX IF NOT EXISTS idx_utenti_deleted_at ON utenti(deleted_at);"
docker-compose -f docker-compose.desktop.prod.namedvol.yml exec db psql -U admin -d sistema54_db -c "ALTER TABLE interventi ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL; CREATE INDEX IF NOT EXISTS idx_interventi_deleted_at ON interventi(deleted_at);"
```

## Metodo 2: Esecuzione locale (se il database è accessibile)

Se hai Python e psycopg2 installati localmente e il database è accessibile dalla macchina host:

```powershell
# Installa psycopg2 se non lo hai
pip install psycopg2-binary

# Esegui lo script (deve essere nella cartella backend)
cd C:\Progetti\Sistema54-RIT\backend
python migrate_add_soft_delete_utenti_interventi.py
```

**Nota:** Se esegui localmente, lo script userà:
- Host: `localhost`
- Porta: `26201` (porta esposta dal container)
- Database: `sistema54_db`
- User: `admin`
- Password: `sistema54secure`

Se le tue credenziali sono diverse, puoi impostare variabili d'ambiente:
```powershell
$env:POSTGRES_USER = "admin"
$env:POSTGRES_PASSWORD = "sistema54secure"
$env:POSTGRES_DB = "sistema54_db"
$env:DB_PORT = "26201"
python migrate_add_soft_delete_utenti_interventi.py
```

## Metodo 3: Usando pgAdmin

1. Accedi a pgAdmin (di solito su http://localhost:26151)
2. Connettiti al database `sistema54_db`
3. Apri Query Tool
4. Copia e incolla il contenuto di `backend/migrate_add_soft_delete.sql`
5. Esegui la query

## Verifica della migrazione

Dopo l'esecuzione, verifica che le colonne siano state aggiunte:

```powershell
docker-compose -f docker-compose.desktop.prod.namedvol.yml exec db psql -U admin -d sistema54_db -c "SELECT table_name, column_name FROM information_schema.columns WHERE table_name IN ('utenti', 'interventi') AND column_name = 'deleted_at';"
```

Dovresti vedere:
```
 table_name | column_name
------------+-------------
 utenti     | deleted_at
 interventi | deleted_at
```

## Risoluzione problemi

### Errore: "service backend is not running"
Assicurati che i container siano avviati:
```powershell
docker-compose -f docker-compose.desktop.prod.namedvol.yml up -d
```

### Errore di connessione al database
Verifica che il database sia accessibile:
```powershell
docker-compose -f docker-compose.desktop.prod.namedvol.yml exec db psql -U admin -d sistema54_db -c "SELECT version();"
```

### Errore: "column already exists"
Non è un problema, significa che la migrazione è già stata eseguita. Lo script è idempotente e può essere eseguito più volte senza problemi.
