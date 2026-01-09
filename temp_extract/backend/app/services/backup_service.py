import json
import os
import re
import shutil
import subprocess
import tarfile
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from ..config import BACKUPS_DIR, UPLOADS_DIR

# ----------------------------
# Paths & helpers
# ----------------------------

STATUS_FILE = BACKUPS_DIR / "backup_status.json"
RCLONE_DIR = Path(os.getenv("RCLONE_DIR", "/app/rclone")).resolve()
RCLONE_CONFIG = RCLONE_DIR / "rclone.conf"

BACKUP_NAME_RE = re.compile(r"^[a-zA-Z0-9._\-]+\.(tar\.gz|tgz|zip)$")


def _ensure_dirs():
    BACKUPS_DIR.mkdir(parents=True, exist_ok=True)
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    RCLONE_DIR.mkdir(parents=True, exist_ok=True)


def _write_status(status: str, progress: int, message: str, extra: Optional[Dict[str, Any]] = None):
    payload: Dict[str, Any] = {
        "status": status,
        "progress": progress,
        "message": message,
        "updated_at": datetime.utcnow().isoformat() + "Z",
    }
    if extra:
        payload.update(extra)
    _ensure_dirs()
    STATUS_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _read_status() -> Dict[str, Any]:
    try:
        return json.loads(STATUS_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {"status": "idle", "progress": 0, "message": "Nessun backup in esecuzione"}


def _safe_backup_id(name: str) -> str:
    if not name or not BACKUP_NAME_RE.match(name):
        raise FileNotFoundError("Backup non valido")
    # Avoid traversal
    if ".." in name or name.startswith("/") or name.startswith("\\"):
        raise FileNotFoundError("Backup non valido")
    return name


def _db_url() -> str:
    url = os.getenv("DATABASE_URL")
    if url:
        return url
    host = os.getenv("DATABASE_HOST", "db")
    return f"postgresql://admin:sistema54secure@{host}:5432/sistema54_db"


def _run(cmd: List[str], env: Optional[Dict[str, str]] = None):
    p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env=env)
    if p.returncode != 0:
        raise RuntimeError(f"Comando fallito: {' '.join(cmd)}\nSTDOUT: {p.stdout}\nSTDERR: {p.stderr}")
    return p.stdout


# ----------------------------
# Rclone config (providers)
# ----------------------------


def build_rclone_conf(targets: List[Dict[str, Any]]):
    """Genera rclone.conf a partire dalla lista targets (DB).

    targets: [{name, kind, remote_path, config}, ...]

    NOTE: per OneDrive/GoogleDrive/Dropbox serve token JSON generato con rclone authorize
    (puoi farlo su una macchina qualsiasi) e incollarlo nella UI.
    """
    _ensure_dirs()

    lines: List[str] = []
    for t in targets:
        if not t.get("enabled", True):
            continue
        name = t["name"].strip()
        kind = t["kind"].strip()
        cfg = t.get("config") or {}

        # section name must be safe
        section = re.sub(r"[^a-zA-Z0-9_-]", "_", name)
        lines.append(f"[{section}]")

        if kind == "gdrive":
            lines.append("type = drive")
            if cfg.get("client_id"):
                lines.append(f"client_id = {cfg['client_id']}")
            if cfg.get("client_secret"):
                lines.append(f"client_secret = {cfg['client_secret']}")
            if cfg.get("token"):
                lines.append(f"token = {cfg['token']}")

        elif kind == "onedrive":
            lines.append("type = onedrive")
            if cfg.get("client_id"):
                lines.append(f"client_id = {cfg['client_id']}")
            if cfg.get("client_secret"):
                lines.append(f"client_secret = {cfg['client_secret']}")
            if cfg.get("token"):
                lines.append(f"token = {cfg['token']}")
            if cfg.get("drive_id"):
                lines.append(f"drive_id = {cfg['drive_id']}")
            if cfg.get("drive_type"):
                lines.append(f"drive_type = {cfg['drive_type']}")

        elif kind == "dropbox":
            lines.append("type = dropbox")
            if cfg.get("client_id"):
                lines.append(f"client_id = {cfg['client_id']}")
            if cfg.get("client_secret"):
                lines.append(f"client_secret = {cfg['client_secret']}")
            if cfg.get("token"):
                lines.append(f"token = {cfg['token']}")

        elif kind == "smb":
            lines.append("type = smb")
            # required: host & user/pass optional
            for k in ["host", "user", "pass", "domain", "port"]:
                if cfg.get(k) is not None and cfg.get(k) != "":
                    lines.append(f"{k} = {cfg[k]}")

        else:
            # unsupported
            lines.append(f"type = {kind}")
            for k, v in cfg.items():
                lines.append(f"{k} = {v}")

        lines.append("")

    RCLONE_CONFIG.write_text("\n".join(lines), encoding="utf-8")


def rclone_copy_to_target(local_file: Path, target: Dict[str, Any]):
    """Copia un file backup verso la destinazione target usando rclone."""
    _ensure_dirs()

    section = re.sub(r"[^a-zA-Z0-9_-]", "_", target["name"].strip())
    remote_path = (target.get("remote_path") or "").strip().lstrip("/")

    # Destination: <remote>:/path
    dest = f"{section}:{remote_path}" if remote_path else f"{section}:"

    _run([
        "rclone",
        "--config",
        str(RCLONE_CONFIG),
        "copyto",
        str(local_file),
        f"{dest}/{local_file.name}",
        "--checksum",
        "--transfers",
        "2",
    ])


def rclone_copy_from_target(target: Dict[str, Any], filename: str, dest_dir: Path) -> Path:
    """Scarica un file backup dalla destinazione target verso dest_dir."""
    _ensure_dirs()

    section = re.sub(r"[^a-zA-Z0-9_-]", "_", target["name"].strip())
    remote_path = (target.get("remote_path") or "").strip().lstrip("/")
    src = f"{section}:{remote_path}" if remote_path else f"{section}:"

    dest_dir.mkdir(parents=True, exist_ok=True)
    out = dest_dir / filename

    _run([
        "rclone",
        "--config",
        str(RCLONE_CONFIG),
        "copyto",
        f"{src}/{filename}",
        str(out),
        "--checksum",
        "--transfers",
        "2",
    ])
    return out


def rclone_list(target: Dict[str, Any]) -> List[str]:
    _ensure_dirs()
    section = re.sub(r"[^a-zA-Z0-9_-]", "_", target["name"].strip())
    remote_path = (target.get("remote_path") or "").strip().lstrip("/")
    src = f"{section}:{remote_path}" if remote_path else f"{section}:"

    out = _run([
        "rclone",
        "--config",
        str(RCLONE_CONFIG),
        "lsf",
        src,
        "--files-only",
    ])
    return [line.strip() for line in out.splitlines() if line.strip()]


# ----------------------------
# Public API used by routers
# ----------------------------


def list_backups() -> List[Dict[str, Any]]:
    _ensure_dirs()
    backups: List[Dict[str, Any]] = []
    patterns = ["*.tar.gz", "*.tgz", "*.zip"]
    for pat in patterns:
        for p in BACKUPS_DIR.glob(pat):
            try:
                stat = p.stat()
            except FileNotFoundError:
                continue
            size_bytes = stat.st_size
            size_mb = round(size_bytes / (1024 * 1024), 2)
            created_dt = datetime.fromtimestamp(stat.st_mtime)
            backups.append(
                {
                    "id": p.name,
                    "filename": p.name,
                    "path": str(p),
                    "size_mb": size_mb,
                    "size_bytes": size_bytes,
                    "created_at": created_dt.isoformat(),
                    "created_at_readable": created_dt.strftime("%d/%m/%Y %H:%M"),
                }
            )
    backups.sort(key=lambda x: x["created_at"], reverse=True)
    return backups


def get_backup_info(backup_id: str) -> Optional[Dict[str, Any]]:
    _ensure_dirs()
    backup_id = _safe_backup_id(backup_id)
    p = BACKUPS_DIR / backup_id
    if not p.exists():
        return None
    stat = p.stat()
    size_bytes = stat.st_size
    size_mb = round(size_bytes / (1024 * 1024), 2)
    created_dt = datetime.fromtimestamp(stat.st_mtime)
    return {
        "id": p.name,
        "filename": p.name,
        "path": str(p),
        "size_mb": size_mb,
        "size_bytes": size_bytes,
        "created_at": created_dt.isoformat(),
        "created_at_readable": created_dt.strftime("%d/%m/%Y %H:%M"),
    }



def get_backup_status() -> Dict[str, Any]:
    return _read_status()


def create_backup(background: bool = False, db: Optional[Session] = None, target_ids: Optional[List[int]] = None):
    """Crea backup locale.

    - Sempre salva su BACKUPS_DIR.
    - Se target_ids è valorizzato, carica le destinazioni dal DB e fa upload via rclone.
    """
    _ensure_dirs()

    if background:
        # In questo progetto l'endpoint usa già BackgroundTasks ma qui restiamo sync.
        pass

    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    backup_name = f"sistema54_complete_backup_{ts}.tar.gz"
    out_file = BACKUPS_DIR / backup_name

    _write_status("running", 0, "Inizio backup...")

    try:
        # 1) DB dump
        _write_status("running", 10, "Dump database in corso...")
        db_dump_path = Path(tempfile.mkdtemp()) / "db.dump"

        # Use pg_dump custom format
        _run([
            "pg_dump",
            "-Fc",
            "-f",
            str(db_dump_path),
            _db_url(),
        ], env=os.environ.copy())

        # 2) Uploads archive
        _write_status("running", 40, "Compressione uploads...")
        uploads_tar = Path(tempfile.mkdtemp()) / "uploads.tar.gz"
        with tarfile.open(uploads_tar, "w:gz") as tar:
            if UPLOADS_DIR.exists():
                tar.add(str(UPLOADS_DIR), arcname="uploads")

        # 3) Settings export (best effort)
        _write_status("running", 60, "Esportazione impostazioni...")
        settings_json = {}
        try:
            if db is not None:
                res = db.execute(text("SELECT * FROM impostazioni_azienda ORDER BY id ASC LIMIT 1")).mappings().first()
                settings_json = dict(res) if res else {}
            else:
                eng = create_engine(_db_url())
                with eng.connect() as conn:
                    res = conn.execute(text("SELECT * FROM impostazioni_azienda ORDER BY id ASC LIMIT 1")).mappings().first()
                    settings_json = dict(res) if res else {}
        except Exception:
            settings_json = {}

        manifest = {
            "created_at": datetime.utcnow().isoformat() + "Z",
            "kind": "full",
            "files": ["db.dump", "uploads.tar.gz", "settings.json", "manifest.json"],
        }

        # 4) Final tar.gz
        _write_status("running", 80, "Creazione archivio finale...")
        with tarfile.open(out_file, "w:gz") as tar:
            tar.add(str(db_dump_path), arcname="db.dump")
            tar.add(str(uploads_tar), arcname="uploads.tar.gz")

            tmp_settings = Path(tempfile.mkdtemp())
            (tmp_settings / "settings.json").write_text(json.dumps(settings_json, ensure_ascii=False, default=str, indent=2), encoding="utf-8")
            (tmp_settings / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
            tar.add(str(tmp_settings / "settings.json"), arcname="settings.json")
            tar.add(str(tmp_settings / "manifest.json"), arcname="manifest.json")

        _write_status("running", 90, "Pulizia e finalizzazione...")

        # 5) Optional upload to targets
        uploaded: List[str] = []
        if target_ids and db is not None:
            from .. import models  # local import to avoid cycles

            targets = (
                db.query(models.BackupTarget)
                .filter(models.BackupTarget.id.in_(target_ids))
                .all()
            )
            build_rclone_conf(
                [
                    {
                        "name": t.name,
                        "kind": t.kind,
                        "remote_path": t.remote_path,
                        "config": t.config,
                        "enabled": t.enabled,
                    }
                    for t in targets
                ]
            )
            for t in targets:
                if not t.enabled:
                    continue
                _write_status("running", 92, f"Upload su {t.name}...")
                rclone_copy_to_target(out_file, {"name": t.name, "kind": t.kind, "remote_path": t.remote_path, "config": t.config, "enabled": t.enabled})
                uploaded.append(t.name)

        _write_status("success", 100, "Backup completato", {"backup_id": backup_name, "uploaded_to": uploaded})
        return {"status": "started", "pid": None, "message": "Backup avviato", "output": None, "backup_id": backup_name}

    except Exception as e:
        _write_status("error", 0, f"Errore backup: {e}")
        raise


def delete_backup(backup_id: str):
    _ensure_dirs()
    backup_id = _safe_backup_id(backup_id)
    p = BACKUPS_DIR / backup_id
    if not p.exists():
        raise FileNotFoundError("Backup non trovato")
    p.unlink()


def restore_backup(backup_id: str, restore_type: str = "full") -> Dict[str, Any]:
    """Ripristino da backup locale."""
    _ensure_dirs()
    backup_id = _safe_backup_id(backup_id)
    p = BACKUPS_DIR / backup_id
    if not p.exists():
        raise FileNotFoundError("Backup non trovato")

    _write_status("running", 0, "Avvio ripristino...")

    restore_type = restore_type or "full"
    restore_type = restore_type.lower()

    try:
        with tempfile.TemporaryDirectory() as td:
            temp_dir = Path(td)
            tmp = temp_dir

            _write_status("running", 10, "Estrazione archivio...")
            with tarfile.open(p, "r:gz") as tar:
                tar.extractall(tmp)

            db_dump = tmp / "db.dump"
            uploads_tar = tmp / "uploads.tar.gz"

            if restore_type in ("full", "database", "db"):
                _write_status("running", 40, "Ripristino database...")

                # Best-effort: terminate other connections to reduce locking during restore.
                # In some deployments the DB user may not have privileges (pg_signal_backend).
                try:
                    eng = create_engine(_db_url())
                    with eng.connect() as conn:
                        conn.execute(text(
                            "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
                            "WHERE datname = current_database() AND pid <> pg_backend_pid();"
                        ))
                        conn.commit()
                except Exception as _e:
                    logger.warning("Impossibile terminare connessioni DB (procedo comunque): %s", _e)

                _run([
                    "pg_restore",
                    "--clean",
                    "--if-exists",
                    "--no-owner",
                    "--dbname",
                    _db_url(),
                    str(db_dump),
                ])

            if restore_type in ("full", "volumes", "uploads"):
                _write_status("running", 70, "Ripristino uploads...")

                # ⚠️ IMPORTANT:
                # In Docker, /app/uploads is often a mounted volume/bind.
                # Deleting the directory itself can fail with:
                #   [Errno 16] Device or resource busy: '/app/uploads'
                # So we only delete its *contents*, keeping the mount point.

                UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

                # Extract uploads archive to a temp folder first
                uploads_extract_dir = temp_dir / "uploads_extracted"
                uploads_extract_dir.mkdir(parents=True, exist_ok=True)
                with tarfile.open(uploads_tar, "r:gz") as tar:
                    tar.extractall(uploads_extract_dir)

                # Some archives contain a top-level "uploads/" folder
                src_uploads = uploads_extract_dir / "uploads"
                if not src_uploads.exists():
                    src_uploads = uploads_extract_dir

                # Clear existing uploads content
                for item in UPLOADS_DIR.iterdir():
                    try:
                        if item.is_dir():
                            shutil.rmtree(item)
                        else:
                            item.unlink()
                    except FileNotFoundError:
                        pass

                # Copy restored uploads into place
                for item in src_uploads.iterdir():
                    dst = UPLOADS_DIR / item.name
                    if item.is_dir():
                        shutil.copytree(item, dst, dirs_exist_ok=True)
                    else:
                        shutil.copy2(item, dst)

            _write_status("success", 100, "Ripristino completato")
            # Must match schemas.BackupRestoreResponse
            return {"status": "completed", "pid": None, "message": "Ripristino completato"}

    except Exception as e:
        _write_status("error", 0, f"Errore ripristino: {e}")
        raise



# ----------------------------
# Backup targets (cloud/lan) helpers
# ----------------------------

def list_backup_targets(db: Session) -> List[Dict[str, Any]]:
    from .. import models  # local import to avoid cycles
    targets = db.query(models.BackupTarget).order_by(models.BackupTarget.id.asc()).all()
    return [
        {
            "id": t.id,
            "name": t.name,
            "kind": t.kind,
            "remote_path": t.remote_path,
            "enabled": t.enabled,
            "config": t.config or {},
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "updated_at": t.updated_at.isoformat() if t.updated_at else None,
        }
        for t in targets
    ]


def upsert_backup_target(db: Session, payload: Dict[str, Any]):
    """Crea o aggiorna una destinazione backup.

    payload atteso:
      {id?, name, kind, remote_path?, enabled?, config?}
    """
    from .. import models  # local import to avoid cycles

    tid = payload.get("id")
    if tid:
        t = db.query(models.BackupTarget).filter(models.BackupTarget.id == tid).first()
        if not t:
            return None
    else:
        t = models.BackupTarget()

    # campi
    if "name" in payload:
        t.name = str(payload["name"]).strip()
    if "kind" in payload:
        # Normalize common UI/provider aliases.
        # The frontend historically used "drive" for Google Drive.
        raw_kind = str(payload["kind"]).strip().lower()
        kind_aliases = {
            "drive": "gdrive",
            "google": "gdrive",
            "google_drive": "gdrive",
            "googledrive": "gdrive",
            "onedrive_rclone": "onedrive",
            "gdrive_rclone": "gdrive",
            "dropbox_rclone": "dropbox",
        }
        t.kind = kind_aliases.get(raw_kind, raw_kind)

    if "remote_path" in payload:
        rp = (payload.get("remote_path") or "").strip()
        # Users sometimes paste an rclone-style path like "gdrive:folder".
        # We store ONLY the folder/path part; the remote (section name) is derived from target.name.
        if ":" in rp:
            rp = rp.split(":", 1)[1].lstrip("/")
        t.remote_path = (rp or None)
    if "enabled" in payload:
        t.enabled = bool(payload.get("enabled", True))
    if "config" in payload:
        t.config = payload.get("config") or {}

    # validate minimal
    if not t.name or not t.kind:
        raise ValueError("name e kind sono obbligatori")

    # unique name
    q = db.query(models.BackupTarget).filter(models.BackupTarget.name == t.name)
    if tid:
        q = q.filter(models.BackupTarget.id != tid)
    if db.query(q.exists()).scalar():
        raise ValueError("Esiste già una destinazione con questo nome")

    db.add(t)
    db.commit()
    db.refresh(t)

    # rigenera rclone.conf (solo destinazioni enabled)
    targets = db.query(models.BackupTarget).filter(models.BackupTarget.enabled.is_(True)).all()
    build_rclone_conf(
        [
            {
                "name": x.name,
                "kind": x.kind,
                "remote_path": x.remote_path,
                "config": x.config,
                "enabled": x.enabled,
            }
            for x in targets
        ]
    )
    return t


def delete_backup_target(db: Session, target_id: int) -> bool:
    from .. import models  # local import
    t = db.query(models.BackupTarget).filter(models.BackupTarget.id == target_id).first()
    if not t:
        return False
    db.delete(t)
    db.commit()

    # rigenera rclone.conf rimuovendo il target
    targets = db.query(models.BackupTarget).filter(models.BackupTarget.enabled.is_(True)).all()
    build_rclone_conf(
        [
            {
                "name": x.name,
                "kind": x.kind,
                "remote_path": x.remote_path,
                "config": x.config,
                "enabled": x.enabled,
            }
            for x in targets
        ]
    )
    return True


def push_backup_to_target(db: Session, backup_id: str, target_id: int) -> Dict[str, Any]:
    """Carica un backup locale verso una destinazione configurata."""
    from .. import models
    _ensure_dirs()
    backup_id = _safe_backup_id(backup_id)
    local_file = BACKUPS_DIR / backup_id
    if not local_file.exists():
        raise FileNotFoundError("Backup non trovato")

    t = db.query(models.BackupTarget).filter(models.BackupTarget.id == target_id).first()
    if not t:
        raise FileNotFoundError("Target non trovato")
    if not t.enabled:
        raise ValueError("Target disabilitato")

    build_rclone_conf(
        [
            {
                "name": t.name,
                "kind": t.kind,
                "remote_path": t.remote_path,
                "config": t.config,
                "enabled": t.enabled,
            }
        ]
    )
    rclone_copy_to_target(local_file, {"name": t.name, "kind": t.kind, "remote_path": t.remote_path, "config": t.config, "enabled": t.enabled})
    return {"ok": True, "target": t.name, "backup_id": backup_id}


def pull_backup_from_target(db: Session, backup_id: str, target_id: int) -> Dict[str, Any]:
    """Scarica un backup da una destinazione configurata a BACKUPS_DIR."""
    from .. import models
    _ensure_dirs()
    backup_id = _safe_backup_id(backup_id)

    t = db.query(models.BackupTarget).filter(models.BackupTarget.id == target_id).first()
    if not t:
        raise FileNotFoundError("Target non trovato")
    if not t.enabled:
        raise ValueError("Target disabilitato")

    build_rclone_conf(
        [
            {
                "name": t.name,
                "kind": t.kind,
                "remote_path": t.remote_path,
                "config": t.config,
                "enabled": t.enabled,
            }
        ]
    )
    out = rclone_copy_from_target({"name": t.name, "kind": t.kind, "remote_path": t.remote_path, "config": t.config, "enabled": t.enabled}, backup_id, BACKUPS_DIR)
    return {"ok": True, "downloaded_to": str(out), "backup_id": backup_id, "target": t.name}
