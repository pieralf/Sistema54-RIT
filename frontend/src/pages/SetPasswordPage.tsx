import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { IOSCard, IOSInput } from '../components/ui/ios-elements';
import { getApiUrl } from '../config/api';
import { AlertCircle, Lock } from 'lucide-react';

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function SetPasswordPage() {
  const navigate = useNavigate();
  const query = useQuery();
  const token = query.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Token mancante o non valido. Richiedi una rigenerazione accesso all’amministratore.');
    }
  }, [token]);

  const validateClient = (): string | null => {
    if (password.length < 10) return 'La password deve contenere almeno 10 caratteri.';
    if (!/[A-Z]/.test(password)) return 'La password deve contenere almeno una lettera maiuscola.';
    if (!/[0-9]/.test(password)) return 'La password deve contenere almeno un numero.';
    if (!/[^A-Za-z0-9]/.test(password)) return 'La password deve contenere almeno un carattere speciale.';
    if (password !== confirm) return 'Le password non coincidono.';
    return null;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOk(null);

    const v = validateClient();
    if (v) {
      setError(v);
      return;
    }

    try {
      setLoading(true);
      const apiUrl = getApiUrl();
      await axios.post(`${apiUrl}/api/auth/set-password`, {
        token,
        new_password: password,
      });
      setOk('Password impostata correttamente. Ora puoi effettuare il login.');
      setTimeout(() => navigate('/login'), 900);
    } catch (err: any) {
      // Gestione rate limit (429) - mostra messaggio personalizzato
      if (err.response?.status === 429) {
        const rateLimitData = err.response?.data;
        if (rateLimitData?.detail) {
          setError(rateLimitData.detail);
        } else {
          setError('Troppi tentativi di impostazione password. Attendi qualche minuto prima di riprovare.');
        }
      } else {
        const detail = err?.response?.data?.detail || 'Errore durante l'impostazione della password.';
        setError(typeof detail === 'string' ? detail : 'Errore durante l'impostazione della password.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="w-full max-w-md">
        <IOSCard className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Lock className="w-5 h-5 text-blue-600" />
            <h1 className="text-xl font-semibold text-gray-800">Imposta la tua password</h1>
          </div>

          <p className="text-sm text-gray-600 mb-4">
            La password deve avere almeno <strong>10 caratteri</strong> e contenere almeno{' '}
            <strong>1 maiuscola</strong>, <strong>1 numero</strong> e <strong>1 carattere speciale</strong>.
          </p>

          {error && (
            <div className="mb-4 flex items-start gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {ok && (
            <div className="mb-4 p-3 rounded-lg bg-green-50 text-green-700 text-sm">
              {ok}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-3">
            <IOSInput
              label="Nuova password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Inserisci la nuova password"
              disabled={!token || loading}
            />
            <IOSInput
              label="Conferma password"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Conferma la nuova password"
              disabled={!token || loading}
            />
            <button
              type="submit"
              disabled={!token || loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Salvataggio...' : 'Imposta password'}
            </button>
          </form>
        </IOSCard>
      </div>
    </div>
  );
}
