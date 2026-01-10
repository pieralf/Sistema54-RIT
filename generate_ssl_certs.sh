#!/bin/bash
# Script per generare certificati SSL auto-firmati validi per 10 anni

set -e

CERT_DIR="nginx/ssl"
DOMAIN="${SSL_DOMAIN:-localhost}"
DAYS_VALID=3650  # 10 anni

# Crea directory per i certificati
mkdir -p "$CERT_DIR"

echo "Generazione certificati SSL per dominio: $DOMAIN"
echo "Validità: 10 anni (3650 giorni)"

# Genera chiave privata
openssl genrsa -out "$CERT_DIR/key.pem" 2048

# Genera certificato auto-firmato valido per 10 anni
openssl req -new -x509 -key "$CERT_DIR/key.pem" -out "$CERT_DIR/cert.pem" -days $DAYS_VALID \
    -subj "/C=IT/ST=Italy/L=Italy/O=GIT/OU=IT Department/CN=$DOMAIN" \
    -addext "subjectAltName=DNS:$DOMAIN,DNS:*.$DOMAIN,DNS:localhost,DNS:*.local,IP:127.0.0.1"

echo "✅ Certificati generati con successo!"
echo ""
echo "File generati:"
echo "  - $CERT_DIR/key.pem (chiave privata)"
echo "  - $CERT_DIR/cert.pem (certificato)"
echo ""
echo "Valido fino a: $(openssl x509 -in "$CERT_DIR/cert.pem" -noout -enddate | cut -d= -f2)"
echo ""
echo "⚠️  NOTA: Questi sono certificati auto-firmati. I browser mostreranno un avviso di sicurezza."
echo "   Per produzione, considera l'uso di Let's Encrypt o certificati firmati da una CA."
