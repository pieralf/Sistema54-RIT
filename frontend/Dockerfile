FROM node:18-alpine

WORKDIR /app

# Copia i file di definizione delle dipendenze
COPY package.json package-lock.json* ./

# 1. Installa le dipendenze base (incluse devDependencies)
RUN npm install --include=dev

# 2. FIX SPECIFICO: Installa esplicitamente vite e react-signature-canvas
# Questo garantisce che vite sia disponibile e che react-signature-canvas ci sia
RUN npm install vite@^5.0.0 react-signature-canvas

# Copia il resto del codice sorgente (incluse cartelle public e src)
COPY . .
# Assicura che la cartella public esista e sia accessibile
RUN mkdir -p public

# Espone la porta di Vite
EXPOSE 5173

# Avvio in modalità sviluppo host (usa npx vite per maggiore affidabilità)
# Imposta NODE_ENV=production per disabilitare HMR e prevenire errori ERR_CONNECTION_REFUSED
ENV NODE_ENV=production
CMD ["npx", "vite", "--host", "0.0.0.0"]