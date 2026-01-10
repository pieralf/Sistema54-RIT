FROM nginx:alpine

# Installa OpenSSL per generare certificati se mancanti
RUN apk add --no-cache openssl

# Crea script di inizializzazione per generare certificati se mancano
RUN echo '#!/bin/sh' > /docker-entrypoint.d/99-generate-ssl-certs.sh && \
    echo 'if [ ! -f /etc/nginx/ssl/cert.pem ] || [ ! -f /etc/nginx/ssl/key.pem ]; then' >> /docker-entrypoint.d/99-generate-ssl-certs.sh && \
    echo '  echo "Generating self-signed SSL certificates..."' >> /docker-entrypoint.d/99-generate-ssl-certs.sh && \
    echo '  mkdir -p /etc/nginx/ssl' >> /docker-entrypoint.d/99-generate-ssl-certs.sh && \
    echo '  openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \' >> /docker-entrypoint.d/99-generate-ssl-certs.sh && \
    echo '    -keyout /etc/nginx/ssl/key.pem \' >> /docker-entrypoint.d/99-generate-ssl-certs.sh && \
    echo '    -out /etc/nginx/ssl/cert.pem \' >> /docker-entrypoint.d/99-generate-ssl-certs.sh && \
    echo '    -subj "/C=IT/ST=Italy/L=Italy/O=GIT/OU=IT Department/CN=localhost" \' >> /docker-entrypoint.d/99-generate-ssl-certs.sh && \
    echo '    -addext "subjectAltName=DNS:localhost,DNS:*.local,IP:127.0.0.1"' >> /docker-entrypoint.d/99-generate-ssl-certs.sh && \
    echo '  chmod 600 /etc/nginx/ssl/key.pem' >> /docker-entrypoint.d/99-generate-ssl-certs.sh && \
    echo '  chmod 644 /etc/nginx/ssl/cert.pem' >> /docker-entrypoint.d/99-generate-ssl-certs.sh && \
    echo '  echo "SSL certificates generated successfully (valid for 10 years)"' >> /docker-entrypoint.d/99-generate-ssl-certs.sh && \
    echo 'fi' >> /docker-entrypoint.d/99-generate-ssl-certs.sh && \
    chmod +x /docker-entrypoint.d/99-generate-ssl-certs.sh

# Copia configurazione nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Assicura che la directory SSL esista
RUN mkdir -p /etc/nginx/ssl

# Espone porta HTTP e HTTPS
EXPOSE 80 443
