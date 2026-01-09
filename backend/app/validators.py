"""
Validatori per Codice Fiscale e Partita IVA italiana
Funzioni di sanitizzazione per prevenire XSS
"""

import re
import html
from typing import Optional


def validate_partita_iva(p_iva: str) -> tuple[bool, Optional[str]]:
    """
    Valida una Partita IVA italiana.
    
    La Partita IVA italiana è composta da 11 cifre.
    Il controllo viene effettuato sul carattere di controllo (ultima cifra).
    
    Args:
        p_iva: Partita IVA da validare
        
    Returns:
        (is_valid, error_message): Tupla con risultato validazione e eventuale messaggio errore
    """
    if not p_iva:
        return True, None  # P.IVA è opzionale
    
    # Rimuovi spazi e converti in maiuscolo
    p_iva_clean = p_iva.strip().upper().replace(' ', '')
    
    # Deve essere composta solo da cifre
    if not p_iva_clean.isdigit():
        return False, "La Partita IVA deve contenere solo numeri"
    
    # Deve essere esattamente 11 caratteri
    if len(p_iva_clean) != 11:
        return False, "La Partita IVA deve essere composta da 11 cifre"
    
    # Algoritmo di controllo Partita IVA italiana
    # Somma ponderata delle prime 10 cifre
    somma = 0
    for i in range(10):
        cifra = int(p_iva_clean[i])
        if i % 2 == 0:  # Posizioni dispari (0-indexed): moltiplica per 1
            somma += cifra
        else:  # Posizioni pari (0-indexed): moltiplica per 2 e somma le cifre del risultato
            doppio = cifra * 2
            somma += (doppio // 10) + (doppio % 10)
    
    # Calcola il resto della divisione per 10
    resto = somma % 10
    
    # Il carattere di controllo è (10 - resto) % 10
    controllo = (10 - resto) % 10
    
    # Verifica che l'ultima cifra corrisponda al carattere di controllo
    ultima_cifra = int(p_iva_clean[10])
    if controllo != ultima_cifra:
        return False, "Partita IVA non valida: carattere di controllo errato"
    
    return True, None


def validate_codice_fiscale(cf: str) -> tuple[bool, Optional[str]]:
    """
    Valida un Codice Fiscale italiano (sia per privati che per aziende).
    
    Per privati: 16 caratteri alfanumerici con algoritmo di controllo specifico
    Per aziende: 11 caratteri numerici (come P.IVA) oppure formato diverso
    
    Args:
        cf: Codice Fiscale da validare
        
    Returns:
        (is_valid, error_message): Tupla con risultato validazione e eventuale messaggio errore
    """
    if not cf:
        return True, None  # Codice Fiscale è opzionale
    
    # Rimuovi spazi e converti in maiuscolo
    cf_clean = cf.strip().upper().replace(' ', '')
    
    # Tabella per la conversione dei caratteri dispari
    tabella_dispari = {
        '0': 1, '1': 0, '2': 5, '3': 7, '4': 9, '5': 13, '6': 15, '7': 17, '8': 19, '9': 21,
        'A': 1, 'B': 0, 'C': 5, 'D': 7, 'E': 9, 'F': 13, 'G': 15, 'H': 17, 'I': 19, 'J': 21,
        'K': 2, 'L': 4, 'M': 18, 'N': 20, 'O': 11, 'P': 3, 'Q': 6, 'R': 8, 'S': 12, 'T': 14,
        'U': 16, 'V': 10, 'W': 22, 'X': 25, 'Y': 24, 'Z': 23
    }
    
    # Tabella per la conversione dei caratteri pari
    tabella_pari = {
        '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
        'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4, 'F': 5, 'G': 6, 'H': 7, 'I': 8, 'J': 9,
        'K': 10, 'L': 11, 'M': 12, 'N': 13, 'O': 14, 'P': 15, 'Q': 16, 'R': 17, 'S': 18,
        'T': 19, 'U': 20, 'V': 21, 'W': 22, 'X': 23, 'Y': 24, 'Z': 25
    }
    
    # Carattere di controllo
    tabella_controllo = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    
    # Controlla la lunghezza
    if len(cf_clean) == 16:
        # Codice Fiscale per privati (16 caratteri)
        # Verifica formato: primi 6 caratteri lettere (cognome), prossimi 2 numeri (anno), 
        # prossimo 1 lettera (mese), prossimi 2 numeri (giorno), prossimi 4 caratteri (comune), ultimo 1 lettera (controllo)
        
        # Verifica che contenga solo caratteri alfanumerici
        if not re.match(r'^[A-Z0-9]{16}$', cf_clean):
            return False, "Il Codice Fiscale deve contenere solo caratteri alfanumerici (16 caratteri)"
        
        # Algoritmo di controllo Codice Fiscale
        somma = 0
        for i in range(15):  # Primi 15 caratteri
            carattere = cf_clean[i]
            if (i + 1) % 2 == 1:  # Posizioni dispari (1-indexed)
                somma += tabella_dispari.get(carattere, 0)
            else:  # Posizioni pari (1-indexed)
                somma += tabella_pari.get(carattere, 0)
        
        # Il carattere di controllo è il resto della divisione per 26
        resto = somma % 26
        carattere_controllo = tabella_controllo[resto]
        
        # Verifica che l'ultimo carattere corrisponda
        if cf_clean[15] != carattere_controllo:
            return False, "Codice Fiscale non valido: carattere di controllo errato"
        
        return True, None
        
    elif len(cf_clean) == 11:
        # Per le aziende, il Codice Fiscale può essere uguale alla Partita IVA (11 cifre)
        # Usa la stessa validazione della P.IVA
        return validate_partita_iva(cf_clean)
    else:
        return False, "Il Codice Fiscale deve essere di 16 caratteri (privati) o 11 cifre (aziende)"


def sanitize_input(text: Optional[str], max_length: Optional[int] = None) -> Optional[str]:
    """
    Sanitizza input utente per prevenire attacchi XSS.
    
    - Escape HTML characters per prevenire injection
    - Rimuove tag script e javascript: URL pericolosi
    - Limita la lunghezza se specificato
    - Rimuove caratteri di controllo non validi
    
    Args:
        text: Testo da sanitizzare (può essere None)
        max_length: Lunghezza massima consentita (None = nessun limite)
        
    Returns:
        Testo sanitizzato o None se input era None
    """
    if text is None:
        return None
    
    if not isinstance(text, str):
        # Converti a stringa se non lo è già
        text = str(text)
    
    # Rimuovi caratteri di controllo non validi (mantieni tab, newline, carriage return)
    # Rimuovi caratteri Unicode non validi
    text = ''.join(char for char in text if ord(char) >= 32 or char in '\t\n\r')
    
    # Rimuovi tag script e javascript: URL (case insensitive)
    text = re.sub(r'<script[^>]*>.*?</script>', '', text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r'javascript:', '', text, flags=re.IGNORECASE)
    text = re.sub(r'on\w+\s*=', '', text, flags=re.IGNORECASE)  # Rimuovi event handlers (onclick, onload, ecc.)
    
    # Escape HTML per prevenire XSS (converte <, >, &, ", ' in entità HTML)
    text = html.escape(text, quote=True)
    
    # Rimuovi eventuali doppi escape (se applicato più volte)
    text = text.replace('&amp;', '&amp;')  # Mantieni &amp; corretto
    
    # Limita la lunghezza se specificato
    if max_length and len(text) > max_length:
        text = text[:max_length]
    
    # Trim spazi iniziali/finali
    text = text.strip()
    
    # Se il testo è vuoto dopo la sanitizzazione, restituisci None
    if not text:
        return None
    
    return text


def sanitize_email(email: Optional[str]) -> Optional[str]:
    """
    Sanitizza un indirizzo email rimuovendo caratteri pericolosi ma mantenendo il formato email valido.
    
    Args:
        email: Indirizzo email da sanitizzare
        
    Returns:
        Email sanitizzata o None se input era None/vuoto
    """
    if not email:
        return None
    
    if not isinstance(email, str):
        email = str(email)
    
    # Trim e lowercase per normalizzazione
    email = email.strip().lower()
    
    # Rimuovi caratteri di controllo e whitespace non validi
    email = re.sub(r'[\s\r\n\t]+', '', email)
    
    # Verifica formato email base (non validazione completa, solo sanitizzazione)
    # Rimuovi caratteri pericolosi ma mantieni formato email
    email = re.sub(r'[<>"\'&;]', '', email)
    
    if not email or '@' not in email:
        return None
    
    return email


def sanitize_text_field(text: Optional[str], allow_html: bool = False, max_length: Optional[int] = None) -> Optional[str]:
    """
    Sanitizza un campo di testo generico.
    
    Args:
        text: Testo da sanitizzare
        allow_html: Se True, mantiene HTML sicuro (solo tag whitelist). Se False, escape tutto.
        max_length: Lunghezza massima
        
    Returns:
        Testo sanitizzato
    """
    if not text:
        return None
    
    if allow_html:
        # TODO: Implementare whitelist HTML se necessario in futuro
        # Per ora, se allow_html è True, applica solo rimozione script/javascript
        text = re.sub(r'<script[^>]*>.*?</script>', '', str(text), flags=re.IGNORECASE | re.DOTALL)
        text = re.sub(r'javascript:', '', text, flags=re.IGNORECASE)
        text = re.sub(r'on\w+\s*=', '', text, flags=re.IGNORECASE)
    else:
        # Escape completo per sicurezza massima
        text = sanitize_input(text, max_length=max_length)
    
    return text