"""
Servizio per l'invio di email
"""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr
from typing import Optional, List, Dict, Any
import os
from sqlalchemy.orm import Session
from .. import models

def get_smtp_config(db: Session) -> dict:
    """Ottiene la configurazione SMTP dalle impostazioni azienda"""
    settings = db.query(models.ImpostazioniAzienda).first()
    if not settings:
        return {}
    
    return {
        'host': settings.smtp_server or os.getenv("SMTP_HOST", "smtp.gmail.com"),
        'port': settings.smtp_port or int(os.getenv("SMTP_PORT", "587")),
        'username': settings.smtp_username or os.getenv("SMTP_USER", ""),
        'password': settings.smtp_password or os.getenv("SMTP_PASSWORD", ""),
        'use_tls': settings.smtp_use_tls if settings.smtp_use_tls is not None else True,
        'from_email': settings.smtp_username or settings.email or os.getenv("SMTP_FROM", "")
    }

def send_email(
    to_email: str,
    subject: str,
    body_html: str,
    body_text: Optional[str] = None,
    db: Optional[Session] = None,
    from_name: Optional[str] = None
) -> bool:
    """
    Invia un'email usando SMTP
    
    Args:
        to_email: Email destinatario
        subject: Oggetto email
        body_html: Corpo email in HTML
        body_text: Corpo email in testo (opzionale)
        db: Sessione database per ottenere configurazione SMTP (opzionale)
    
    Returns:
        True se inviata con successo, False altrimenti
    """
    # Ottieni configurazione SMTP
    if db:
        smtp_config = get_smtp_config(db)
        smtp_host = smtp_config.get('host', os.getenv("SMTP_HOST", "smtp.gmail.com"))
        smtp_port = smtp_config.get('port', int(os.getenv("SMTP_PORT", "587")))
        smtp_user = smtp_config.get('username', os.getenv("SMTP_USER", ""))
        smtp_password = smtp_config.get('password', os.getenv("SMTP_PASSWORD", ""))
        smtp_from = smtp_config.get('from_email', smtp_user)
        use_tls = smtp_config.get('use_tls', True)
    else:
        smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
        smtp_port = int(os.getenv("SMTP_PORT", "587"))
        smtp_user = os.getenv("SMTP_USER", "")
        smtp_password = os.getenv("SMTP_PASSWORD", "")
        smtp_from = os.getenv("SMTP_FROM", smtp_user)
        use_tls = True
    
    # Se non configurato, usa mock
    if not smtp_user or not smtp_password:
        print(f"--- [EMAIL MOCK] ---")
        print(f"TO: {to_email}")
        if from_name:
            print(f"FROM NAME: {from_name}")
        print(f"SUBJECT: {subject}")
        print(f"BODY: {body_text or body_html[:200]}...")
        print("--------------------")
        return True
    
    try:
        # Crea messaggio
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = formataddr((from_name, smtp_from)) if from_name else smtp_from
        msg['To'] = to_email
        
        # Aggiungi corpo
        if body_text:
            part1 = MIMEText(body_text, 'plain')
            msg.attach(part1)
        
        part2 = MIMEText(body_html, 'html')
        msg.attach(part2)
        
        # Invia email
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            if use_tls:
                server.starttls()
            server.login(smtp_user, smtp_password)
            server.send_message(msg)
        
        print(f"Email inviata con successo a {to_email}")
        return True
        
    except Exception as e:
        print(f"Errore invio email a {to_email}: {str(e)}")
        return False

def generate_scadenza_contratto_email(
    cliente_nome: str,
    tipo_contratto: str,  # "noleggio" o "assistenza"
    giorni_alla_scadenza: int,
    azienda_nome: str,
    azienda_telefono: str,
    azienda_email: str,
    asset_info: Optional[dict] = None,  # Per noleggio
    contratto_info: Optional[dict] = None,  # Per assistenza
    sede_info: Optional[dict] = None  # Info sulla sede se disponibile
) -> tuple[str, str]:
    """
    Genera il contenuto email per notifica scadenza contratto (noleggio o assistenza)
    
    Args:
        cliente_nome: Nome del cliente
        tipo_contratto: "noleggio" o "assistenza"
        asset_info: Dict con info asset (per noleggio)
        contratto_info: Dict con info contratto (per assistenza)
        giorni_alla_scadenza: Giorni rimanenti alla scadenza
        azienda_nome: Nome azienda
        azienda_telefono: Telefono azienda
        azienda_email: Email azienda
        sede_info: Dict con info sede (nome, indirizzo, email) se disponibile
    
    Returns:
        (subject, body_html)
    """
    if tipo_contratto == "noleggio" and asset_info:
        tipo_macchina = asset_info.get('tipo_asset', 'Macchina')
        nome_macchina = ""
        if tipo_macchina == 'Printing':
            nome_macchina = f"{asset_info.get('marca', '')} {asset_info.get('modello', '')}".strip()
        else:
            nome_macchina = asset_info.get('descrizione', 'Prodotto IT')
        
        data_scadenza = asset_info.get('data_scadenza_noleggio', '')
        if data_scadenza:
            try:
                from datetime import datetime
                if isinstance(data_scadenza, str):
                    data_scadenza = datetime.fromisoformat(data_scadenza.replace('Z', '+00:00'))
                data_formattata = data_scadenza.strftime('%d/%m/%Y')
            except:
                data_formattata = str(data_scadenza)
        else:
            data_formattata = "Non specificata"
        
        subject = f"Avviso Scadenza Contratto Noleggio - {nome_macchina}"
        tipo_contratto_label = "Noleggio"
        dettagli_contratto = f"""
                    <div class="info-box">
                        <strong>Macchina:</strong> {nome_macchina}<br>
                        <strong>Data Scadenza:</strong> {data_formattata}<br>
                        <strong>Giorni Rimanenti:</strong> {giorni_alla_scadenza}
                    </div>
        """
    elif tipo_contratto == "assistenza" and contratto_info:
        data_scadenza = contratto_info.get('data_fine_contratto_assistenza', '')
        if data_scadenza:
            try:
                from datetime import datetime
                if isinstance(data_scadenza, str):
                    data_scadenza = datetime.fromisoformat(data_scadenza.replace('Z', '+00:00'))
                data_formattata = data_scadenza.strftime('%d/%m/%Y')
            except:
                data_formattata = str(data_scadenza)
        else:
            data_formattata = "Non specificata"
        
        subject = f"Avviso Scadenza Contratto Assistenza - {cliente_nome}"
        tipo_contratto_label = "Assistenza"
        dettagli_contratto = f"""
                    <div class="info-box">
                        <strong>Data Scadenza:</strong> {data_formattata}<br>
                        <strong>Giorni Rimanenti:</strong> {giorni_alla_scadenza}
                    </div>
        """
    else:
        return "", ""
    
    # Info sede se disponibile
    info_sede = ""
    if sede_info:
        info_sede = f"""
                    <div class="info-box" style="background-color: #e0f2fe; border-left-color: #0284c7;">
                        <strong>Sede di Ubicazione:</strong><br>
                        {sede_info.get('nome_sede', 'N/A')}<br>
                        {sede_info.get('indirizzo_completo', '')}
                    </div>
        """
    
    body_html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }}
            .content {{ background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }}
            .footer {{ background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 5px 5px; }}
            .info-box {{ background-color: #fff; border-left: 4px solid #4F46E5; padding: 15px; margin: 20px 0; }}
            .button {{ display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-top: 20px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Avviso Scadenza Contratto {tipo_contratto_label}</h1>
            </div>
            <div class="content">
                <p>Gentile {cliente_nome},</p>
                
                <p>Le comunichiamo che il contratto di {tipo_contratto_label.lower()} è in scadenza:</p>
                
                {dettagli_contratto}
                
                {info_sede}
                
                <p>La scadenza è prevista tra <strong>{giorni_alla_scadenza} giorni</strong>. Per garantire la continuità del servizio, 
                la invitiamo a contattarci per richiedere un nuovo preventivo o rinnovare il contratto.</p>
                
                <p>I nostri contatti:</p>
                <ul>
                    <li><strong>Telefono:</strong> {azienda_telefono or 'Non disponibile'}</li>
                    <li><strong>Email:</strong> {azienda_email or 'Non disponibile'}</li>
                </ul>
                
                <p>Restiamo a disposizione per qualsiasi chiarimento.</p>
                
                <p>Cordiali saluti,<br>
                <strong>{azienda_nome}</strong></p>
            </div>
            <div class="footer">
                <p>Questa è una comunicazione automatica. Si prega di non rispondere a questa email.</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    # Prepara dettagli per testo semplice
    dettagli_testo = dettagli_contratto.replace('<div class="info-box">', '').replace('</div>', '').replace('<br>', '\n').replace('<strong>', '').replace('</strong>', '')
    info_sede_testo = ''
    if info_sede:
        info_sede_testo = info_sede.replace('<div class="info-box" style="background-color: #e0f2fe; border-left-color: #0284c7;">', '').replace('</div>', '').replace('<br>', '\n').replace('<strong>', '').replace('</strong>', '')
    
    body_text = f"""Avviso Scadenza Contratto {tipo_contratto_label}

Gentile {cliente_nome},

Le comunichiamo che il contratto di {tipo_contratto_label.lower()} è in scadenza.

{dettagli_testo}

{info_sede_testo}

La scadenza è prevista tra {giorni_alla_scadenza} giorni. Per garantire la continuità del servizio, 
la invitiamo a contattarci per richiedere un nuovo preventivo o rinnovare il contratto.

I nostri contatti:
- Telefono: {azienda_telefono or 'Non disponibile'}
- Email: {azienda_email or 'Non disponibile'}

Restiamo a disposizione per qualsiasi chiarimento.

Cordiali saluti,
{azienda_nome}

---
Questa è una comunicazione automatica. Si prega di non rispondere a questa email.
    """
    
    return subject, body_html

# Manteniamo la funzione vecchia per compatibilità
def generate_scadenza_noleggio_email(
    cliente_nome: str,
    asset_info: dict,
    azienda_nome: str,
    azienda_telefono: str,
    azienda_email: str
) -> tuple[str, str]:
    """Wrapper per compatibilità con codice esistente"""
    return generate_scadenza_contratto_email(
        cliente_nome=cliente_nome,
        tipo_contratto="noleggio",
        giorni_alla_scadenza=30,
        azienda_nome=azienda_nome,
        azienda_telefono=azienda_telefono,
        azienda_email=azienda_email,
        asset_info=asset_info
    )

def generate_alert_letture_copie_email(
    cliente_nome: str,
    cliente_id: int,
    assets_info: list,
    azienda_nome: str
) -> tuple[str, str]:
    """
    Genera il contenuto email per alert letture copie (7 giorni prima della scadenza basata sulla cadenza configurata)
    
    Args:
        cliente_nome: Nome del cliente
        cliente_id: ID del cliente
        assets_info: Lista di dict con info asset (marca, modello, matricola, data_ultima_lettura, cadenza, prossima_lettura_dovuta)
        azienda_nome: Nome azienda
    
    Returns:
        (subject, body_html)
    """
    subject = f"Promemoria: Lettura Copie Scadente - {cliente_nome}"
    
    assets_html = ""
    for asset in assets_info:
        data_ultima = asset.get('data_ultima_lettura', '')
        if isinstance(data_ultima, str):
            try:
                from datetime import datetime
                data_ultima = datetime.fromisoformat(data_ultima.replace('Z', '+00:00'))
                data_formattata = data_ultima.strftime('%d/%m/%Y')
            except:
                data_formattata = str(data_ultima)
        else:
            data_formattata = data_ultima.strftime('%d/%m/%Y') if hasattr(data_ultima, 'strftime') else str(data_ultima)
        
        cadenza = asset.get('cadenza', 'trimestrale')
        cadenza_label = {
            'mensile': 'Mensile (30 giorni)',
            'bimestrale': 'Bimestrale (60 giorni)',
            'trimestrale': 'Trimestrale (90 giorni)',
            'semestrale': 'Semestrale (180 giorni)'
        }.get(cadenza, 'Trimestrale (90 giorni)')
        
        prossima_lettura = asset.get('prossima_lettura_dovuta', '')
        if prossima_lettura:
            if isinstance(prossima_lettura, str):
                try:
                    from datetime import datetime
                    prossima_lettura = datetime.fromisoformat(prossima_lettura.replace('Z', '+00:00'))
                    prossima_formattata = prossima_lettura.strftime('%d/%m/%Y')
                except:
                    prossima_formattata = str(prossima_lettura)
            else:
                prossima_formattata = prossima_lettura.strftime('%d/%m/%Y') if hasattr(prossima_lettura, 'strftime') else str(prossima_lettura)
        else:
            prossima_formattata = 'N/A'
        
        assets_html += f"""
        <div class="info-box">
            <strong>{asset.get('marca', '')} {asset.get('modello', '')}</strong><br>
            Matricola: {asset.get('matricola', 'N/A')}<br>
            Cadenza: {cadenza_label}<br>
            Ultima lettura: {data_formattata}<br>
            Prossima lettura dovuta entro: {prossima_formattata}
        </div>
        """
    
    body_html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background-color: #10B981; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }}
            .content {{ background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }}
            .footer {{ background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 5px 5px; }}
            .info-box {{ background-color: #fff; border-left: 4px solid #10B981; padding: 15px; margin: 20px 0; }}
            .button {{ display: inline-block; background-color: #10B981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-top: 20px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Promemoria Lettura Copie</h1>
            </div>
            <div class="content">
                <p>Gentile team,</p>
                
                <p>Si ricorda che per il cliente <strong>{cliente_nome}</strong> (ID: {cliente_id}) 
                sono in scadenza le letture copie per le seguenti macchine a noleggio:</p>
                
                {assets_html}
                
                <p>La prossima lettura può essere effettuata tra <strong>7 giorni</strong> (completata la cadenza configurata dall'ultima lettura).</p>
                
                <p>Si prega di prendere appuntamento con il cliente entro i prossimi 7 giorni per effettuare il prelievo delle copie.</p>
                
                <p>Cordiali saluti,<br>
                <strong>{azienda_nome}</strong></p>
            </div>
            <div class="footer">
                <p>Questa è una comunicazione automatica. Si prega di non rispondere a questa email.</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    body_text = f"""
Promemoria Lettura Copie

Gentile team,

Si ricorda che per il cliente {cliente_nome} (ID: {cliente_id}) 
sono in scadenza le letture copie per le seguenti macchine a noleggio:

{chr(10).join([f"- {a.get('marca', '')} {a.get('modello', '')} (Matricola: {a.get('matricola', 'N/A')}) - Ultima lettura: {a.get('data_ultima_lettura', 'N/A')}" for a in assets_info])}

La prossima lettura può essere effettuata tra 7 giorni (completati i 3 mesi dall'ultima lettura).

Si prega di prendere appuntamento con il cliente entro i prossimi 7 giorni per effettuare il prelievo delle copie.

Cordiali saluti,
{azienda_nome}

---
Questa è una comunicazione automatica. Si prega di non rispondere a questa email.
    """
    
    return subject, body_html


def generate_backup_notification_email(
    success: bool,
    backup_id: Optional[str] = None,
    file_size_mb: Optional[float] = None,
    upload_results: Optional[List[Dict[str, Any]]] = None,
    error: Optional[str] = None,
    azienda_nome: str = "GIT - Gestione Interventi Tecnici"
) -> tuple[str, str]:
    """
    Genera il contenuto email per notifica backup (successo o fallimento)
    
    Args:
        success: True se backup completato con successo, False se fallito
        backup_id: ID/nome del file backup (opzionale)
        file_size_mb: Dimensione file backup in MB (opzionale)
        upload_results: Lista risultati upload [{"name": str, "success": bool, "error": str?}] (opzionale)
        error: Messaggio di errore se fallito (opzionale)
        azienda_nome: Nome azienda
    
    Returns:
        (subject, body_html)
    """
    from datetime import datetime
    
    if success:
        subject = f"Backup GIT {azienda_nome} - Completato"
        
        # Genera lista completa di tutti i backup (locale + remoti) con icone
        destinations_html = ""
        destinations_items = []
        
        # Processa sempre tutti i risultati, anche se la lista è vuota aggiungi almeno il locale
        if upload_results and len(upload_results) > 0:
            for result in upload_results:
                name = result.get("name", "Unknown")
                if result.get("success", False):
                    # ✓ verde per successo
                    destinations_items.append(
                        f'<div class="dest-item success">'
                        f'<span class="icon">✓</span>'
                        f'<span class="name">{name}</span>'
                        f'</div>'
                    )
                else:
                    # ✗ rosso per errore
                    error_msg = result.get("error", "Errore sconosciuto")
                    # Estrai solo il messaggio principale dell'errore per rendere l'email più leggibile
                    if "ERROR" in error_msg:
                        lines = error_msg.split("\n")
                        for line in lines:
                            if "ERROR" in line or "Failed" in line:
                                # Estrai la parte rilevante dell'errore
                                error_parts = line.split(":")
                                if len(error_parts) > 1:
                                    error_msg = error_parts[-1].strip()
                                else:
                                    error_msg = line.strip()
                                break
                    # Limita la lunghezza del messaggio di errore
                    if len(error_msg) > 150:
                        error_msg = error_msg[:147] + "..."
                    destinations_items.append(
                        f'<div class="dest-item error">'
                        f'<span class="icon">✗</span>'
                        f'<span class="name">{name}</span>'
                        f'<div class="error-msg">{error_msg}</div>'
                        f'</div>'
                    )
        else:
            # Se non ci sono risultati, aggiungi almeno il backup locale come successo
            destinations_items.append(
                '<div class="dest-item success">'
                '<span class="icon">✓</span>'
                '<span class="name">Backup locale</span>'
                '</div>'
            )
        
        destinations_html = "\n".join(destinations_items)
        
        body_html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #10B981; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }}
                .content {{ background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }}
                .footer {{ background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 5px 5px; }}
                .destinations {{ background-color: #fff; padding: 20px; margin: 20px 0; border-radius: 5px; }}
                .dest-item {{ padding: 12px 0; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center; gap: 12px; }}
                .dest-item:last-child {{ border-bottom: none; }}
                .dest-item .icon {{ width: 22px; height: 22px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; font-size: 14px; font-weight: bold; color: #fff; flex-shrink: 0; }}
                .dest-item.success .icon {{ background-color: #10B981; }}
                .dest-item.error .icon {{ background-color: #EF4444; }}
                .dest-item .name {{ flex: 1; font-weight: 500; color: #374151; }}
                .dest-item .error-msg {{ font-size: 12px; color: #991B1B; margin-top: 4px; padding-left: 32px; font-family: monospace; }}
                .backup-info {{ background-color: #f3f4f6; padding: 15px; margin: 15px 0; border-radius: 5px; font-size: 14px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>✓ Backup Completato</h1>
                </div>
                <div class="content">
                    <p>Gentile team,</p>
                    
                    <div class="backup-info">
                        <strong>{backup_id or 'Backup'}</strong><br>
                        {f'{file_size_mb} MB • ' if file_size_mb else ''}{datetime.now().strftime('%d/%m/%Y %H:%M:%S')}
                    </div>
                    
                    <div class="destinations">
                        {destinations_html}
                    </div>
                    
                    <p style="margin-top: 20px;">Cordiali saluti,<br>
                    <strong>{azienda_nome}</strong></p>
                </div>
                <div class="footer">
                    <p>Questa è una comunicazione automatica. Si prega di non rispondere a questa email.</p>
                </div>
            </div>
        </body>
        </html>
        """
    else:
        subject = f"Backup GIT {azienda_nome} - Fallito"
        
        # Estrai solo il messaggio principale dell'errore
        error_display = error or 'Nessun dettaglio errore disponibile'
        if "ERROR" in error_display:
            lines = error_display.split("\n")
            for line in lines:
                if "ERROR" in line:
                    error_display = line.strip()
                    break
        
        body_html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #EF4444; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }}
                .content {{ background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }}
                .footer {{ background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 5px 5px; }}
                .error-box {{ background-color: #FEE2E2; border-left: 4px solid #EF4444; padding: 15px; margin: 20px 0; color: #991B1B; }}
                .error-icon {{ width: 54px; height: 54px; border-radius: 999px; background-color: #EF4444; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 28px; margin: 20px auto; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>✗ Backup Fallito</h1>
                </div>
                <div class="content">
                    <div class="error-icon">✗</div>
                    <p>Gentile team,</p>
                    
                    <p>Il backup del sistema <strong>{azienda_nome}</strong> è fallito.</p>
                    
                    <div class="error-box">
                        <strong>Errore:</strong><br>
                        {error_display}
                    </div>
                    
                    <p style="margin-top: 20px;">Cordiali saluti,<br>
                    <strong>{azienda_nome}</strong></p>
                </div>
                <div class="footer">
                    <p>Questa è una comunicazione automatica. Si prega di non rispondere a questa email.</p>
                </div>
            </div>
        </body>
        </html>
        """
    
    return subject, body_html
