import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app import models
from app.routers.impostazioni import get_settings_or_default
from app.services import pdf_service
from app.main import send_email_background, send_email_ddt_background


def main() -> None:
    db = SessionLocal()
    try:
        settings = get_settings_or_default(db)
        to_email = settings.email
        if not to_email:
            print("Nessuna email azienda configurata per il test.")
            return

        rit = (
            db.query(models.Intervento)
            .filter(models.Intervento.deleted_at.is_(None))
            .order_by(models.Intervento.id.desc())
            .first()
        )
        ddt = (
            db.query(models.RitiroProdotto)
            .filter(models.RitiroProdotto.deleted_at.is_(None))
            .order_by(models.RitiroProdotto.id.desc())
            .first()
        )

        if rit:
            pdf_bytes = pdf_service.genera_pdf_intervento(rit, settings)
            send_email_background(
                to_email,
                pdf_bytes,
                rit.numero_relazione,
                settings.nome_azienda,
                rit.data_creazione,
                settings.indirizzo_completo or "",
                settings.telefono or "",
                settings.email or "",
                db,
                f"GIT - {settings.nome_azienda or 'GIT'} - Gestione RIT",
            )
            print(f"Test RIT inviato a {to_email} (RIT {rit.numero_relazione})")
        else:
            print("Nessun RIT trovato per il test.")

        if ddt:
            send_email_ddt_background(ddt.id, to_email, db)
            print(f"Test DDT inviato a {to_email} (DDT {ddt.numero_ddt})")
        else:
            print("Nessun DDT trovato per il test.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app import models
from app.services import pdf_service
from app.main import send_email_background, send_email_ddt_background
from app.routers.impostazioni import get_settings_or_default


def main() -> None:
    db = SessionLocal()
    try:
        settings = get_settings_or_default(db)
        recipient = settings.email or settings.smtp_username
        if not recipient:
            print("Nessuna email azienda configurata per il test.")
            return

        intervento = (
            db.query(models.Intervento)
            .filter(models.Intervento.deleted_at.is_(None))
            .order_by(models.Intervento.id.desc())
            .first()
        )
        if not intervento:
            print("Nessun RIT trovato per il test.")
        else:
            pdf_bytes = pdf_service.genera_pdf_intervento(intervento, settings)
            send_email_background(
                recipient,
                pdf_bytes,
                intervento.numero_relazione,
                settings.nome_azienda,
                intervento.data_creazione,
                settings.indirizzo_completo or "",
                settings.telefono or "",
                settings.email or "",
                db,
                from_name=f"GIT - {settings.nome_azienda or 'GIT'} - Gestione RIT",
            )
            print(f"Test RIT inviato a {recipient} (RIT {intervento.numero_relazione})")

        ddt = (
            db.query(models.RitiroProdotto)
            .filter(models.RitiroProdotto.deleted_at.is_(None))
            .order_by(models.RitiroProdotto.id.desc())
            .first()
        )
        if not ddt:
            print("Nessun DDT trovato per il test.")
        else:
            send_email_ddt_background(ddt.id, recipient, db)
            print(f"Test DDT inviato a {recipient} (DDT {ddt.numero_ddt})")
    finally:
        db.close()


if __name__ == "__main__":
    main()
