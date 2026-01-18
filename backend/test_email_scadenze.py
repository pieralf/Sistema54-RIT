"""
Script di test per verificare l'invio delle email di scadenza contratti e letture copie
"""
import sys
import os
from datetime import datetime, timedelta

# Aggiungi il percorso dell'app al PYTHONPATH
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app import models
from app.main import check_scadenze_contratti, check_scadenze_letture_copie


def _get_alert_days(settings, prefix: str, defaults: list) -> list:
    if not settings:
        return defaults
    days = [
        getattr(settings, f"{prefix}_giorni_1", None),
        getattr(settings, f"{prefix}_giorni_2", None),
        getattr(settings, f"{prefix}_giorni_3", None),
    ]
    valid = sorted({d for d in days if isinstance(d, int) and d > 0})
    return valid or defaults

def test_scadenza_contratto_noleggio():
    """Test invio email scadenza contratto noleggio"""
    print("\n" + "="*60)
    print("TEST: Scadenza Contratto Noleggio")
    print("="*60)
    
    db = SessionLocal()
    try:
        # Trova un cliente esistente o crea uno di test
        cliente = db.query(models.Cliente).first()
        if not cliente:
            print("❌ Nessun cliente trovato nel database. Crea almeno un cliente prima di eseguire il test.")
            return
        
        print(f"✓ Cliente trovato: {cliente.ragione_sociale} (ID: {cliente.id})")
        
        # Verifica che il cliente abbia multisede attivata
        if not cliente.has_multisede:
            print("⚠️  Il cliente non ha multisede. Attivando multisede per il test...")
            cliente.has_multisede = True
            db.commit()
        
        # Crea o trova una sede
        sede = db.query(models.SedeCliente).filter(
            models.SedeCliente.cliente_id == cliente.id
        ).first()
        
        if not sede:
            print("⚠️  Nessuna sede trovata. Creando una sede di test...")
            sede = models.SedeCliente(
                cliente_id=cliente.id,
                nome_sede="Sede Test",
                indirizzo_completo="Via Test 123, Milano",
                email="test-sede@example.com"  # Email di test per la sede
            )
            db.add(sede)
            db.commit()
            db.refresh(sede)
            print(f"✓ Sede creata: {sede.nome_sede} (ID: {sede.id})")
        else:
            print(f"✓ Sede trovata: {sede.nome_sede} (ID: {sede.id})")
        
        settings = db.query(models.ImpostazioniAzienda).first()
        alert_days = _get_alert_days(settings, "contratti_alert", [30, 60, 90])
        target_days = alert_days[0]

        # Crea o trova un asset Printing con scadenza nei giorni di alert
        asset = db.query(models.AssetCliente).filter(
            models.AssetCliente.cliente_id == cliente.id,
            models.AssetCliente.tipo_asset == "Printing"
        ).first()
        
        if asset:
            # Aggiorna la data di scadenza al primo alert configurato
            asset.data_scadenza_noleggio = datetime.now() + timedelta(days=target_days)
            asset.sede_id = sede.id  # Associa alla sede
            db.commit()
            print(f"✓ Asset aggiornato: {asset.marca} {asset.modello} - Scade tra {target_days} giorni")
        else:
            # Crea un nuovo asset di test
            asset = models.AssetCliente(
                cliente_id=cliente.id,
                sede_id=sede.id,
                tipo_asset="Printing",
                marca="HP",
                modello="LaserJet Pro",
                matricola="TEST123",
                data_scadenza_noleggio=datetime.now() + timedelta(days=target_days),
                is_colore=False,
                tipo_formato="A4"
            )
            db.add(asset)
            db.commit()
            db.refresh(asset)
            print(f"✓ Asset creato: {asset.marca} {asset.modello} - Scade tra {target_days} giorni")
        
        # Verifica impostazioni email
        if not settings or not settings.contratti_alert_emails:
            print("⚠️  Email alert contratti non configurate nelle impostazioni.")
            print("   Configura 'contratti_alert_emails' nelle impostazioni azienda per ricevere le email.")
        
        print("\n📧 Eseguendo controllo scadenze contratti...")
        print("-" * 60)
        
        # Esegui il controllo scadenze
        check_scadenze_contratti()
        
        print("-" * 60)
        print("✓ Test completato!")
        print("\nVerifica:")
        print(f"  1. Email all'azienda: {settings.contratti_alert_emails if settings else 'NON CONFIGURATA'}")
        print(f"  2. Email al cliente: {cliente.email_amministrazione or 'NON CONFIGURATA'}")
        print(f"  3. Email alla sede: {sede.email}")
        
    except Exception as e:
        print(f"❌ Errore durante il test: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

def test_scadenza_contratto_assistenza():
    """Test invio email scadenza contratto assistenza"""
    print("\n" + "="*60)
    print("TEST: Scadenza Contratto Assistenza")
    print("="*60)
    
    db = SessionLocal()
    try:
        # Trova un cliente esistente
        cliente = db.query(models.Cliente).first()
        if not cliente:
            print("❌ Nessun cliente trovato nel database.")
            return
        
        print(f"✓ Cliente trovato: {cliente.ragione_sociale} (ID: {cliente.id})")
        
        settings = db.query(models.ImpostazioniAzienda).first()
        alert_days = _get_alert_days(settings, "contratti_alert", [30, 60, 90])
        target_days = alert_days[0]

        # Attiva contratto assistenza e imposta scadenza ai giorni configurati
        cliente.has_contratto_assistenza = True
        cliente.data_fine_contratto_assistenza = datetime.now() + timedelta(days=target_days)
        db.commit()
        print(f"✓ Contratto assistenza attivato - Scade tra {target_days} giorni")
        
        if not settings or not settings.contratti_alert_emails:
            print("⚠️  Email alert contratti non configurate nelle impostazioni.")
        
        print("\n📧 Eseguendo controllo scadenze contratti...")
        print("-" * 60)
        
        # Esegui il controllo scadenze
        check_scadenze_contratti()
        
        print("-" * 60)
        print("✓ Test completato!")
        print("\nVerifica:")
        print(f"  1. Email all'azienda: {settings.contratti_alert_emails if settings else 'NON CONFIGURATA'}")
        print(f"  2. Email al cliente: {cliente.email_amministrazione or 'NON CONFIGURATA'}")
        
        # Verifica sedi del cliente
        sedi = db.query(models.SedeCliente).filter(
            models.SedeCliente.cliente_id == cliente.id
        ).all()
        if sedi:
            print(f"  3. Email alle sedi ({len(sedi)} sedi con email):")
            for sede in sedi:
                if sede.email:
                    print(f"     - {sede.nome_sede}: {sede.email}")
        
    except Exception as e:
        print(f"❌ Errore durante il test: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

def test_scadenza_letture_copie():
    """Test invio email scadenza letture copie"""
    print("\n" + "="*60)
    print("TEST: Scadenza Letture Copie (7 giorni prima dei 3 mesi)")
    print("="*60)
    
    db = SessionLocal()
    try:
        # Trova un asset Printing esistente
        asset = db.query(models.AssetCliente).filter(
            models.AssetCliente.tipo_asset == "Printing"
        ).first()
        
        if not asset:
            print("❌ Nessun asset Printing trovato nel database.")
            print("   Crea almeno un prodotto Printing a noleggio prima di eseguire il test.")
            return
        
        cliente = db.query(models.Cliente).filter(models.Cliente.id == asset.cliente_id).first()
        print(f"✓ Asset trovato: {asset.marca} {asset.modello} (Cliente: {cliente.ragione_sociale})")
        
        settings = db.query(models.ImpostazioniAzienda).first()
        alert_days = _get_alert_days(settings, "letture_copie_alert", [7, 14, 30])

        # Calcola una data lettura per far scattare l'alert nei giorni configurati
        cadenza = asset.cadenza_letture_copie or "trimestrale"
        giorni_cadenza = 30 if cadenza == "mensile" else 60 if cadenza == "bimestrale" else 90 if cadenza == "trimestrale" else 180

        for target_days in alert_days:
            data_lettura = datetime.now() + timedelta(days=target_days) - timedelta(days=giorni_cadenza)

            lettura = models.LetturaCopie(
                asset_id=asset.id,
                data_lettura=data_lettura,
                contatore_bn=1000,
                contatore_colore=500 if asset.is_colore else None,
                tecnico_id=1  # Assumendo che esista almeno un utente con ID 1
            )
            db.add(lettura)
            db.commit()
            db.refresh(lettura)

            print(f"✓ Lettura copie creata (alert a {target_days} giorni):")
            print(f"   Data lettura: {data_lettura.strftime('%d/%m/%Y')}")
            print(f"   Contatore B/N: {lettura.contatore_bn}")
            if lettura.contatore_colore:
                print(f"   Contatore Colore: {lettura.contatore_colore}")
            print(f"   Prossima lettura dovuta: {(data_lettura + timedelta(days=giorni_cadenza)).strftime('%d/%m/%Y')}")
            print(f"   Alert inviato a {target_days} giorni dalla scadenza (oggi)")

            print("\n📧 Eseguendo controllo scadenze letture copie...")
            print("-" * 60)
            check_scadenze_letture_copie()
            print("-" * 60)
        
        if not settings or not settings.letture_copie_alert_emails:
            print("\n⚠️  Email alert letture copie non configurate nelle impostazioni.")
            print("   Configura 'letture_copie_alert_emails' nelle impostazioni azienda per ricevere le email.")
        
        print("✓ Test completato!")
        print("\nVerifica:")
        print(f"  Email alert letture copie: {settings.letture_copie_alert_emails if settings else 'NON CONFIGURATA'}")
        
    except Exception as e:
        print(f"❌ Errore durante il test: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    print("\n" + "="*60)
    print("TEST INVIO EMAIL SCADENZE")
    print("="*60)
    print("\nQuesto script testerà l'invio delle email per:")
    print("  1. Scadenza contratto noleggio")
    print("  2. Scadenza contratto assistenza")
    print("  3. Scadenza letture copie")
    print("\nAssicurati di aver configurato:")
    print("  - Contatto/i e-mail Scadenze Contratti")
    print("  - Contatto/i e-mail Letture Copie")
    print("  - Configurazione SMTP nelle impostazioni azienda")
    print("  - Almeno un cliente nel database")
    print("  - Email del cliente principale (email_amministrazione)")
    
    print("\nAvvio dei test in 2 secondi...")
    import time
    time.sleep(2)
    
    # Test 1: Scadenza contratto noleggio
    test_scadenza_contratto_noleggio()
    
    # Test 2: Scadenza contratto assistenza
    test_scadenza_contratto_assistenza()
    
    # Test 3: Scadenza letture copie
    test_scadenza_letture_copie()
    
    print("\n" + "="*60)
    print("TUTTI I TEST COMPLETATI")
    print("="*60)
    print("\nControlla:")
    print("  1. I log del backend per eventuali errori")
    print("  2. Le caselle email configurate per ricevere le notifiche")
    print("  3. La console per messaggi di errore durante l'invio")
    print("\nSe le email non arrivano:")
    print("  - Verifica la configurazione SMTP nelle impostazioni")
    print("  - Controlla i log del backend per errori di connessione SMTP")
    print("  - Verifica che le email di destinazione siano corrette")

