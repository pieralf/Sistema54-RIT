import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import axios from 'axios';
import { getApiUrl } from '../config/api';

interface User {
  id: number;
  email: string;
  nome_completo: string;
  ruolo: string;
  permessi?: Record<string, boolean>;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  requires2FA: boolean;
  login: (email: string, password: string, twoFactorCode?: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      requires2FA: false,

      login: async (email: string, password: string, twoFactorCode?: string) => {
        try {
          // OAuth2PasswordRequestForm richiede application/x-www-form-urlencoded
          const params = new URLSearchParams();
          params.append('username', email); // OAuth2PasswordRequestForm usa 'username' per l'email
          params.append('password', password);
          // Se c'è un codice 2FA, aggiungilo come query parameter
          let url = `${getApiUrl()}/api/auth/login`;
          if (twoFactorCode) {
            url += `?two_factor_code=${encodeURIComponent(twoFactorCode)}`;
          }

          const response = await axios.post(url, params.toString(), {
            headers: { 
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            timeout: 10000
          });

          const { access_token, user, requires_2fa } = response.data;
          
          // Se richiede 2FA, non completare il login
          if (requires_2fa) {
            set({
              requires2FA: true,
              user: user
            });
            throw new Error('2FA_REQUIRED');
          }
          
          // Imposta header di default per tutte le richieste future
          axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;

          set({
            token: access_token,
            user: user,
            isAuthenticated: true,
            requires2FA: false
          });
        } catch (error: any) {
          // Debug: log completo dell'errore per capire cosa arriva
          console.log('Login error caught:', {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            message: error.message
          });
          
          // Se è richiesto 2FA, non è un errore
          if (error.message === '2FA_REQUIRED') {
            throw error;
          }
          
          // Gestione rate limit (429) - PRIMA di tutto il resto per catturare il messaggio personalizzato
          if (error.response?.status === 429) {
            // Estrai il messaggio personalizzato dal backend
            const rateLimitData = error.response?.data;
            
            // Il backend restituisce un messaggio user-friendly nel campo "detail"
            if (rateLimitData?.detail && typeof rateLimitData.detail === 'string') {
              // Usa direttamente il messaggio dal backend
              throw new Error(rateLimitData.detail);
            } 
            // Fallback se il formato non è quello atteso (dovrebbe essere "detail" ma proviamo anche altri campi)
            else if (rateLimitData?.message && typeof rateLimitData.message === 'string') {
              throw new Error(rateLimitData.message);
            } 
            // Fallback finale con calcolo manuale
            else {
              const retryAfter = rateLimitData?.retry_after || 60;
              const minutes = Math.ceil(retryAfter / 60);
              throw new Error(`⏱️ Troppi tentativi di login falliti. Attendi ${minutes} minuto${minutes > 1 ? 'i' : ''} prima di riprovare. Limite: 5 tentativi al minuto.`);
            }
          }
          
          // Gestione cambio password richiesto
          if (error?.response?.data?.detail === 'PASSWORD_CHANGE_REQUIRED') {
            throw new Error("Devi impostare la password dal link ricevuto via email. Se non lo trovi, chiedi all'amministratore di rigenerare l'accesso.");
          }
          
          // Per altri errori, usa il messaggio dal backend se disponibile
          let errorMessage = 'Errore di connessione al server';
          if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
            errorMessage = `Impossibile connettersi al server. Verifica che il backend sia accessibile su ${getApiUrl()}`;
          } else if (error.response?.data?.detail && typeof error.response.data.detail === 'string') {
            // Usa il messaggio dal backend se disponibile
            errorMessage = error.response.data.detail;
          } else if (error.response?.data?.message && typeof error.response.data.message === 'string') {
            errorMessage = error.response.data.message;
          } else if (error.message && !error.message.includes('status code')) {
            // Usa il messaggio dell'errore solo se non è il generico di axios
            errorMessage = error.message;
          }
          
          throw new Error(errorMessage);
        }
      },

      logout: () => {
        delete axios.defaults.headers.common['Authorization'];
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          requires2FA: false
        });
      },

      checkAuth: async () => {
        const { token } = get();
        if (!token) {
          set({ isAuthenticated: false, user: null });
          return;
        }

        try {
          // Imposta header per questa richiesta
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          const response = await axios.get(`${getApiUrl()}/api/auth/me`);
          
          set({
            user: response.data,
            isAuthenticated: true
          });
        } catch (error: any) {
          // Solo se è un errore 401/403 (non autorizzato), fai logout
          // Se è un errore di rete, mantieni la sessione (potrebbe essere temporaneo)
          if (error.response?.status === 401 || error.response?.status === 403) {
            // Token non valido, logout
            get().logout();
          } else if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
            // Errore di rete: mantieni la sessione ma non aggiornare isAuthenticated
            // L'utente rimane loggato finché il token non scade realmente
            console.warn('Errore di rete durante checkAuth, mantengo la sessione');
          } else {
            // Altri errori: mantieni la sessione
            console.warn('Errore durante checkAuth, mantengo la sessione:', error);
          }
        }
      }
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ token: state.token, user: state.user }),
      onRehydrateStorage: () => (state) => {
        // Quando lo stato viene ripristinato, imposta isAuthenticated basandosi sul token
        if (state?.token) {
          state.isAuthenticated = true;
          // Imposta anche l'header axios
          axios.defaults.headers.common['Authorization'] = `Bearer ${state.token}`;
        }
      }
    }
  )
);

// Migrazione da localStorage a sessionStorage (se necessario)
const oldLocalStorageToken = localStorage.getItem('auth-storage');
if (oldLocalStorageToken) {
  try {
    // Copia i dati da localStorage a sessionStorage
    sessionStorage.setItem('auth-storage', oldLocalStorageToken);
    // Rimuovi il vecchio localStorage
    localStorage.removeItem('auth-storage');
  } catch (e) {
    // Ignora errori di migrazione
  }
}
