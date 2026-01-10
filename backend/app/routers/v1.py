"""
Router per API v1 - Versioning delle API
Tutti gli endpoint /api/v1/ vengono gestiti qui.
Gli endpoint vecchi /api/ sono mantenuti per compatibilità con deprecation warning.
"""

from fastapi import APIRouter, Request, Depends, HTTPException
from fastapi.responses import JSONResponse
from typing import Optional
import warnings

# Crea router v1 con prefisso /api/v1
router_v1 = APIRouter(prefix="/api/v1", tags=["API v1"])

# Importa le funzioni dai router esistenti e ricrea gli endpoint con prefisso v1
# Questo mantiene tutta la logica invariata ma aggiunge versioning
from . import auth as auth_module, backups as backups_module, impostazioni as impostazioni_module
from .. import models, schemas, database, auth

# Ricrea gli endpoint auth con prefisso v1
from fastapi.security import OAuth2PasswordRequestForm
from slowapi import Limiter
from slowapi.util import get_remote_address

# Rate limiter per v1
def get_limiter():
    from ..main import app
    return app.state.limiter

limiter_v1 = Limiter(key_func=get_remote_address)

# Wrapper per includere tutti gli endpoint auth in v1
# Usiamo un approccio che include direttamente le route mantenendo compatibilità
# Includiamo i router originali con il loro prefisso ma rimappati
# Per semplicità, includiamo i router direttamente ma cambiamo solo il prefisso

# Per ora, re-export delle route più importanti con versioning esplicito
# Questo permette di avere /api/v1/auth/login oltre a /api/auth/login

# Router v1 è principalmente per documentazione e struttura futura
# Gli endpoint /api/v1/ sono già gestiti in main.py con i decoratori multipli
# Questo router serve per organizzazione e per aggiungere middleware futuri
