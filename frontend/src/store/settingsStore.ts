import { create } from 'zustand';
import axios from 'axios';
import { getApiUrl } from '../config/api';

interface Settings {
  nome_azienda: string;
  logo_url: string;
  colore_primario: string;
  [key: string]: any;
}

interface SettingsStore {
  settings: Settings | null;
  isLoading: boolean;
  loadSettings: () => Promise<void>;
  updateSettings: (newSettings: Partial<Settings>) => void;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: null,
  isLoading: false,

  loadSettings: async () => {
    // Se già caricato, non ricaricare
    if (get().settings) return;
    
    set({ isLoading: true });
    try {
      // Usa sempre l'endpoint pubblico per evitare problemi di autenticazione
      const res = await axios.get(`${getApiUrl()}/impostazioni/public`);
      const data = res.data || {};
      set({ 
        settings: {
          nome_azienda: data.nome_azienda || 'GIT - Gestione Interventi Tecnici',
          logo_url: data.logo_url || '',
          colore_primario: data.colore_primario || '#4F46E5',
          ...data
        },
        isLoading: false 
      });
      
      // Titolo HTML sempre fisso: "GIT - Gestione Interventi Tecnici"
      // NON aggiornare con il nome azienda
    } catch (err) {
      console.error('Errore caricamento impostazioni:', err);
      set({ 
        settings: {
          nome_azienda: 'GIT - Gestione Interventi Tecnici',
          logo_url: '',
          colore_primario: '#4F46E5'
        },
        isLoading: false 
      });
    }
  },

  updateSettings: (newSettings) => {
    const current = get().settings || {};
    const updated = { ...current, ...newSettings };
    set({ settings: updated });
    
    // Titolo HTML sempre fisso: "GIT - Gestione Interventi Tecnici"
    // NON aggiornare con il nome azienda
  }
}));

