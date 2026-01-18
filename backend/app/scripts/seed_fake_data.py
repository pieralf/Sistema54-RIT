import argparse
import random
import string
from datetime import datetime, timedelta

from app.database import SessionLocal
from app.models import Cliente, Intervento, RitiroProdotto, Utente, RuoloUtente, MacroCategoria


def random_digits(length: int) -> str:
    return "".join(random.choices(string.digits, k=length))


def random_alpha(length: int) -> str:
    return "".join(random.choices(string.ascii_uppercase, k=length))


def pick_or_create_tecnico(db) -> int:
    user = db.query(Utente).order_by(Utente.id.asc()).first()
    if user:
        return user.id
    tecnico = Utente(
        email="tecnico.fake@sistema54.local",
        password_hash=None,
        nome_completo="Tecnico Fake",
        ruolo=RuoloUtente.TECNICO,
        is_active=True,
    )
    db.add(tecnico)
    db.commit()
    db.refresh(tecnico)
    return tecnico.id


def build_clienti(count: int) -> list[Cliente]:
    clienti = []
    now = datetime.now()
    for i in range(count):
        has_contratto = random.random() < 0.5
        has_noleggio = random.random() < 0.5
        inizio = now - timedelta(days=random.randint(30, 365))
        fine = inizio + timedelta(days=random.randint(180, 900))
        clienti.append(
            Cliente(
                ragione_sociale=f"Cliente Test {i + 1:04d}",
                indirizzo=f"Via Test {i + 1}",
                citta=random.choice(["Roma", "Milano", "Napoli", "Torino", "Bologna"]),
                cap=f"{random.randint(10000, 99999)}",
                p_iva=f"IT{random_digits(11)}",
                codice_fiscale=f"{random_alpha(6)}{random_digits(2)}{random_alpha(1)}{random_digits(2)}{random_alpha(1)}{random_digits(3)}{random_alpha(1)}",
                email_amministrazione=f"amministrazione{i + 1}@cliente.test",
                email_pec=f"pec{i + 1}@cliente.test",
                referente_nome=f"Referente {i + 1}",
                referente_cellulare=f"+39{random_digits(9)}",
                codice_sdi=random_alpha(7),
                is_pa=random.random() < 0.1,
                split_payment=random.random() < 0.1,
                has_contratto_assistenza=has_contratto,
                has_noleggio=has_noleggio,
                has_multisede=random.random() < 0.2,
                sede_legale_operativa=random.random() < 0.3,
                data_inizio_contratto_assistenza=inizio if has_contratto else None,
                data_fine_contratto_assistenza=fine if has_contratto else None,
                limite_chiamate_contratto=random.choice([None, 6, 12, 24]),
                chiamate_utilizzate_contratto=random.randint(0, 5),
                costo_chiamata_fuori_limite=round(random.uniform(30, 90), 2),
            )
        )
    return clienti


def build_interventi(count: int, clienti: list[Cliente], tecnico_id: int) -> list[Intervento]:
    interventi = []
    year = datetime.now().year
    for i in range(count):
        cliente = random.choice(clienti)
        interventi.append(
            Intervento(
                numero_relazione=f"RIT-{year}-{i + 1:06d}-{random_digits(4)}",
                anno_riferimento=year,
                data_creazione=datetime.now() - timedelta(days=random.randint(0, 365)),
                tecnico_id=tecnico_id,
                cliente_id=cliente.id,
                cliente_ragione_sociale=cliente.ragione_sociale,
                cliente_indirizzo=cliente.indirizzo,
                cliente_piva=cliente.p_iva,
                macro_categoria=random.choice(list(MacroCategoria)),
                is_contratto=cliente.has_contratto_assistenza,
                is_chiamata=True,
                difetto_segnalato="Test difetto segnalato",
            )
        )
    return interventi


def build_ddt(count: int, clienti: list[Cliente], tecnico_id: int) -> list[RitiroProdotto]:
    ddt_list = []
    year = datetime.now().year
    for i in range(count):
        cliente = random.choice(clienti)
        ddt_list.append(
            RitiroProdotto(
                numero_ddt=f"DDT-{year}-{i + 1:06d}-{random_digits(4)}",
                anno_riferimento=year,
                data_ritiro=datetime.now() - timedelta(days=random.randint(0, 365)),
                tecnico_id=tecnico_id,
                cliente_id=cliente.id,
                cliente_ragione_sociale=cliente.ragione_sociale,
                cliente_indirizzo=cliente.indirizzo,
                cliente_piva=cliente.p_iva,
                tipo_prodotto=random.choice(["PC", "Stampante", "Router", "Monitor"]),
                marca=random.choice(["HP", "Dell", "Lenovo", "Canon", "Epson"]),
                modello=f"Model-{random_alpha(3)}-{random_digits(3)}",
                serial_number=f"SN{random_digits(8)}",
                descrizione_prodotto="Prodotto test",
                difetto_segnalato="Difetto segnalato test",
                stato=random.choice(["in_magazzino", "in_riparazione", "riparato", "consegnato", "scartato", "in_attesa_cliente"]),
            )
        )
    return ddt_list


def chunked_save(db, objects, chunk_size=500):
    for i in range(0, len(objects), chunk_size):
        db.bulk_save_objects(objects[i : i + chunk_size])
        db.commit()


def main():
    parser = argparse.ArgumentParser(description="Popola il DB con dati fittizi.")
    parser.add_argument("--clienti", type=int, default=2000)
    parser.add_argument("--rit", type=int, default=1000)
    parser.add_argument("--ddt", type=int, default=1000)
    args = parser.parse_args()

    db = SessionLocal()
    try:
        tecnico_id = pick_or_create_tecnico(db)

        clienti = build_clienti(args.clienti)
        chunked_save(db, clienti, chunk_size=500)

        # ricarica per avere gli id
        clienti_db = db.query(Cliente).order_by(Cliente.id.asc()).all()

        interventi = build_interventi(args.rit, clienti_db, tecnico_id)
        chunked_save(db, interventi, chunk_size=500)

        ddt_list = build_ddt(args.ddt, clienti_db, tecnico_id)
        chunked_save(db, ddt_list, chunk_size=500)

        print(f"Inseriti clienti={args.clienti}, rit={args.rit}, ddt={args.ddt}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
