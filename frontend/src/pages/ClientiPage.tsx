import { useState, useEffect } from 'react';
import { ChevronLeft, Users, Search, Plus, Edit, Home, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { IOSCard } from '../components/ui/ios-elements';
import PaginationControls from '../components/PaginationControls';
import { useAuthStore } from '../store/authStore';
import { getApiUrl } from '../config/api';
import { useFocusRegistry } from '../hooks/useFocusRegistry';

export default function ClientiPage() {
  const { user, token } = useAuthStore();
  const isAdmin = user?.ruolo === 'admin' || user?.ruolo === 'superadmin';
  const [clienti, setClienti] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [selectedClienteId, setSelectedClienteId] = useState<number | null>(null);
  const [clienteDetails, setClienteDetails] = useState<any | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const { getRef, setLastFocus } = useFocusRegistry(true, [searchTerm]);
  const navigate = useNavigate();

  const formatValue = (value: any) => {
    if (value === null || value === undefined || value === '') {
      return '—';
    }
    if (typeof value === 'boolean') {
      return value ? 'Sì' : 'No';
    }
    return String(value);
  };

  const formatDate = (value: any) => {
    if (!value) {
      return '—';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '—';
    }
    return date.toLocaleDateString('it-IT');
  };

  const getExpiryStatus = (value: any) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return { type: 'expired', label: 'SCADUTO' };
    if (diffDays <= 30) return { type: 'near', label: 'PROSSIMO ALLA SCADENZA' };
    return null;
  };

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
    // Ricarica quando cambia pagina o righe per pagina
    if (searchTerm.length > 2 || searchTerm.length === 0) {
      loadClienti();
    }
  }, [currentPage, itemsPerPage]);


  const loadClienti = async () => {
    setLoading(true);
    try {
      const skip = (currentPage - 1) * itemsPerPage;
      const res = await axios.get(`${getApiUrl()}/clienti/paginated?q=${searchTerm}&skip=${skip}&limit=${itemsPerPage}`);
      setClienti(res.data?.items || []);
      setTotalCount(res.data?.total || 0);
    } catch (err) {
      console.error('Errore caricamento clienti:', err);
      setClienti([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  const loadClienteDetails = async (clienteId: number) => {
    setDetailsLoading(true);
    setDetailsError(null);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(`${getApiUrl()}/clienti/${clienteId}`, { headers });
      const cliente = res.data || null;
      const assets = cliente?.assets_noleggio || [];
      const letture = await Promise.all(
        assets.map(async (asset: any) => {
          try {
            const letturaRes = await axios.get(`${getApiUrl()}/letture-copie/asset/${asset.id}/ultima`, { headers });
            return { asset_id: asset.id, lettura: letturaRes.data };
          } catch {
            return { asset_id: asset.id, lettura: null };
          }
        })
      );
      const lettureMap = new Map<number, any>(
        letture.map((item: any) => [item.asset_id, item.lettura])
      );
      const assetsWithLetture = assets.map((asset: any) => ({
        ...asset,
        ultima_lettura: lettureMap.get(asset.id) || null
      }));
      setClienteDetails({ ...cliente, assets_noleggio: assetsWithLetture });
    } catch (err: any) {
      setDetailsError(err?.response?.data?.detail || 'Errore caricamento dettagli cliente');
      setClienteDetails(null);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleOpenClienteDetails = (clienteId: number) => {
    setSelectedClienteId(clienteId);
    const fallbackCliente = clienti.find((cliente) => cliente.id === clienteId);
    if (fallbackCliente) {
      setClienteDetails(fallbackCliente);
    }
    loadClienteDetails(clienteId);
  };

  const handleCloseClienteDetails = () => {
    setSelectedClienteId(null);
    setClienteDetails(null);
    setDetailsError(null);
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

      <main className="max-w-6xl mx-auto p-4 space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => setLastFocus('clienti-search')}
            ref={getRef('clienti-search') as any}
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
              <IOSCard
                key={c.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleOpenClienteDetails(c.id)}
              >
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
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Edit className="w-5 h-5" />
                    </Link>
                    {isAdmin && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCliente(c.id, c.ragione_sociale);
                        }}
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

        <PaginationControls
          currentPage={currentPage}
          totalItems={totalCount}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={(pageSize) => {
            setItemsPerPage(pageSize);
            setCurrentPage(1);
          }}
        />
      </main>

      {selectedClienteId !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={handleCloseClienteDetails}
        >
          <div
            className="max-w-3xl w-full max-h-[85vh] overflow-y-auto rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Dettagli Cliente</h2>
                {clienteDetails?.ragione_sociale && (
                  <p className="text-sm text-gray-500">{clienteDetails.ragione_sociale}</p>
                )}
              </div>
              <button
                onClick={handleCloseClienteDetails}
                className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
                aria-label="Chiudi"
              >
                ✕
              </button>
            </div>
            <div className="space-y-6 px-6 py-5">
              {detailsLoading && (
                <div className="text-center text-gray-500">Caricamento dettagli...</div>
              )}
              {detailsError && (
                <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                  {detailsError}
                </div>
              )}
              {!detailsLoading && !detailsError && clienteDetails && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
                      <h3 className="text-sm font-semibold text-blue-700 mb-2">Anagrafica</h3>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div><span className="font-semibold">Indirizzo:</span> {formatValue(clienteDetails.indirizzo)}</div>
                        <div><span className="font-semibold">Città:</span> {formatValue(clienteDetails.citta)}</div>
                        <div><span className="font-semibold">CAP:</span> {formatValue(clienteDetails.cap)}</div>
                        <div><span className="font-semibold">P.IVA:</span> {formatValue(clienteDetails.p_iva)}</div>
                        <div><span className="font-semibold">Cod. Fiscale:</span> {formatValue(clienteDetails.codice_fiscale)}</div>
                        <div><span className="font-semibold">Telefono:</span> {formatValue(clienteDetails.telefono)}</div>
                        <div><span className="font-semibold">Email:</span> {formatValue(clienteDetails.email_amministrazione)}</div>
                        <div><span className="font-semibold">PEC:</span> {formatValue(clienteDetails.email_pec)}</div>
                        <div><span className="font-semibold">Referente:</span> {formatValue(clienteDetails.referente_nome)}</div>
                        <div><span className="font-semibold">Cellulare referente:</span> {formatValue(clienteDetails.referente_cellulare)}</div>
                        <div><span className="font-semibold">Codice SDI:</span> {formatValue(clienteDetails.codice_sdi)}</div>
                        <div><span className="font-semibold">Cliente PA:</span> {formatValue(clienteDetails.is_pa)}</div>
                      </div>
                    </div>
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
                      <h3 className="text-sm font-semibold text-emerald-700 mb-2">Contratti</h3>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div>
                          <span className="font-semibold">Assistenza:</span>{' '}
                          {formatValue(clienteDetails.has_contratto_assistenza)}
                          {clienteDetails.has_contratto_assistenza && (
                            <>
                              <span className="mx-2">•</span>
                              <span className="font-semibold">Scadenza:</span>{' '}
                              <span className={`font-semibold ${
                                getExpiryStatus(clienteDetails.data_fine_contratto_assistenza)?.type === 'expired'
                                  ? 'text-red-600'
                                  : getExpiryStatus(clienteDetails.data_fine_contratto_assistenza)?.type === 'near'
                                    ? 'text-yellow-700'
                                    : 'text-gray-700'
                              }`}>
                                {formatDate(clienteDetails.data_fine_contratto_assistenza)}
                              </span>
                              {getExpiryStatus(clienteDetails.data_fine_contratto_assistenza) && (
                                <span className={`ml-2 text-xs font-semibold ${
                                  getExpiryStatus(clienteDetails.data_fine_contratto_assistenza)?.type === 'expired'
                                    ? 'text-red-600'
                                    : 'text-yellow-700'
                                }`}>
                                  ({getExpiryStatus(clienteDetails.data_fine_contratto_assistenza)?.label})
                                </span>
                              )}
                            </>
                          )}
                        </div>
                        <div>
                          <span className="font-semibold">Sede legale operativa:</span>{' '}
                          {formatValue(clienteDetails.sede_legale_operativa)}
                        </div>
                        <div>
                          <span className="font-semibold">Noleggio attivo:</span>{' '}
                          {formatValue(clienteDetails.has_noleggio)}
                        </div>
                        <div>
                          <span className="font-semibold">Multisede:</span>{' '}
                          {formatValue(clienteDetails.has_multisede)}
                        </div>
                        <div>
                          <span className="font-semibold">Inizio contratto:</span>{' '}
                          {formatDate(clienteDetails.data_inizio_contratto_assistenza)}
                        </div>
                        <div>
                          <span className="font-semibold">Limite chiamate:</span>{' '}
                          {formatValue(clienteDetails.limite_chiamate_contratto)}
                        </div>
                        <div>
                          <span className="font-semibold">Chiamate utilizzate:</span>{' '}
                          {formatValue(clienteDetails.chiamate_utilizzate_contratto)}
                        </div>
                        <div>
                          <span className="font-semibold">Costo chiamata fuori limite:</span>{' '}
                          {formatValue(clienteDetails.costo_chiamata_fuori_limite)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-purple-100 bg-purple-50/60 p-4">
                    <h3 className="text-sm font-semibold text-purple-700 mb-3">Sedi</h3>
                    {clienteDetails.sedi?.length ? (
                      <div className="space-y-3">
                        {clienteDetails.sedi.map((sede: any) => (
                          <div key={sede.id} className="rounded-lg border border-purple-100 bg-white/70 p-3">
                            <div className="font-semibold text-gray-800">{formatValue(sede.nome_sede)}</div>
                            <div className="text-xs text-gray-600 mt-1">
                              {formatValue(sede.indirizzo_completo)}
                            </div>
                            <div className="mt-2 text-xs text-gray-500">
                              Città: {formatValue(sede.citta)} • CAP: {formatValue(sede.cap)}
                            </div>
                            <div className="mt-2 text-xs text-gray-500">
                              Telefono: {formatValue(sede.telefono)} • Email: {formatValue(sede.email)}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">Nessuna sede associata.</div>
                    )}
                  </div>

                  <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-4">
                    <h3 className="text-sm font-semibold text-amber-700 mb-3">Noleggi / Asset</h3>
                    {clienteDetails.assets_noleggio?.length ? (
                      <div className="space-y-3">
                        {clienteDetails.assets_noleggio.map((asset: any) => {
                          const ultima = asset.ultima_lettura;
                          const scadenzaStatus = getExpiryStatus(asset.data_scadenza_noleggio);
                          return (
                            <div key={asset.id} className="rounded-lg border border-amber-100 bg-white/70 p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="font-semibold text-gray-800">
                                  {asset.tipo_asset || 'Asset'} {asset.marca ? `• ${asset.marca}` : ''} {asset.modello || ''}
                                </div>
                                <div className="text-xs text-gray-500">
                                  <span className={`font-semibold ${
                                    scadenzaStatus?.type === 'expired'
                                      ? 'text-red-600'
                                      : scadenzaStatus?.type === 'near'
                                        ? 'text-yellow-700'
                                        : 'text-gray-600'
                                  }`}>
                                    Scadenza: {formatDate(asset.data_scadenza_noleggio)}
                                  </span>
                                  {scadenzaStatus && (
                                    <span className={`ml-2 text-[10px] font-semibold ${
                                      scadenzaStatus.type === 'expired' ? 'text-red-600' : 'text-yellow-700'
                                    }`}>
                                      ({scadenzaStatus.label})
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="mt-2 text-xs text-gray-500">
                                Matricola: {formatValue(asset.matricola || asset.seriale || asset.serial_number)}
                                {asset.tipo_asset === 'Printing' && (
                                  <> • Cadenza letture: {formatValue(asset.cadenza_letture_copie)}</>
                                )}
                              </div>
                              {asset.tipo_asset === 'Printing' ? (
                                <>
                                  <div className="mt-2 text-xs text-gray-600">
                                    <span className="font-semibold">Ultimo prelievo copie:</span>{' '}
                                    {formatDate(ultima?.data_lettura)}
                                    {' • '}
                                    <span className="font-semibold">BN:</span> {ultima?.contatore_bn ?? '—'}
                                    {' • '}
                                    <span className="font-semibold">Colore:</span> {ultima?.contatore_colore ?? '—'}
                                  </div>
                                  <div className="mt-2 text-xs text-gray-500">
                                    Formato: {formatValue(asset.tipo_formato)} • Colore: {formatValue(asset.is_colore)}
                                  </div>
                                  <div className="mt-2 text-xs text-gray-500">
                                    Contatori iniziali BN: {formatValue(asset.contatore_iniziale_bn)} • Colore: {formatValue(asset.contatore_iniziale_colore)}
                                  </div>
                                  <div className="mt-2 text-xs text-gray-500">
                                    Copie incluse BN: {formatValue(asset.copie_incluse_bn)} • Colore: {formatValue(asset.copie_incluse_colore)}
                                  </div>
                                  <div className="mt-2 text-xs text-gray-500">
                                    Costo copia BN fuori limite: {formatValue(asset.costo_copia_bn_fuori_limite)} •
                                    Colore: {formatValue(asset.costo_copia_colore_fuori_limite)}
                                  </div>
                                  <div className="mt-2 text-xs text-gray-500">
                                    Costo copia BN non incluse: {formatValue(asset.costo_copia_bn_non_incluse)} •
                                    Colore: {formatValue(asset.costo_copia_colore_non_incluse)}
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="mt-2 text-xs text-gray-500">
                                    Codice prodotto: {formatValue(asset.codice_prodotto)} • Descrizione: {formatValue(asset.descrizione)}
                                  </div>
                                  <div className="mt-2 text-xs text-gray-500">
                                    Nuovo: {formatValue(asset.is_nuovo)}
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">Nessun asset a noleggio associato.</div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

