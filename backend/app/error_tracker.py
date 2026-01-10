"""
Error Tracking - Base implementation
Traccia gli errori in file log separati e stderr.
"""

import logging
import os
import traceback
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any
import json

# Configurazione error tracking
ERROR_LOG_DIR = Path(os.getenv("ERROR_LOG_DIR", "logs/errors"))
ERROR_LOG_DIR.mkdir(parents=True, exist_ok=True)

# Logger per errori critici
error_logger = logging.getLogger("error_tracker")
error_logger.setLevel(logging.ERROR)

# Handler per file errori
error_file_handler = logging.FileHandler(
    ERROR_LOG_DIR / f"errors_{datetime.now().strftime('%Y%m%d')}.log",
    encoding="utf-8"
)
error_file_handler.setLevel(logging.ERROR)

# Formatter per file errori (JSON o testo)
ERROR_LOG_FORMAT = os.getenv("ERROR_LOG_FORMAT", "text")  # "text" o "json"

if ERROR_LOG_FORMAT == "json":
    class ErrorJSONFormatter(logging.Formatter):
        """Formatter JSON per errori"""
        def format(self, record):
            error_data = {
                "timestamp": datetime.now().isoformat(),
                "level": record.levelname,
                "logger": record.name,
                "message": record.getMessage(),
                "module": record.module,
                "funcName": record.funcName,
                "lineno": record.lineno,
            }
            
            # Aggiungi exception info se presente
            if record.exc_info:
                error_data["exception"] = {
                    "type": record.exc_info[0].__name__ if record.exc_info[0] else None,
                    "message": str(record.exc_info[1]) if record.exc_info[1] else None,
                    "traceback": traceback.format_exception(*record.exc_info)
                }
            
            # Aggiungi extra fields se presenti
            if hasattr(record, "request_id"):
                error_data["request_id"] = record.request_id
            if hasattr(record, "endpoint"):
                error_data["endpoint"] = record.endpoint
            if hasattr(record, "user_id"):
                error_data["user_id"] = record.user_id
            
            return json.dumps(error_data, ensure_ascii=False)
    
    error_file_handler.setFormatter(ErrorJSONFormatter())
else:
    # Formatter testo leggibile
    error_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s\n%(exc_info)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    error_file_handler.setFormatter(error_formatter)

# Aggiungi handler al logger errori
if not error_logger.handlers:
    error_logger.addHandler(error_file_handler)
    # Non propagare al root logger per evitare duplicati
    error_logger.propagate = False


def log_error(
    message: str,
    exc_info: Optional[Exception] = None,
    extra: Optional[Dict[str, Any]] = None,
    level: int = logging.ERROR
):
    """
    Registra un errore nel file log e stderr.
    
    Args:
        message: Messaggio di errore
        exc_info: Eccezione opzionale (per traceback)
        extra: Dizionario con informazioni aggiuntive (request_id, endpoint, user_id, etc.)
        level: Livello di log (default: ERROR)
    """
    extra_data = extra or {}
    
    # Log con error_logger (va al file)
    error_logger.log(
        level,
        message,
        exc_info=exc_info,
        extra=extra_data
    )
    
    # Log anche con root logger (va a stderr/console)
    root_logger = logging.getLogger()
    root_logger.log(
        level,
        message,
        exc_info=exc_info,
        extra=extra_data
    )


def log_exception(
    exception: Exception,
    message: Optional[str] = None,
    extra: Optional[Dict[str, Any]] = None
):
    """
    Registra un'eccezione completa con traceback.
    
    Args:
        exception: Eccezione da registrare
        message: Messaggio opzionale aggiuntivo
        extra: Dizionario con informazioni aggiuntive
    """
    msg = message or f"Errore non gestito: {type(exception).__name__}: {str(exception)}"
    log_error(
        msg,
        exc_info=(type(exception), exception, exception.__traceback__),
        extra=extra
    )


def get_error_stats(date: Optional[str] = None) -> Dict[str, Any]:
    """
    Ottiene statistiche sugli errori registrati.
    
    Args:
        date: Data in formato YYYYMMDD (default: oggi)
    
    Returns:
        Dizionario con statistiche errori
    """
    if date is None:
        date = datetime.now().strftime('%Y%m%d')
    
    error_file = ERROR_LOG_DIR / f"errors_{date}.log"
    
    if not error_file.exists():
        return {
            "date": date,
            "total_errors": 0,
            "error_types": {},
            "last_error": None
        }
    
    # Leggi file errori e calcola statistiche
    stats = {
        "date": date,
        "total_errors": 0,
        "error_types": {},
        "last_error": None
    }
    
    try:
        with open(error_file, 'r', encoding='utf-8') as f:
            if ERROR_LOG_FORMAT == "json":
                # Parsing JSON lines
                for line in f:
                    try:
                        error_data = json.loads(line.strip())
                        stats["total_errors"] += 1
                        error_type = error_data.get("exception", {}).get("type", "Unknown")
                        stats["error_types"][error_type] = stats["error_types"].get(error_type, 0) + 1
                        stats["last_error"] = error_data
                    except json.JSONDecodeError:
                        continue
            else:
                # Conta righe con "ERROR" nel formato testo
                lines = f.readlines()
                stats["total_errors"] = len([l for l in lines if "ERROR" in l.upper()])
                stats["last_error"] = lines[-1] if lines else None
    except Exception as e:
        log_error(f"Errore lettura statistiche errori: {e}", exc_info=e)
    
    return stats
