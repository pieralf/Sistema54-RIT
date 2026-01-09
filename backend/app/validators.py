"""
Validatori per Codice Fiscale e Partita IVA italiana
"""

import re
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