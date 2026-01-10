import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Ascolta su tutte le interfacce
    strictPort: true,
    port: 5173,
    // In produzione con reverse proxy, disabilita il controllo host
    // oppure aggiungi tutti gli hostname possibili
    hmr: {
      // Disabilita HMR host check quando si usa reverse proxy
      clientPort: 5173
    },
    // Permetti tutti gli host quando si usa reverse proxy
    // In alternativa, disabilita il check host completamente
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      'frontend', // Nome container Docker (quando nginx fa proxy)
      '.lan', // Permette tutti i domini .lan
      // Aggiungi IP o hostname specifici tramite variabile d'ambiente VITE_ALLOWED_HOSTS
      ...(process.env.VITE_ALLOWED_HOSTS ? process.env.VITE_ALLOWED_HOSTS.split(',') : [])
    ],
    watch: {
      usePolling: true
    },
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name].[hash].js`,
        chunkFileNames: `assets/[name].[hash].js`,
        assetFileNames: (assetInfo) => {
          // Preserva favicon.png nella root
          if (assetInfo.name === 'favicon.png') {
            return 'favicon.png';
          }
          return `assets/[name].[hash].[ext]`;
        }
      }
    },
    // Assicura che la cartella public venga copiata correttamente
    copyPublicDir: true
  },
  // Configurazione per servire file statici dalla cartella public
  publicDir: 'public'
})