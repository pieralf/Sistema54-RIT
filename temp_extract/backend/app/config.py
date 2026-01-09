from pathlib import Path
import os

# Directory principale del progetto (backend/)
PROJECT_ROOT = Path(__file__).resolve().parents[1]

# Directory di output per i backup (montata dal docker-compose)
BACKUPS_DIR = Path(os.getenv("BACKUPS_DIR", "/app/backups")).resolve()

# Directory uploads (montata dal docker-compose)
UPLOADS_DIR = Path(os.getenv("UPLOADS_DIR", "/app/uploads")).resolve()
