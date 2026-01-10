import { useState, useEffect } from 'react';
import { ChevronLeft, Users, Search, Plus, Edit, Home, Trash2, ChevronRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { IOSCard } from '../components/ui/ios-elements';
import { useAuthStore } from '../store/authStore';
import { getApiUrl } from '../config/api';

export default function ClientiPage() {
  const { user, token } = useAuthStore();
  const isAdmin = user?.ruolo === 'admin' || user?.ruolo === 'superadmin';
  const [clienti, setClienti] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 20;
  const navigate = useNavigate();

  useEffect(() => {
    // Carica i clienti quando la pagina viene caricata o quando cambia il termine di ricerca
    if (searchTerm.length > 2 || searchTerm.length === 0) {
      const delay = setTimeout(() => {
        setCurrentPage(1); // Reset alla prima pagina quando cambia la ricerca
        loadClienti();
      }, searchTerm.length === 0 ? 0 : 300); // Nessun delay al caricamento iniziale
      return () => clearTimeout(delay);
    }
  }, [searchTerm]);

  useEffect(() => {
    // Ricarica quando cambia la pagina
    if (searchTerm.length > 2 || searchTerm.length === 0) {
      loadClienti();
    }
  }, [currentPage]);

  const loadClienti = async () => {
    setLoading(true);
    try {
      const skip = (currentPage - 1) * itemsPerPage;
      const res = await axios.get(`${getApiUrl()}/clienti/?q=${searchTerm}&skip=${skip}&limit=${itemsPerPage}`);
      
      // Se la risposta è un array, usa la lunghezza come conteggio totale approssimativo
      // Altrimenti, se il backend fornisce un oggetto con 'items' e 'total', usalo
      if (Array.isArray(res.data)) {
        setClienti(res.data);
        // Stima totale: se ci sono meno items della pagina, è la fine; altrimenti stima
        if (res.data.length < itemsPerPage) {
          setTotalCount((currentPage - 1) * itemsPerPage + res.data.length);
        } else {
          // Stima conservativa: almeno quanto abbiamo + 1 pagina
          setTotalCount((currentPage + 1) * itemsPerPage);
        }
      } else if (res.data.items && typeof res.data.total === 'number') {
        // Backend con formato { items: [], total: number }
        setClienti(res.data.items);
        setTotalCount(res.data.total);
      } else {
        setClienti(res.data || []);
        setTotalCount(res.data?.length || 0);
      }
    } catch (err) {
      console.error('Errore caricamento clienti:', err);
      setClienti([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCliente = async (clienteId: number, ragioneSociale: string) => {
    if (!window.confirm(`Sei sicuro di voler eliminare il cliente "${ragioneSociale}"?\n\nLo storico verrà preservato, ma il cliente non sarà più visibile nelle liste.`)) {
      return;
    }

    try {
      await axios.delete(`${getApiUrl()}/clienti/${clienteId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      alert('Cliente eliminato con successo (soft delete)');
      loadClienti(); // Ricarica la lista
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Errore durante l\'eliminazione';
      alert(`Errore: ${msg}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="p-2 -ml-2 text-gray-600 rounded-full hover:bg-gray-100"
              title="Home"
            >
              <Home className="w-6 h-6" />
            </button>
            <button
              onClick={() => navigate(-1)}
              className="p-2 text-gray-600 rounded-full hover:bg-gray-100"
              title="Torna indietro"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h1 className="text-lg font-bold text-gray-900">Clienti</h1>
          </div>
          {isAdmin && (
            <Link
              to="/nuovo-cliente"
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold"
            >
              <Plus className="w-4 h-4" />
              Nuovo
            </Link>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cerca cliente per ragione sociale, P.IVA o CF..."
            className="w-full bg-white border border-gray-200 rounded-xl pl-11 pr-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        {/* Lista Clienti */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">Caricamento...</div>
        ) : (
          <div className="space-y-3">
            {clienti.map((c) => (
              <IOSCard key={c.id} className="hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <Users className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-gray-900">{c.ragione_sociale}</div>
                      <div className="text-sm text-gray-600 mt-1">{c.indirizzo}</div>
                      {c.p_iva && (
                        <div className="text-xs text-gray-500 mt-1">P.IVA: {c.p_iva}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Link
                      to={`/nuovo-cliente/${c.id}`}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                    >
                      <Edit className="w-5 h-5" />
                    </Link>
                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteCliente(c.id, c.ragione_sociale)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        title="Elimina cliente"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              </IOSCard>
            ))}
            {clienti.length === 0 && !loading && (
              <div className="text-center py-12 text-gray-500">
                {searchTerm ? 'Nessun cliente trovato' : 'Nessun cliente presente'}
              </div>
            )}
          </div>
        )}

        {/* Paginazione */}
        {!loading && totalCount > itemsPerPage && (
          <div className="flex items-center justify-between mt-6 px-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              <ChevronLeft className="w-4 h-4" />
              Precedente
            </button>
            
            <div className="text-sm text-gray-600">
              Pagina {currentPage} di {Math.ceil(totalCount / itemsPerPage)} 
              <span className="ml-2 text-gray-400">({totalCount} totali)</span>
            </div>
            
            <button
              onClick={() => setCurrentPage(prev => prev + 1)}
              disabled={currentPage * itemsPerPage >= totalCount}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              Successiva
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

