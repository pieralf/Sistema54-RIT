import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, Users, LogOut, User, Package, FileText } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import { useNavigate } from 'react-router-dom';
import { getApiUrl } from '../config/api';
import axios from 'axios';

export default function DashboardOperatorePage() {
  const { user, logout, token } = useAuthStore();
  const { settings, loadSettings } = useSettingsStore();
  const navigate = useNavigate();
  const logoUrl = settings?.logo_url || '';
  const nomeAzienda = settings?.nome_azienda || 'GIT - Gestione Interventi Tecnici';
  const [pendingDdtCount, setPendingDdtCount] = useState(0);
  const [assignmentStats, setAssignmentStats] = useState({
    pending_accept: 0,
    assigned: 0,
    transfer_pending: 0,
    unassigned: 0
  });

  useEffect(() => {
    loadSettings();
    // Debug: verifica permessi DDT
    if (user) {
      console.log('🔍 Debug permessi DDT:', {
        can_view_ddt: user.permessi?.can_view_ddt,
        can_create_ddt: user.permessi?.can_create_ddt,
        ruolo: user.ruolo,
        permessi: user.permessi
      });
    }
  }, [loadSettings, user]);

  useEffect(() => {
    if (!user || user.ruolo !== 'tecnico') {
      setPendingDdtCount(0);
      return;
    }
    axios.get(`${getApiUrl()}/ddt/pending-accept-count`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => setPendingDdtCount(res.data?.count || 0))
      .catch(() => setPendingDdtCount(0));
  }, [user, token]);

  useEffect(() => {
    if (!user || user.ruolo !== 'tecnico') {
      setAssignmentStats({ pending_accept: 0, assigned: 0, transfer_pending: 0, unassigned: 0 });
      return;
    }
    axios.get(`${getApiUrl()}/ddt/assignment-stats`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => setAssignmentStats(res.data || { pending_accept: 0, assigned: 0, transfer_pending: 0, unassigned: 0 }))
      .catch(() => setAssignmentStats({ pending_accept: 0, assigned: 0, transfer_pending: 0, unassigned: 0 }));
  }, [user, token]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 pb-20">
      {/* Header iOS Style */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-xl border-b border-gray-200/50 px-4 py-4 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img 
                src={`${getApiUrl()}${logoUrl}`} 
                alt={nomeAzienda}
                className="h-10 w-10 object-contain rounded-full bg-white p-1"
              />
            ) : (
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-lg">S</span>
              </div>
            )}
            <div>
              <h1 className="text-lg font-bold text-gray-900">{nomeAzienda}</h1>
              <p className="text-xs text-gray-500">{user?.nome_completo}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {/* Card Nuovo Intervento - Stile iOS */}
          <Link
            to="/new-rit"
            className="block h-full bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden active:scale-[0.98] transition-transform"
          >
            <div className="h-full bg-gradient-to-br from-blue-500 to-blue-600 p-8">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                  <PlusCircle className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-white mb-1">Nuovo Intervento</h2>
                  <p className="text-blue-100 text-sm">Crea un nuovo rapporto tecnico</p>
                </div>
              </div>
            </div>
          </Link>

          {/* Card Nuovo DDT - Mostrata solo se l'utente ha i permessi */}
          {((user?.permessi?.can_create_ddt === true) || user?.ruolo === 'admin' || user?.ruolo === 'superadmin') && (
            <Link
              to="/new-ddt"
              className="block h-full bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden active:scale-[0.98] transition-transform"
            >
              <div className="h-full bg-gradient-to-br from-orange-500 to-orange-600 p-8">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                    <Package className="w-8 h-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-white mb-1">Nuovo DDT</h2>
                    <p className="text-orange-100 text-sm">Ritiro prodotto da riparare</p>
                  </div>
                </div>
              </div>
            </Link>
          )}

          {user?.ruolo === 'tecnico' && (
            <>
              <Link
                to="/admin?tab=ddt&assignment_state=in_attesa_accettazione&ddt_status=in_magazzino"
                className="block h-full bg-white rounded-3xl shadow-lg border border-blue-100 overflow-hidden active:scale-[0.98] transition-transform"
              >
                <div className="h-full bg-gradient-to-br from-blue-500/90 to-sky-400 p-8">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                      <Package className="w-8 h-8 text-white" />
                    </div>
                    <div className="flex-1">
                      <h2 className="text-2xl font-bold text-white mb-1">In attesa di accettazione</h2>
                      <p className="text-blue-100 text-sm">DDT in attesa: {assignmentStats.pending_accept}</p>
                    </div>
                  </div>
                </div>
              </Link>

              <Link
                to="/admin?tab=ddt&ddt_status=in_riparazione&assignment_state=assegnato"
                className="block h-full bg-white rounded-3xl shadow-lg border border-green-100 overflow-hidden active:scale-[0.98] transition-transform"
              >
                <div className="h-full bg-gradient-to-br from-emerald-500/90 to-green-400 p-8">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                      <Package className="w-8 h-8 text-white" />
                    </div>
                    <div className="flex-1">
                      <h2 className="text-2xl font-bold text-white mb-1">DDT accettati</h2>
                      <p className="text-green-100 text-sm">Assegnati a te: {assignmentStats.assigned}</p>
                    </div>
                  </div>
                </div>
              </Link>

              <Link
                to="/admin?tab=ddt&assignment_state=trasferimento_in_attesa"
                className="block h-full bg-white rounded-3xl shadow-lg border border-red-100 overflow-hidden active:scale-[0.98] transition-transform"
              >
                <div className="h-full bg-gradient-to-br from-red-500/90 to-rose-400 p-8">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                      <Package className="w-8 h-8 text-white" />
                    </div>
                    <div className="flex-1">
                      <h2 className="text-2xl font-bold text-white mb-1">Riassegnazioni in attesa</h2>
                      <p className="text-red-100 text-sm">Da accettare: {assignmentStats.transfer_pending}</p>
                    </div>
                  </div>
                </div>
              </Link>

              <Link
                to="/admin?tab=ddt&assignment_state=da_assegnare&ddt_status=in_magazzino"
                className="block h-full bg-white rounded-3xl shadow-lg border border-yellow-100 overflow-hidden active:scale-[0.98] transition-transform"
              >
                <div className="h-full bg-gradient-to-br from-yellow-400/90 to-amber-300 p-8">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                      <Package className="w-8 h-8 text-white" />
                    </div>
                    <div className="flex-1">
                      <h2 className="text-2xl font-bold text-white mb-1">DDT non assegnati</h2>
                      <p className="text-yellow-100 text-sm">Disponibili: {assignmentStats.unassigned}</p>
                    </div>
                  </div>
                </div>
              </Link>
            </>
          )}

          {/* Card Clienti - Stile iOS */}
          <Link
            to="/clienti"
            className="block h-full bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden active:scale-[0.98] transition-transform"
          >
            <div className="p-6 h-full">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center">
                  <Users className="w-7 h-7 text-green-600" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-gray-900 mb-1">Clienti</h2>
                  <p className="text-gray-500 text-sm">Gestisci anagrafiche clienti</p>
                </div>
                <div className="text-gray-300">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          </Link>

          {/* Card Interventi - Mostrata solo se l'utente ha i permessi */}
          {(user?.permessi?.can_view_interventi || user?.ruolo === 'admin' || user?.ruolo === 'superadmin') && (
            <Link
              to="/admin?tab=interventi"
              className="block h-full bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden active:scale-[0.98] transition-transform"
            >
              <div className="p-6 h-full">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center">
                    <FileText className="w-7 h-7 text-orange-600" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-gray-900 mb-1">Interventi</h2>
                    <p className="text-gray-500 text-sm">Visualizza e gestisci interventi</p>
                  </div>
                  <div className="text-gray-300">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </Link>
          )}

          {/* Card DDT - Mostrata solo se l'utente ha i permessi */}
          {((user?.permessi?.can_view_ddt === true) || user?.ruolo === 'admin' || user?.ruolo === 'superadmin') && (
            <Link
              to="/admin?tab=ddt"
              className="block h-full bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden active:scale-[0.98] transition-transform"
            >
              <div className="p-6 h-full">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center">
                    <Package className="w-7 h-7 text-orange-600" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-gray-900 mb-1">DDT</h2>
                    <p className="text-gray-500 text-sm">Visualizza e gestisci DDT</p>
                  </div>
                  <div className="text-gray-300">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </Link>
          )}

          {/* Card DDT da accettare - Solo tecnico */}
          {user?.ruolo === 'tecnico' && (
            <Link
              to="/admin?tab=ddt"
              className="block h-full bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden active:scale-[0.98] transition-transform"
            >
              <div className="p-6 h-full">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-yellow-100 rounded-2xl flex items-center justify-center">
                    <Package className="w-7 h-7 text-yellow-600" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-gray-900 mb-1">DDT da accettare</h2>
                    <p className="text-gray-500 text-sm">
                      In attesa di accettazione: <span className="font-semibold">{pendingDdtCount}</span>
                    </p>
                  </div>
                  <div className="text-gray-300">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </Link>
          )}

          {/* Card Magazzino - Mostrata solo se l'utente ha i permessi */}
          {(user?.permessi?.can_view_magazzino || user?.ruolo === 'admin' || user?.ruolo === 'superadmin') && (
            <Link
              to="/admin?tab=magazzino"
              className="block h-full bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden active:scale-[0.98] transition-transform"
            >
              <div className="p-6 h-full">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center">
                    <Package className="w-7 h-7 text-purple-600" />
                  </div>
                  <div className="flex-1">
                  <h2 className="text-xl font-bold text-gray-900 mb-1">Magazzino</h2>
                    <p className="text-gray-500 text-sm">Gestisci prodotti e giacenze</p>
                  </div>
                  <div className="text-gray-300">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </Link>
          )}
        </div>

        {/* Spacer per iOS bottom safe area */}
        <div className="h-8" />
      </main>
    </div>
  );
}

