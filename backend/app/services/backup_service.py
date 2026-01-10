import base64
import json
import logging
import os
import re
import shutil
import subprocess
import tarfile
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import pytz
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from ..config import BACKUPS_DIR, UPLOADS_DIR

logger = logging.getLogger(__name__)


def safe_tar_extract(tar: tarfile.TarFile, path: str, members: Optional[List[tarfile.TarInfo]] = None) -> None:
    """
    Estrae un archivio tar in modo sicuro, prevenendo path traversal attacks.
    
    Valida che tutti i membri dell'archivio vengano estratti solo all'interno
    della directory di destinazione specificata.
    
    Args:
        tar: Oggetto TarFile aperto
        path: Directory di destinazione (deve essere un path assoluto)
        members: Lista opzionale di membri da estrarre (se None, estrae tutti)
        
    Raises:
        ValueError: Se viene rilevato un tentativo di path traversal
    """
    if members is None:
        members = tar.getmembers()
    
    # Normalizza il path di destinazione (assoluto)
    dest_path = os.path.abspath(path)
    
    # Verifica che la directory di destinazione esista
    os.makedirs(dest_path, exist_ok=True)
    
    # Valida ogni membro prima dell'estrazione
    safe_members = []
    for member in members:
        # Normalizza il path del membro (risolve .. e .)
        member_path = os.path.normpath(member.name)
        # Rimuove eventuali separatori iniziali che potrebbero causare problemi
        member_path = member_path.lstrip(os.sep).lstrip('/')
        
        # Costruisce il path completo di destinazione
        dest_member_path = os.path.join(dest_path, member_path)
        # Normalizza il path completo
        dest_member_path = os.path.normpath(dest_member_path)
        
        # Verifica che il path di destinazione sia dentro la directory base
        # Usa os.path.commonpath per gestire correttamente i path su Windows
        try:
            common_path = os.path.commonpath([dest_path, dest_member_path])
            if common_path != dest_path:
                raise ValueError(
                    f"Path traversal attempt detected: '{member.name}' would be extracted outside '{dest_path}'"
                )
        except (ValueError, OSError):
            # Se i path sono incompatibili, considera come tentativo di path traversal
            raise ValueError(
                f"Path traversal attempt detected: '{member.name}' would be extracted outside '{dest_path}'"
            )
        
        # Aggiorna il nome del membro con il path normalizzato
        member.name = member_path
        safe_members.append(member)
    
    # Estrae solo i membri validati
    tar.extractall(dest_path, members=safe_members)

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
    """Esegue un comando e gestisce gli errori con logging dettagliato."""
    try:
        logger.debug(f"Esecuzione comando: {' '.join(cmd)}")
        p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env=env, timeout=300)
        if p.returncode != 0:
            error_msg = f"Comando fallito: {' '.join(cmd)}\nSTDOUT: {p.stdout}\nSTDERR: {p.stderr}"
            logger.error(error_msg)
            raise RuntimeError(error_msg)
        if p.stdout:
            logger.debug(f"Output comando: {p.stdout[:500]}")  # Limita log a 500 caratteri
        return p.stdout
    except subprocess.TimeoutExpired:
        error_msg = f"Timeout comando: {' '.join(cmd)}"
        logger.error(error_msg)
        raise RuntimeError(error_msg)
    except Exception as e:
        error_msg = f"Errore esecuzione comando {' '.join(cmd)}: {str(e)}"
        logger.error(error_msg, exc_info=True)
        raise RuntimeError(error_msg)


# ----------------------------
# Rclone config (providers)
# ----------------------------


def build_rclone_conf(targets: List[Dict[str, Any]]):
    """Genera rclone.conf a partire dalla lista targets (DB).

    targets: [{name, kind, remote_path, config}, ...]

    NOTE: per OneDrive/GoogleDrive/Dropbox serve token JSON generato con rclone authorize
    (puoi farlo su una macchina qualsiasi) e incollarlo nella UI.
    
    Raises:
        ValueError: Se la configurazione non è valida
        RuntimeError: Se non è possibile scrivere il file di configurazione
    """
    _ensure_dirs()

    try:
        logger.info(f"Generazione rclone.conf per {len(targets)} target(s)")
        lines: List[str] = []
        for t in targets:
            if not t.get("enabled", True):
                logger.debug(f"Target {t.get('name', 'unknown')} disabilitato, saltato")
                continue
            name = t.get("name", "").strip()
            kind = t.get("kind", "").strip().lower()
            cfg = t.get("config") or {}

            if not name:
                raise ValueError("Nome target non può essere vuoto")
            if not kind:
                raise ValueError(f"Tipo target non può essere vuoto per '{name}'")

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
                    token = cfg['token']
                    # Se il token è una stringa JSON, prova a parsarla e riconvertirla
                    if isinstance(token, str):
                        try:
                            # Se è già una stringa JSON, parsala e riconvertila per normalizzazione
                            parsed = json.loads(token)
                            token = json.dumps(parsed, ensure_ascii=False)
                        except (json.JSONDecodeError, TypeError):
                            # Se non è JSON valido, usa come stringa diretta
                            pass
                    # Se il token è un dict/list, convertilo in JSON string
                    elif isinstance(token, (dict, list)):
                        token = json.dumps(token, ensure_ascii=False)
                    lines.append(f"token = {token}")
                logger.debug(f"Configurato target Google Drive: {name}")

            elif kind == "onedrive":
                lines.append("type = onedrive")
                if cfg.get("client_id"):
                    lines.append(f"client_id = {cfg['client_id']}")
                if cfg.get("client_secret"):
                    lines.append(f"client_secret = {cfg['client_secret']}")
                if cfg.get("token"):
                    token = cfg['token']
                    # Se il token è una stringa JSON, prova a parsarla e riconvertirla
                    if isinstance(token, str):
                        try:
                            parsed = json.loads(token)
                            token = json.dumps(parsed, ensure_ascii=False)
                        except (json.JSONDecodeError, TypeError):
                            pass
                    elif isinstance(token, (dict, list)):
                        token = json.dumps(token, ensure_ascii=False)
                    lines.append(f"token = {token}")
                if cfg.get("drive_id"):
                    lines.append(f"drive_id = {cfg['drive_id']}")
                if cfg.get("drive_type"):
                    lines.append(f"drive_type = {cfg['drive_type']}")
                logger.debug(f"Configurato target OneDrive: {name}")

            elif kind == "dropbox":
                lines.append("type = dropbox")
                if cfg.get("client_id"):
                    lines.append(f"client_id = {cfg['client_id']}")
                if cfg.get("client_secret"):
                    lines.append(f"client_secret = {cfg['client_secret']}")
                if cfg.get("token"):
                    token = cfg['token']
                    # Se il token è una stringa JSON, prova a parsarla e riconvertirla
                    if isinstance(token, str):
                        try:
                            parsed = json.loads(token)
                            token = json.dumps(parsed, ensure_ascii=False)
                        except (json.JSONDecodeError, TypeError):
                            pass
                    elif isinstance(token, (dict, list)):
                        token = json.dumps(token, ensure_ascii=False)
                    lines.append(f"token = {token}")
                logger.debug(f"Configurato target Dropbox: {name}")

            elif kind == "smb":
                lines.append("type = smb")
                # required: host & share
                if not cfg.get("host"):
                    raise ValueError(f"Host obbligatorio per target SMB '{name}'")
                if not cfg.get("share"):
                    raise ValueError(f"Share obbligatorio per target SMB '{name}'")
                lines.append(f"host = {cfg['host']}")
                lines.append(f"share = {cfg['share']}")
                # optional: user, domain, port (normali)
                for k in ["user", "domain", "port"]:
                    if cfg.get(k) is not None and cfg.get(k) != "":
                        lines.append(f"{k} = {cfg[k]}")
                # password deve essere offuscata con rclone obscure per SMB
                if cfg.get("pass") is not None and cfg.get("pass") != "":
                    try:
                        # Usa rclone obscure per offuscare la password (non base64 standard)
                        result = subprocess.run(
                            ["rclone", "obscure", cfg['pass']],
                            capture_output=True,
                            text=True,
                            timeout=5,
                            check=True
                        )
                        pass_obscured = result.stdout.strip()
                        lines.append(f"pass = {pass_obscured}")
                        logger.debug(f"Password SMB offuscata per '{name}'")
                    except subprocess.TimeoutExpired:
                        logger.error(f"Timeout durante offuscamento password SMB per '{name}'")
                        # Fallback: usa la password originale (potrebbe non funzionare)
                        lines.append(f"pass = {cfg['pass']}")
                    except subprocess.CalledProcessError as e:
                        logger.error(f"Errore rclone obscure per '{name}': {e.stderr}")
                        # Fallback: usa la password originale
                        lines.append(f"pass = {cfg['pass']}")
                    except Exception as e:
                        logger.warning(f"Errore offuscamento password SMB per '{name}': {e}")
                        # Fallback: usa la password originale
                        lines.append(f"pass = {cfg['pass']}")
                logger.debug(f"Configurato target SMB: {name} (host={cfg['host']}, share={cfg['share']})")

            elif kind == "ftp":
                lines.append("type = ftp")
                # required: host
                if not cfg.get("host"):
                    raise ValueError(f"Host obbligatorio per target FTP '{name}'")
                lines.append(f"host = {cfg['host']}")
                # optional: user, port (normali)
                for k in ["user", "port"]:
                    if cfg.get(k) is not None and cfg.get(k) != "":
                        lines.append(f"{k} = {cfg[k]}")
                # password per FTP deve essere offuscata con rclone obscure
                if cfg.get("pass") is not None and cfg.get("pass") != "":
                    try:
                        # Usa rclone obscure per offuscare la password
                        result = subprocess.run(
                            ["rclone", "obscure", cfg['pass']],
                            capture_output=True,
                            text=True,
                            timeout=5,
                            check=True
                        )
                        pass_obscured = result.stdout.strip()
                        lines.append(f"pass = {pass_obscured}")
                        logger.debug(f"Password FTP offuscata per '{name}'")
                    except subprocess.TimeoutExpired:
                        logger.error(f"Timeout durante offuscamento password FTP per '{name}'")
                        lines.append(f"pass = {cfg['pass']}")
                    except subprocess.CalledProcessError as e:
                        logger.error(f"Errore rclone obscure per '{name}': {e.stderr}")
                        lines.append(f"pass = {cfg['pass']}")
                    except Exception as e:
                        logger.warning(f"Errore offuscamento password FTP per '{name}': {e}")
                        lines.append(f"pass = {cfg['pass']}")
                if not cfg.get("port"):
                    lines.append("port = 21")
                logger.debug(f"Configurato target FTP: {name} (host={cfg['host']})")

            elif kind == "sftp":
                lines.append("type = sftp")
                # required: host & user
                if not cfg.get("host"):
                    raise ValueError(f"Host obbligatorio per target SFTP '{name}'")
                if not cfg.get("user"):
                    raise ValueError(f"User obbligatorio per target SFTP '{name}'")
                lines.append(f"host = {cfg['host']}")
                lines.append(f"user = {cfg['user']}")
                # optional: port, key_file, key_file_pass (normali)
                for k in ["port", "key_file", "key_file_pass"]:
                    if cfg.get(k) is not None and cfg.get(k) != "":
                        lines.append(f"{k} = {cfg[k]}")
                # password per SFTP deve essere offuscata con rclone obscure
                if cfg.get("pass") is not None and cfg.get("pass") != "":
                    try:
                        result = subprocess.run(
                            ["rclone", "obscure", cfg['pass']],
                            capture_output=True,
                            text=True,
                            timeout=5,
                            check=True
                        )
                        pass_obscured = result.stdout.strip()
                        lines.append(f"pass = {pass_obscured}")
                        logger.debug(f"Password SFTP offuscata per '{name}'")
                    except Exception as e:
                        logger.warning(f"Errore offuscamento password SFTP per '{name}': {e}")
                        lines.append(f"pass = {cfg['pass']}")
                if not cfg.get("port"):
                    lines.append("port = 22")
                logger.debug(f"Configurato target SFTP: {name} (host={cfg['host']}, user={cfg['user']})")

            else:
                # unsupported
                logger.warning(f"Tipo target non supportato: {kind} per '{name}', usando configurazione generica")
                lines.append(f"type = {kind}")
                for k, v in cfg.items():
                    lines.append(f"{k} = {v}")

            lines.append("")

        config_content = "\n".join(lines)
        logger.debug(f"Scrittura rclone.conf in {RCLONE_CONFIG}")
        RCLONE_CONFIG.write_text(config_content, encoding="utf-8")
        logger.info(f"rclone.conf generato con successo ({len(lines)} righe)")
        
    except ValueError as e:
        logger.error(f"Errore validazione configurazione rclone: {str(e)}")
        raise
    except Exception as e:
        logger.error(f"Errore generazione rclone.conf: {str(e)}", exc_info=True)
        raise RuntimeError(f"Errore generazione configurazione rclone: {str(e)}")


def rclone_copy_to_target(local_file: Path, target: Dict[str, Any]):
    """Copia un file backup verso la destinazione target usando rclone."""
    _ensure_dirs()

    try:
        section = re.sub(r"[^a-zA-Z0-9_-]", "_", target["name"].strip())
        remote_path = (target.get("remote_path") or "").strip().lstrip("/")
        kind = target.get("kind", "").lower()
        config = target.get("config", {})

        # Per SMB, il remote_path deve essere relativo alla share definita nel config
        # Il remote_path può contenere il percorso completo \\server\share\path
        # Devo estrarre solo il path relativo alla share
        if kind == "smb":
            share = config.get("share", "")
            # Normalizza il percorso: rimuovi backslash e converti in slash
            remote_path = remote_path.replace("\\", "/")
            # Rimuovi eventuali // iniziali da percorsi UNC
            while remote_path.startswith("//"):
                remote_path = remote_path[1:]
            remote_path = remote_path.lstrip("/")
            
            # Se il remote_path contiene un percorso completo tipo \\server\share\path o server/share/path
            # Estrai solo la parte dopo la share
            if "/" in remote_path:
                parts = remote_path.split("/")
                
                # Normalizza i nomi per il confronto (rimuovi caratteri speciali)
                share_normalized = share.replace("!", "").replace(".", "").replace("-", "").replace("_", "").lower() if share else ""
                
                # Cerca la share nei path parts
                # La share può essere in qualsiasi posizione dopo l'IP/hostname
                found_share = False
                for i, part in enumerate(parts):
                    part_normalized = part.replace("!", "").replace(".", "").replace("-", "").replace("_", "").lower()
                    
                    # Se troviamo la share (o una corrispondenza parziale), il path dopo è quello che ci interessa
                    if share_normalized:
                        if share_normalized in part_normalized or part_normalized in share_normalized or part_normalized == share_normalized:
                            # Il path relativo alla share è tutto dopo questa parte
                            if i + 1 < len(parts):
                                remote_path = "/".join(parts[i + 1:])
                            else:
                                remote_path = ""
                            found_share = True
                            break
                
                # Se non abbiamo trovato la share per nome, prova pattern comuni
                if not found_share and len(parts) >= 3:
                    # Pattern comune: IP/share/path o hostname/share/path
                    # La share è solitamente la seconda parte dopo l'IP/hostname
                    if "." in parts[0] or parts[0].replace(".", "").replace(":", "").isdigit():
                        # Salta IP/hostname (parts[0]) e share (parts[1]), prendi il resto
                        remote_path = "/".join(parts[2:])
                    elif len(parts) >= 2:
                        # Se ci sono solo 2 parti, probabilmente share/path, prendi il resto
                        remote_path = "/".join(parts[1:])
            
            # Il percorso rclone per SMB sarà: {section}:path_relative_to_share/filename
            # Esempio: NAS_SMB:Atlantis/test/file.tar.gz
            dest = f"{section}:{remote_path}" if remote_path else f"{section}:"
        else:
            # Per altri tipi (FTP, SFTP, cloud), usa il formato standard
            dest = f"{section}:{remote_path}" if remote_path else f"{section}:"
        
        # Aggiungi il nome del file
        if remote_path:
            dest_file = f"{dest}/{local_file.name}"
        else:
            dest_file = f"{dest}{local_file.name}"

        logger.info(f"Upload backup {local_file.name} verso {target['name']} ({dest_file})")
        
        _run([
            "rclone",
            "--config",
            str(RCLONE_CONFIG),
            "copyto",
            str(local_file),
            dest_file,
            "--checksum",
            "--transfers",
            "2",
        ])
        
        logger.info(f"Upload completato con successo verso {target['name']}")
        
    except Exception as e:
        logger.error(f"Errore upload backup verso {target.get('name', 'unknown')}: {str(e)}", exc_info=True)
        raise


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

    # Usa timezone locale (Europe/Rome) per il nome del file
    rome_tz = pytz.timezone('Europe/Rome')
    ts = datetime.now(rome_tz).strftime("%Y%m%d_%H%M%S")
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

        # Calcola dimensione file
        file_size_mb = round(out_file.stat().st_size / (1024 * 1024), 2)
        
        # 5) Optional upload to targets
        uploaded: List[str] = []
        upload_results: List[Dict[str, Any]] = []  # Lista risultati upload per email
        
        # Aggiungi sempre il backup locale come primo elemento (sempre successo se arriviamo qui)
        upload_results.append({"name": "Backup locale", "success": True, "error": None})
        
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
                
                # Retry logic: massimo 3 tentativi
                max_retries = 3
                retry_count = 0
                upload_success = False
                last_error = None
                
                while retry_count < max_retries and not upload_success:
                    try:
                        if retry_count > 0:
                            logger.info(f"Tentativo {retry_count + 1}/{max_retries} per upload verso {t.name}")
                            _write_status("running", 92, f"Retry {retry_count + 1}/{max_retries} su {t.name}...")
                        
                        rclone_copy_to_target(out_file, {"name": t.name, "kind": t.kind, "remote_path": t.remote_path, "config": t.config, "enabled": t.enabled})
                        uploaded.append(t.name)
                        upload_results.append({"name": t.name, "success": True, "error": None})
                        upload_success = True
                        
                    except Exception as upload_err:
                        retry_count += 1
                        last_error = str(upload_err)
                        logger.warning(f"Tentativo {retry_count}/{max_retries} fallito per {t.name}: {last_error}")
                        
                        # Se non è l'ultimo tentativo, aspetta un po' prima di riprovare
                        if retry_count < max_retries:
                            import time
                            time.sleep(2)  # Attendi 2 secondi prima del prossimo tentativo
                
                # Se dopo tutti i tentativi non è riuscito, registra l'errore e continua
                if not upload_success:
                    error_msg = f"Fallito dopo {max_retries} tentativi: {last_error}"
                    logger.error(f"Errore upload verso {t.name}: {error_msg}")
                    upload_results.append({"name": t.name, "success": False, "error": error_msg})
        
        _write_status("completed", 100, "Backup completato", {
            "backup_id": backup_name,
            "uploaded_to": uploaded,
            "file_size_mb": file_size_mb
        })
        
        # Invia email di notifica (se configurato) - sempre con la lista completa dei risultati
        if db is not None:
            try:
                _send_backup_notification_email(
                    db=db,
                    success=True,
                    backup_id=backup_name,
                    file_size_mb=file_size_mb,
                    upload_results=upload_results
                )
            except Exception as email_err:
                logger.warning(f"Impossibile inviare email notifica backup: {email_err}")
        
        return {"status": "started", "pid": None, "message": "Backup avviato", "output": None, "backup_id": backup_name}

    except Exception as e:
        error_msg = str(e)
        _write_status("error", 0, f"Errore backup: {error_msg}", {"error": error_msg})
        
        # Invia email di notifica errore (se configurato)
        if db is not None:
            try:
                _send_backup_notification_email(
                    db=db,
                    success=False,
                    backup_id=None,
                    upload_results=None,
                    error=error_msg
                )
            except Exception as email_err:
                logger.warning(f"Impossibile inviare email notifica errore backup: {email_err}")
        
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
                safe_tar_extract(tar, str(tmp))

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
                    safe_tar_extract(tar, str(uploads_extract_dir))

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
    try:
        targets = db.query(models.BackupTarget).filter(models.BackupTarget.enabled.is_(True)).all()
        if targets:
            build_rclone_conf(
                [
                    {
                        "name": x.name,
                        "kind": x.kind,
                        "remote_path": x.remote_path,
                        "config": x.config or {},
                        "enabled": x.enabled,
                    }
                    for x in targets
                ]
            )
        else:
            logger.info("Nessun target abilitato, rclone.conf non generato")
    except Exception as e:
        logger.error(f"Errore generazione rclone.conf dopo upsert target: {e}", exc_info=True)
        # Non fallisce l'upsert se c'è un problema con rclone.conf
        # L'utente può riprovare dopo
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


def _send_backup_notification_email(
    db: Session,
    success: bool,
    backup_id: Optional[str] = None,
    file_size_mb: Optional[float] = None,
    upload_results: Optional[List[Dict[str, Any]]] = None,
    error: Optional[str] = None
):
    """
    Invia email di notifica backup (successo o fallimento)
    
    Args:
        db: Sessione database
        success: True se backup completato con successo, False se fallito
        backup_id: ID/nome del file backup (opzionale)
        file_size_mb: Dimensione file backup in MB (opzionale)
        upload_results: Lista risultati upload [{"name": str, "success": bool, "error": str?}] (opzionale)
        error: Messaggio di errore se fallito (opzionale)
    """
    from .. import models
    from ..services import email_service
    
    try:
        # Ottieni impostazioni azienda
        settings = db.query(models.ImpostazioniAzienda).first()
        if not settings:
            logger.warning("Impostazioni azienda non trovate, impossibile inviare email notifica backup")
            return
        
        # Usa email_notifiche_scadenze se disponibile, altrimenti email generica
        email_destinatario = settings.email_notifiche_scadenze or settings.email
        if not email_destinatario:
            logger.warning("Nessuna email configurata per notifiche backup")
            return
        
        # Nome azienda
        azienda_nome = settings.nome_azienda or "GIT - Gestione Interventi Tecnici"
        
        # Genera email
        subject, body_html = email_service.generate_backup_notification_email(
            success=success,
            backup_id=backup_id,
            file_size_mb=file_size_mb,
            upload_results=upload_results,
            error=error,
            azienda_nome=azienda_nome
        )
        
        # Invia email
        email_sent = email_service.send_email(
            to_email=email_destinatario,
            subject=subject,
            body_html=body_html,
            db=db
        )
        
        if email_sent:
            logger.info(f"Email notifica backup inviata con successo a {email_destinatario}")
        else:
            logger.warning(f"Impossibile inviare email notifica backup a {email_destinatario}")
            
    except Exception as e:
        logger.error(f"Errore durante invio email notifica backup: {e}", exc_info=True)
