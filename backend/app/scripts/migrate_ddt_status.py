import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import update  # noqa: E402

from app import database, models  # noqa: E402


def main() -> None:
    session = database.SessionLocal()
    try:
        count_respinto = session.query(models.RitiroProdotto).filter(
            models.RitiroProdotto.stato == "respinto",
            models.RitiroProdotto.deleted_at.is_(None)
        ).count()

        if count_respinto == 0:
            print("Nessun DDT con stato 'respinto' trovato.")
            return

        session.execute(
            update(models.RitiroProdotto)
            .where(models.RitiroProdotto.stato == "respinto")
            .values(stato="scartato")
        )
        session.commit()
        print(f"Migrati {count_respinto} DDT da 'respinto' a 'scartato'.")
    finally:
        session.close()


if __name__ == "__main__":
    main()
