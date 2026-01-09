// frontend/src/config/api.ts
// Rileva automaticamente l'URL del backend in base all'host corrente.
// Supporta:
// - Proxy DNS / reverse proxy: usa "/api"
// - Installazioni variabili: VITE_BACKEND_PORT oppure VITE_API_URL

export function getApiUrl(): string {
  const hostname = window.location.hostname;

  // 1) Override completo (opzionale)
  const viteApiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  if (viteApiUrl) {
    console.log("[getApiUrl] Usando VITE_API_URL:", viteApiUrl);
    return viteApiUrl;
  }

  // 2) Porta backend configurabile (default 8000)
  const port = (import.meta.env.VITE_BACKEND_PORT as string | undefined)?.trim() || "8000";

  // 3) Rileva se stai passando da un proxy/reverse proxy (hostname non-IP e non localhost)
  const isIpAddress = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);
  const isProxyAccess = !isIpAddress && hostname !== "localhost" && hostname !== "127.0.0.1";

  if (isProxyAccess) {
    // Se proxy è configurato per inoltrare /api -> backend, usa percorso relativo
    const url = "/api";
    console.log("[getApiUrl] Accesso tramite proxy DNS rilevato, usando:", url);
    return url;
  }

  // 4) Accesso diretto (localhost o IP): usa host corrente + porta configurata
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    const url = `http://localhost:${port}`;
    console.log("[getApiUrl] Rilevato localhost, usando:", url);
    return url;
  }

  const url = `http://${hostname}:${port}`;
  console.log("[getApiUrl] Rilevato hostname:", hostname, "URL backend:", url);
  return url;
}

// Export legacy: tienilo, ma NON fissarlo su :8000.
// In pratica chi usa API_URL dovrebbe chiamare getApiUrl(), però lasciamo un default "neutro".
export const API_URL = "";
