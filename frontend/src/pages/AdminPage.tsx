import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Users, Building2, FileText, Search, Plus, Edit, Trash2, Shield, Package, Home, LogOut, Activity, HardDrive, Download, Upload, RotateCcw, Trash, FolderOpen, FileUp, RefreshCcw, ChevronRight } from 'lucide-react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { IOSCard, IOSInput, IOSSwitch } from '../components/ui/ios-elements';
import { getApiUrl } from '../config/api';
import EditUserModal from '../components/EditUserModal';

export default function AdminPage() {
  const { user, token, logout } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as any) || 'users';
  const [activeTab, setActiveTab] = useState<'users' | 'clienti' | 'interventi' | 'magazzino' | 'logs' | 'backup'>(initialTab);
  const [users, setUsers] = useState<any[]>([]);
  const [deletedUsers, setDeletedUsers] = useState<any[]>([]);
  const [showDeletedUsers, setShowDeletedUsers] = useState(false);
  const [clienti, setClienti] = useState<any[]>([]);
  const [interventi, setInterventi] = useState<any[]>([]);
  const [magazzino, setMagazzino] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [backups, setBackups] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  // Paginazione
  const [clientiPage, setClientiPage] = useState(1);
  const [clientiTotal, setClientiTotal] = useState(0);
  const [interventiPage, setInterventiPage] = useState(1);
  const [interventiTotal, setInterventiTotal] = useState(0);
  const itemsPerPage = 20;
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupConfig, setBackupConfig] = useState<any>({
    nas_enabled: false,
    nas_path: '',
    cloud_enabled: false,
    cloud_provider: '',
    local_path: '',
    // Retention e scheduler sono separati per tipo destinazione
    local_keep_count: 10,
    nas_keep_count: 10,
    cloud_keep_count: 10,

    local_schedule_enabled: false,
    nas_schedule_enabled: false,
    cloud_schedule_enabled: false,

    // Orario (HH:MM) per esecuzione giornaliera.
    local_schedule_time: '02:00',
    nas_schedule_time: '02:30',
    cloud_schedule_time: '03:00',
  });
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [creatingUser, setCreatingUser] = useState(false);
  const [restoringBackup, setRestoringBackup] = useState<string | null>(null);
  const [backupStatus, setBackupStatus] = useState<any>(null);
  const [backupStatusInterval, setBackupStatusInterval] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [backupTargets, setBackupTargets] = useState<any[]>([]);
  const [selectedBackupTargetIds, setSelectedBackupTargetIds] = useState<number[]>([]);
  const [newTargetName, setNewTargetName] = useState('');
  const [newTargetProvider, setNewTargetProvider] = useState<'onedrive' | 'drive' | 'dropbox' | 'smb' | 'ftp' | 'sftp'>('onedrive');
  const [newTargetRemotePath, setNewTargetRemotePath] = useState('');
  const [newTargetConfig, setNewTargetConfig] = useState('');
  // Campi specifici per SMB/FTP/SFTP (più user-friendly)
  const [newTargetHost, setNewTargetHost] = useState('');
  const [newTargetUser, setNewTargetUser] = useState('');
  const [newTargetPass, setNewTargetPass] = useState('');
  const [newTargetPort, setNewTargetPort] = useState('');
  const [newTargetShare, setNewTargetShare] = useState(''); // Solo per SMB
  const [newTargetDomain, setNewTargetDomain] = useState(''); // Solo per SMB
  const [newTargetKeyFile, setNewTargetKeyFile] = useState(''); // Solo per SFTP
  const [editingTarget, setEditingTarget] = useState<any>(null);
  const [editTargetName, setEditTargetName] = useState('');
  const [editTargetProvider, setEditTargetProvider] = useState<'onedrive' | 'drive' | 'dropbox' | 'smb' | 'ftp' | 'sftp'>('onedrive');
  const [editTargetRemotePath, setEditTargetRemotePath] = useState('');
  const [editTargetConfig, setEditTargetConfig] = useState('');
  const [editTargetHost, setEditTargetHost] = useState('');
  const [editTargetUser, setEditTargetUser] = useState('');
  const [editTargetPass, setEditTargetPass] = useState('');
  const [editTargetPort, setEditTargetPort] = useState('');
  const [editTargetShare, setEditTargetShare] = useState('');
  const [editTargetDomain, setEditTargetDomain] = useState('');
  const [editTargetKeyFile, setEditTargetKeyFile] = useState('');
  
  // Filtri per audit logs
  const [logFilters, setLogFilters] = useState({
    entity_type: '',
    action: '',
    user_id: '',
    start_date: '',
    end_date: ''
  });

  // Aggiorna activeTab quando cambiano i query params (es. navigazione indietro)
  useEffect(() => {
    const tabFromParams = (searchParams.get('tab') as any) || 'users';
    
    // Verifica che la tab richiesta sia permessa per l'utente corrente
    const isTabAllowed = (tab: string): boolean => {
      if (user?.ruolo === 'admin' || user?.ruolo === 'superadmin') {
        return true; // Admin e superadmin hanno accesso a tutte le tab
      }
      
      switch (tab) {
        case 'users':
          return false; // Solo admin/superadmin
        case 'clienti':
          return user?.permessi?.can_view_clienti === true;
        case 'magazzino':
          return user?.permessi?.can_view_magazzino === true;
        case 'interventi':
          return user?.permessi?.can_view_interventi === true;
        case 'logs':
          return user?.ruolo === 'admin' || user?.ruolo === 'superadmin';
        case 'backup':
          return user?.ruolo === 'superadmin'; // Solo superadmin per backup
        default:
          return false;
      }
    };
    
    // Se la tab richiesta non è permessa, trova la prima tab permessa
    if (!isTabAllowed(tabFromParams)) {
      const allowedTabs = ['users', 'clienti', 'magazzino', 'interventi', 'logs', 'backup'].filter(isTabAllowed);
      if (allowedTabs.length > 0) {
        const firstAllowedTab = allowedTabs[0];
        setSearchParams({ tab: firstAllowedTab }, { replace: true });
        setActiveTab(firstAllowedTab as any);
        return;
      } else {
        // Nessuna tab permessa, reindirizza alla home
        navigate('/');
        return;
      }
    }
    
    if (tabFromParams !== activeTab) {
      setActiveTab(tabFromParams);
    }
  }, [searchParams, user]);

  // Carica tutti i contatori all'avvio (per mostrare i numeri nelle tab)
  const loadAllCounts = async () => {
    if (!token) return;
    
    try {
      // Carica tutti i dati in parallelo per i contatori
      const [usersRes, clientiRes, interventiRes, magazzinoRes] = await Promise.allSettled([
        axios.get(`${getApiUrl()}/api/users/`),
        axios.get(`${getApiUrl()}/clienti/?q=`),
        axios.get(`${getApiUrl()}/interventi/`),
        axios.get(`${getApiUrl()}/magazzino/?q=`)
      ]);

      if (usersRes.status === 'fulfilled') {
        setUsers(usersRes.value.data || []);
      }
      if (clientiRes.status === 'fulfilled') {
        setClienti(clientiRes.value.data || []);
      }
      if (interventiRes.status === 'fulfilled') {
        setInterventi(interventiRes.value.data || []);
      }
      if (magazzinoRes.status === 'fulfilled') {
        setMagazzino(magazzinoRes.value.data || []);
      }
    } catch (err: any) {
      console.error('Errore caricamento contatori:', err);
    }
  };

  const loadAuditLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (logFilters.entity_type) params.append('entity_type', logFilters.entity_type);
      if (logFilters.action) params.append('action', logFilters.action);
      if (logFilters.user_id) params.append('user_id', logFilters.user_id);
      if (logFilters.start_date) params.append('start_date', logFilters.start_date);
      if (logFilters.end_date) params.append('end_date', logFilters.end_date);
      params.append('limit', '100');
      
      const res = await axios.get(`${getApiUrl()}/api/audit-logs/?${params.toString()}`);
      setAuditLogs(res.data || []);
    } catch (err: any) {
      console.error('Errore caricamento audit logs:', err);
      setAuditLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const loadBackups = async () => {
    setBackupLoading(true);
    try {
      const res = await axios.get(`${getApiUrl()}/api/backups/`);
      setBackups(res.data || []);
    } catch (err: any) {
      console.error('Errore caricamento backup:', err);
      setBackups([]);
    } finally {
      setBackupLoading(false);
    }
  };

  // Funzioni per salvare/caricare selezione backup targets
  const saveSelectedBackupTargets = (ids: number[]) => {
    try {
      localStorage.setItem('selectedBackupTargetIds', JSON.stringify(ids));
    } catch (e) {
      console.error('Errore salvataggio selezione backup targets:', e);
    }
  };

  const loadSelectedBackupTargets = (): number[] => {
    try {
      const saved = localStorage.getItem('selectedBackupTargetIds');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Errore caricamento selezione backup targets:', e);
    }
    return [];
  };

  const loadBackupTargets = async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${getApiUrl()}/api/backup-targets`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const targets = Array.isArray(res.data) ? res.data : [];
      setBackupTargets(targets);
      // Carica la selezione salvata
      const savedIds = loadSelectedBackupTargets();
      // Filtra solo quelli che esistono ancora
      const validIds = savedIds.filter(id => targets.some((t: any) => t.id === id));
      if (validIds.length > 0) {
        setSelectedBackupTargetIds(validIds);
      }
    } catch (err) {
      console.error("Errore caricamento destinazioni backup:", err);
      setBackupTargets([]);
    }
  };

  const createBackupTarget = async () => {
    if (!token) return;
    try {
      let cfg: any = {};
      
      // Se è un provider con campi dedicati (SMB/FTP/SFTP), costruisci la config dai campi
      if (['smb', 'ftp', 'sftp'].includes(newTargetProvider)) {
        if (newTargetHost.trim()) {
          cfg.host = newTargetHost.trim();
        }
        if (newTargetUser.trim()) {
          cfg.user = newTargetUser.trim();
        }
        if (newTargetPass.trim()) {
          cfg.pass = newTargetPass.trim();
        }
        if (newTargetPort.trim()) {
          cfg.port = parseInt(newTargetPort.trim(), 10);
        }
        
        // Campi specifici per SMB
        if (newTargetProvider === 'smb') {
          if (newTargetShare.trim()) {
            cfg.share = newTargetShare.trim();
          }
          if (newTargetDomain.trim()) {
            cfg.domain = newTargetDomain.trim();
          }
        }
        
        // Campo specifico per SFTP
        if (newTargetProvider === 'sftp') {
          if (newTargetKeyFile.trim()) {
            cfg.key_file = newTargetKeyFile.trim();
          }
        }
      } else {
        // Per cloud providers (OneDrive/Drive/Dropbox), usa il JSON dal textarea
        if (newTargetConfig.trim()) {
          try {
            cfg = JSON.parse(newTargetConfig);
          } catch (parseErr) {
            alert(`Errore parsing configurazione JSON: ${parseErr}`);
            return;
          }
        }
      }
      
      const payload = {
        name: newTargetName.trim(),
        kind: newTargetProvider, // Usa 'kind' invece di 'provider' per compatibilità
        provider: newTargetProvider, // Mantieni anche 'provider' per compatibilità
        remote_path: newTargetRemotePath.trim(),
        enabled: true,
        config: cfg,
      };
      
      console.log('Invio payload backup target:', payload);
      
      await axios.post(
        `${getApiUrl()}/api/backup-targets`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // Reset tutti i campi
      setNewTargetName('');
      setNewTargetRemotePath('');
      setNewTargetConfig('');
      setNewTargetHost('');
      setNewTargetUser('');
      setNewTargetPass('');
      setNewTargetPort('');
      setNewTargetShare('');
      setNewTargetDomain('');
      setNewTargetKeyFile('');
      await loadBackupTargets();
      alert('Destinazione backup creata con successo!');
    } catch (err: any) {
      console.error('Errore creazione destinazione:', err);
      const errorMsg = err?.response?.data?.detail || err?.response?.data?.error || err.message || 'Errore sconosciuto';
      alert(`Errore creazione destinazione: ${errorMsg}`);
    }
  };

  const deleteBackupTarget = async (id: number) => {
    if (!token) return;
    if (!confirm('Vuoi eliminare questa destinazione?')) return;
    try {
      await axios.delete(`${getApiUrl()}/api/backup-targets/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Rimuovi anche dalla selezione se presente
      const newIds = selectedBackupTargetIds.filter((x) => x !== id);
      setSelectedBackupTargetIds(newIds);
      saveSelectedBackupTargets(newIds);
      await loadBackupTargets();
      alert('Destinazione eliminata con successo!');
    } catch (err: any) {
      alert(`Errore eliminazione destinazione: ${err?.response?.data?.detail || err.message}`);
    }
  };

  const startEditTarget = (target: any) => {
    setEditingTarget(target);
    setEditTargetName(target.name);
    const provider = (target.kind || target.provider || 'onedrive') as any;
    setEditTargetProvider(provider);
    setEditTargetRemotePath(target.remote_path || '');
    
    const cfg = target.config || {};
    if (['smb', 'ftp', 'sftp'].includes(provider)) {
      // Popola i campi dedicati
      setEditTargetHost(cfg.host || '');
      setEditTargetUser(cfg.user || '');
      setEditTargetPass(cfg.pass || '');
      setEditTargetPort(cfg.port?.toString() || '');
      if (provider === 'smb') {
        setEditTargetShare(cfg.share || '');
        setEditTargetDomain(cfg.domain || '');
      }
      if (provider === 'sftp') {
        setEditTargetKeyFile(cfg.key_file || '');
      }
      setEditTargetConfig('');
    } else {
      // Per cloud, usa JSON
      setEditTargetConfig(JSON.stringify(cfg, null, 2));
      setEditTargetHost('');
      setEditTargetUser('');
      setEditTargetPass('');
      setEditTargetPort('');
      setEditTargetShare('');
      setEditTargetDomain('');
      setEditTargetKeyFile('');
    }
  };

  const cancelEditTarget = () => {
    setEditingTarget(null);
    setEditTargetName('');
    setEditTargetProvider('onedrive');
    setEditTargetRemotePath('');
    setEditTargetConfig('');
    setEditTargetHost('');
    setEditTargetUser('');
    setEditTargetPass('');
    setEditTargetPort('');
    setEditTargetShare('');
    setEditTargetDomain('');
    setEditTargetKeyFile('');
  };

  const saveEditTarget = async () => {
    if (!token || !editingTarget) return;
    try {
      let cfg: any = {};
      
      // Se è un provider con campi dedicati (SMB/FTP/SFTP), costruisci la config dai campi
      if (['smb', 'ftp', 'sftp'].includes(editTargetProvider)) {
        if (editTargetHost.trim()) {
          cfg.host = editTargetHost.trim();
        }
        if (editTargetUser.trim()) {
          cfg.user = editTargetUser.trim();
        }
        if (editTargetPass.trim()) {
          cfg.pass = editTargetPass.trim();
        }
        if (editTargetPort.trim()) {
          cfg.port = parseInt(editTargetPort.trim(), 10);
        }
        
        // Campi specifici per SMB
        if (editTargetProvider === 'smb') {
          if (editTargetShare.trim()) {
            cfg.share = editTargetShare.trim();
          }
          if (editTargetDomain.trim()) {
            cfg.domain = editTargetDomain.trim();
          }
        }
        
        // Campo specifico per SFTP
        if (editTargetProvider === 'sftp') {
          if (editTargetKeyFile.trim()) {
            cfg.key_file = editTargetKeyFile.trim();
          }
        }
      } else {
        // Per cloud providers (OneDrive/Drive/Dropbox), usa il JSON dal textarea
        if (editTargetConfig.trim()) {
          try {
            cfg = JSON.parse(editTargetConfig);
          } catch (parseErr) {
            alert(`Errore parsing configurazione JSON: ${parseErr}`);
            return;
          }
        }
      }
      
      const payload = {
        id: editingTarget.id,
        name: editTargetName.trim(),
        kind: editTargetProvider,
        provider: editTargetProvider,
        remote_path: editTargetRemotePath.trim(),
        enabled: editingTarget.enabled !== false,
        config: cfg,
      };
      
      await axios.post(
        `${getApiUrl()}/api/backup-targets`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await loadBackupTargets();
      cancelEditTarget();
      alert('Destinazione modificata con successo!');
    } catch (err: any) {
      console.error('Errore modifica destinazione:', err);
      const errorMsg = err?.response?.data?.detail || err?.response?.data?.error || err.message || 'Errore sconosciuto';
      alert(`Errore modifica destinazione: ${errorMsg}`);
    }
  };

  const loadBackupConfig = async () => {
    try {
      const res = await axios.get(`${getApiUrl()}/impostazioni/`);
      const settings = res.data || {};
      setBackupConfig({
        nas_enabled: settings.backup_nas_enabled || false,
        nas_path: settings.backup_nas_path || '',
        cloud_enabled: settings.backup_cloud_enabled || false,
        cloud_provider: settings.backup_cloud_provider || '',
        local_path: settings.backup_local_path || '',
        // Local
        local_keep_count: settings.backup_local_keep_count ?? settings.backup_keep_count ?? 10,
        local_schedule_enabled: settings.backup_local_schedule_enabled ?? false,
        local_schedule_time: settings.backup_local_schedule_time ?? '02:00',

        // NAS
        nas_keep_count: settings.backup_nas_keep_count ?? settings.backup_keep_count ?? 10,
        nas_schedule_enabled: settings.backup_nas_schedule_enabled ?? false,
        nas_schedule_time: settings.backup_nas_schedule_time ?? '02:00',

        // Cloud
        cloud_keep_count: settings.backup_cloud_keep_count ?? settings.backup_keep_count ?? 10,
        cloud_schedule_enabled: settings.backup_cloud_schedule_enabled ?? false,
        cloud_schedule_time: settings.backup_cloud_schedule_time ?? '02:00'
      });
    } catch (err: any) {
      console.error('Errore caricamento configurazione backup:', err);
    }
  };

  const handleSaveBackupConfigWithState = async (configState?: any) => {
    const configToSave = configState || backupConfig;
    try {
      const res = await axios.get(`${getApiUrl()}/impostazioni/`);
      const currentSettings = res.data || {};
      
      const updatedSettings = {
        ...currentSettings,
        backup_nas_enabled: configToSave.nas_enabled,
        backup_nas_path: configToSave.nas_path || null,
        backup_cloud_enabled: configToSave.cloud_enabled,
        backup_cloud_provider: configToSave.cloud_provider || null,
        backup_local_path: configToSave.local_path || null,
        // manteniamo la vecchia chiave per backward compatibility
        backup_keep_count: configToSave.local_keep_count || 10,

        // Local
        backup_local_keep_count: configToSave.local_keep_count || 10,
        backup_local_schedule_enabled: configToSave.local_schedule_enabled === true || configToSave.local_schedule_enabled === 'true' || configToSave.local_schedule_enabled === 1,
        backup_local_schedule_time: configToSave.local_schedule_time || '02:00',

        // NAS
        backup_nas_keep_count: configToSave.nas_keep_count || 10,
        backup_nas_schedule_enabled: configToSave.nas_schedule_enabled === true || configToSave.nas_schedule_enabled === 'true' || configToSave.nas_schedule_enabled === 1,
        backup_nas_schedule_time: configToSave.nas_schedule_time || '02:00',

        // Cloud
        backup_cloud_keep_count: configToSave.cloud_keep_count || 10,
        backup_cloud_schedule_enabled: configToSave.cloud_schedule_enabled === true || configToSave.cloud_schedule_enabled === 'true' || configToSave.cloud_schedule_enabled === 1,
        backup_cloud_schedule_time: configToSave.cloud_schedule_time || '02:00'
      };
      
      console.log('Salvataggio impostazioni backup:', {
        local_schedule_enabled: updatedSettings.backup_local_schedule_enabled,
        nas_schedule_enabled: updatedSettings.backup_nas_schedule_enabled,
        cloud_schedule_enabled: updatedSettings.backup_cloud_schedule_enabled
      });
      
      await axios.put(`${getApiUrl()}/impostazioni/`, updatedSettings);
      if (!configState) {
        // Mostra alert solo se chiamato manualmente (non da toggle)
        alert('Configurazione backup salvata con successo!');
      }
    } catch (err: any) {
      console.error('Errore salvataggio configurazione backup:', err);
      throw err; // Rilancia l'errore per gestirlo nel chiamante
    }
  };

  const handleSaveBackupConfig = async () => {
    await handleSaveBackupConfigWithState();
  };

  const checkBackupStatus = async () => {
    try {
      const res = await axios.get(`${getApiUrl()}/api/backups/status`);
      setBackupStatus(res.data);
      
      // Se il backup è completato, in errore o in success (legacy), ferma il polling e ricarica la lista
      if (res.data.status === 'completed' || res.data.status === 'success' || res.data.status === 'error') {
        if (backupStatusInterval) {
          clearInterval(backupStatusInterval);
          setBackupStatusInterval(null);
        }
        setBackupLoading(false);
        // Ricarica la lista backup dopo un breve delay
        setTimeout(() => {
          loadBackups();
        }, 1000);
      }
    } catch (err: any) {
      console.error('Errore controllo stato backup:', err);
      // In caso di errore, ferma il polling dopo alcuni tentativi
      if (backupStatusInterval) {
        clearInterval(backupStatusInterval);
        setBackupStatusInterval(null);
      }
      setBackupLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    if (!confirm('Vuoi creare un nuovo backup completo? Questa operazione potrebbe richiedere alcuni minuti.')) {
      return;
    }

    setBackupLoading(true);
    setBackupStatus({ status: 'running', progress: 0, message: 'Avvio backup...' });
    
    try {
      const targetIdsParam = selectedBackupTargetIds.length
        ? `?target_ids=${selectedBackupTargetIds.join(',')}`
        : '';

      await axios.post(`${getApiUrl()}/api/backups/create${targetIdsParam}`, null, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      // Avvia il polling dello stato ogni 2 secondi
      const interval = setInterval(checkBackupStatus, 2000);
      setBackupStatusInterval(interval);
      
      // Controlla immediatamente lo stato
      checkBackupStatus();
    } catch (err: any) {
      alert('Errore: ' + (err.response?.data?.detail || 'Errore durante la creazione del backup'));
      setBackupLoading(false);
      setBackupStatus(null);
    }
  };

  // Cleanup dell'intervallo quando il componente viene smontato o cambia tab
  useEffect(() => {
    return () => {
      if (backupStatusInterval) {
        clearInterval(backupStatusInterval);
      }
    };
  }, [backupStatusInterval]);

  const handleDownloadBackup = async (backupId: string) => {
    try {
      const response = await axios.get(`${getApiUrl()}/api/backups/${backupId}/download`, {
        responseType: 'blob',
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', backupId);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Errore durante il download: ' + (err.response?.data?.detail || 'Errore sconosciuto'));
    }
  };

  const handleDeleteBackup = async (backupId: string) => {
    if (!confirm(`Sei sicuro di voler eliminare il backup "${backupId}"?`)) {
      return;
    }

    try {
      await axios.delete(`${getApiUrl()}/api/backups/${backupId}`);
      alert('Backup eliminato con successo');
      loadBackups();
    } catch (err: any) {
      alert('Errore: ' + (err.response?.data?.detail || 'Errore durante l\'eliminazione'));
    }
  };

  const handleRestoreBackup = async (backupId: string, restoreType: string = 'full') => {
    const typeLabels: { [key: string]: string } = {
      full: 'completo',
      database: 'solo database',
      volumes: 'solo volumi',
      config: 'solo configurazione'
    };

    if (!confirm(`ATTENZIONE: Vuoi ripristinare il backup "${backupId}" (${typeLabels[restoreType]})? Questa operazione sovrascriverà i dati attuali.`)) {
      return;
    }

    setRestoringBackup(backupId);
    try {
      const res = await axios.post(`${getApiUrl()}/api/backups/${backupId}/restore`, {
        restore_type: restoreType
      });
      alert('Ripristino avviato! I container verranno riavviati automaticamente al termine.');
    } catch (err: any) {
      alert('Errore: ' + (err.response?.data?.detail || 'Errore durante il ripristino'));
    } finally {
      setRestoringBackup(null);
    }
  };

  const handleBrowseLocalPath = () => {
    // Usa File System Access API se disponibile (Chrome/Edge)
    if ('showDirectoryPicker' in window) {
      (window as any).showDirectoryPicker().then((dirHandle: any) => {
        // L'API non espone direttamente il percorso completo per motivi di sicurezza
        // Chiediamo all'utente di inserire manualmente il percorso
        const path = prompt('Inserisci il percorso completo della cartella selezionata:');
        if (path) {
          setBackupConfig({ ...backupConfig, local_path: path });
        }
      }).catch(() => {
        // L'utente ha annullato o c'è stato un errore
      });
    } else {
      // Fallback per browser che non supportano File System Access API
      const path = prompt('Inserisci il percorso completo della cartella dove salvare i backup:\n\nEsempio Windows: C:\\Backups\\Sistema54\nEsempio Linux/Mac: /home/user/backups');
      if (path) {
        setBackupConfig({ ...backupConfig, local_path: path });
      }
    }
  };

  const handleRestoreFromFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Verifica che sia un file di backup valido
    if (!file.name.match(/\.(tar\.gz|zip)$/i)) {
      alert('Errore: Il file deve essere un backup valido (.tar.gz o .zip)');
      event.target.value = '';
      return;
    }

    if (!confirm(`ATTENZIONE: Vuoi ripristinare il backup dal file "${file.name}"? Questa operazione sovrascriverà i dati attuali.`)) {
      event.target.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post(`${getApiUrl()}/api/backups/upload-restore?restore_type=full`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        }
      });
      alert('Ripristino avviato! Il file è stato caricato e il ripristino è in corso. I container verranno riavviati automaticamente al termine.');
      loadBackups();
    } catch (err: any) {
      alert('Errore: ' + (err.response?.data?.detail || 'Errore durante il caricamento e ripristino del backup'));
    } finally {
      event.target.value = '';
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'users') {
        const res = await axios.get(`${getApiUrl()}/api/users/`);
        setUsers(res.data || []);
        // Carica anche utenti eliminati
        try {
          const deletedRes = await axios.get(`${getApiUrl()}/api/users/deleted`);
          setDeletedUsers(deletedRes.data || []);
        } catch (err) {
          console.error('Errore caricamento utenti eliminati:', err);
          setDeletedUsers([]);
        }
      } else if (activeTab === 'clienti') {
        const apiUrl = getApiUrl();
        console.log('Caricamento clienti...', { apiUrl, searchTerm, authHeader: axios.defaults.headers.common['Authorization'] });
        const skip = (clientiPage - 1) * itemsPerPage;
        const res = await axios.get(`${apiUrl}/clienti/?q=${searchTerm}&skip=${skip}&limit=${itemsPerPage}`);
        console.log('Risposta clienti:', res.data, 'Numero clienti:', res.data?.length);
        
        if (Array.isArray(res.data)) {
          setClienti(res.data || []);
          // Stima totale
          if (res.data.length < itemsPerPage) {
            setClientiTotal((clientiPage - 1) * itemsPerPage + res.data.length);
          } else {
            setClientiTotal((clientiPage + 1) * itemsPerPage);
          }
        } else if (res.data.items && typeof res.data.total === 'number') {
          setClienti(res.data.items);
          setClientiTotal(res.data.total);
        } else {
          setClienti(res.data || []);
          setClientiTotal(res.data?.length || 0);
        }
      } else if (activeTab === 'interventi') {
        const skip = (interventiPage - 1) * itemsPerPage;
        const res = await axios.get(`${getApiUrl()}/interventi/?q=${searchTerm}&skip=${skip}&limit=${itemsPerPage}`);
        
        if (Array.isArray(res.data)) {
          setInterventi(res.data);
          // Stima totale
          if (res.data.length < itemsPerPage) {
            setInterventiTotal((interventiPage - 1) * itemsPerPage + res.data.length);
          } else {
            setInterventiTotal((interventiPage + 1) * itemsPerPage);
          }
        } else if (res.data.items && typeof res.data.total === 'number') {
          setInterventi(res.data.items);
          setInterventiTotal(res.data.total);
        } else {
          setInterventi(res.data || []);
          setInterventiTotal(res.data?.length || 0);
        }
      } else if (activeTab === 'magazzino') {
        const res = await axios.get(`${getApiUrl()}/magazzino/?q=${searchTerm}`);
        setMagazzino(res.data);
      } else if (activeTab === 'logs') {
        await loadAuditLogs();
      } else if (activeTab === 'backup') {
        await loadBackups();
        await loadBackupConfig();
        await loadBackupTargets();
      }
    } catch (err: any) {
      console.error('Errore caricamento dati:', err);
      if (err.response) {
        console.error('Status:', err.response.status);
        console.error('Data:', err.response.data);
        if (err.response.status === 401) {
          console.error('Errore di autenticazione - token non valido');
        }
      } else if (err.request) {
        console.error('Request:', err.request);
      }
      // Imposta array vuoto in caso di errore per evitare errori di rendering
      if (activeTab === 'clienti') {
        setClienti([]);
      }
    } finally {
      setLoading(false);
    }
  };

  // Carica tutti i contatori all'avvio
  useEffect(() => {
    if (token) {
      loadAllCounts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Carica i dati quando cambia il tab (solo se c'è un token)
  useEffect(() => {
    if (token) {
      if (activeTab === 'logs') {
        loadAuditLogs();
      } else if (activeTab === 'backup') {
        loadBackups();
        loadBackupConfig();
        loadBackupTargets();
      } else {
        loadData();
      }
    } else {
      console.warn('Token non presente, impossibile caricare i dati');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, token, searchTerm]);

  // Carica i dati quando cambia il termine di ricerca (solo per clienti, magazzino e interventi)
  useEffect(() => {
    if (activeTab === 'clienti' || activeTab === 'magazzino' || activeTab === 'interventi') {
      if (searchTerm.length > 2) {
        const delay = setTimeout(() => {
          if (activeTab === 'clienti') {
            setClientiPage(1); // Reset alla prima pagina quando cambia la ricerca
          } else if (activeTab === 'interventi') {
            setInterventiPage(1); // Reset alla prima pagina quando cambia la ricerca
          }
          loadData();
        }, 300);
        return () => clearTimeout(delay);
      } else if (searchTerm.length === 0) {
        // Carica immediatamente quando il campo di ricerca è vuoto
        if (activeTab === 'clienti') {
          setClientiPage(1); // Reset alla prima pagina
        } else if (activeTab === 'interventi') {
          setInterventiPage(1); // Reset alla prima pagina
        }
        loadData();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  // Ricarica quando cambia la pagina (solo per clienti e interventi)
  useEffect(() => {
    if (token && (activeTab === 'clienti' || activeTab === 'interventi')) {
      if (searchTerm.length > 2 || searchTerm.length === 0) {
        loadData();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientiPage, interventiPage]);

  const TabButton = ({ id, label, icon: Icon, count }: { id: string; label: string; icon: any; count?: number }) => (
    <button
      onClick={() => {
        setActiveTab(id as any);
        setSearchParams({ tab: id }, { replace: false });
      }}
      className={`flex items-center gap-2 px-4 py-3 rounded-xl transition-all font-semibold ${
        activeTab === id
          ? 'bg-blue-600 text-white shadow-md'
          : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
      }`}
    >
      <Icon className="w-5 h-5" />
      <span>{label}</span>
      {count !== undefined && (
        <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === id ? 'bg-white/20' : 'bg-gray-100'}`}>
          {count}
        </span>
      )}
    </button>
  );

  const handleCreateProdotto = async (data: any) => {
    try {
      await axios.post(`${getApiUrl()}/magazzino/`, data);
      alert('Prodotto creato con successo!');
      loadData();
      // Aggiorna anche i contatori
      loadAllCounts();
    } catch (err: any) {
      alert('Errore: ' + (err.response?.data?.detail || 'Errore sconosciuto'));
    }
  };

  const handleOpenPDF = async (interventoId: number) => {
    try {
      // Prima recupera i dati dell'intervento per ottenere il numero_relazione
      let numeroRit = `RIT-${interventoId}`;
      try {
        const interventoResponse = await axios.get(`${getApiUrl()}/interventi/${interventoId}`);
        if (interventoResponse.data?.numero_relazione) {
          numeroRit = interventoResponse.data.numero_relazione;
        }
      } catch (e) {
        console.warn('Impossibile recuperare numero relazione, uso ID:', e);
      }

      const response = await axios.get(`${getApiUrl()}/interventi/${interventoId}/pdf`, {
        responseType: 'blob',
      });
      
      // Verifica che il contenuto sia valido
      if (!response.data || response.data.size === 0) {
        alert('⚠️ Errore: Il PDF è vuoto o non valido.');
        return;
      }
      
      // Estrai il nome file dall'header Content-Disposition se presente
      const contentDisposition = response.headers['content-disposition'];
      let filename = `${numeroRit}.pdf`;
      if (contentDisposition) {
        // Prova a estrarre il filename da Content-Disposition (supporta sia filename che filename*)
        const filenameMatch = contentDisposition.match(/filename\*?=['"]?([^'";\n]+)['"]?/i);
        if (filenameMatch && filenameMatch[1]) {
          // Rimuovi eventuali prefissi UTF-8 e pulisci il nome
          let extractedFilename = filenameMatch[1].replace(/^UTF-8''/i, '').replace(/['"]/g, '');
          // Rimuovi estensione .pdf se presente (la aggiungiamo dopo)
          extractedFilename = extractedFilename.replace(/\.pdf$/i, '');
          if (extractedFilename) {
            filename = `${extractedFilename}.pdf`;
          }
        }
      }
      
      // Crea un File object invece di Blob per preservare meglio il nome
      const file = new File([response.data], filename, { type: 'application/pdf' });
      const url = window.URL.createObjectURL(file);
      
      // Crea un link temporaneo per il download con il nome corretto
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.setAttribute('download', filename);
      
      // Aggiungi al DOM, clicca e rimuovi (questo forza il download con il nome corretto)
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Apri anche in una nuova finestra per visualizzazione
      // Nota: window.open potrebbe non rispettare il nome del file, ma il download è già avvenuto con il nome corretto
      setTimeout(() => {
        const pdfWindow = window.open(url, '_blank');
        if (!pdfWindow) {
          // Se il popup è bloccato, almeno il download è già avvenuto con il nome corretto
          console.log('Popup bloccato, ma il download è già avvenuto con il nome:', filename);
        }
        
        // Pulisci l'URL dopo un delay più lungo per permettere il caricamento
        setTimeout(() => {
          window.URL.revokeObjectURL(url);
        }, 5000);
      }, 100);
    } catch (err: any) {
      alert('Errore nel caricamento del PDF: ' + (err.response?.data?.detail || 'Errore sconosciuto'));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans">
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-full transition-all"
              title="Home"
            >
              <Home className="w-6 h-6" />
            </button>
            <button
              onClick={() => navigate(-1)}
              className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-all"
              title="Torna indietro"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-1">
              <Shield className="w-6 h-6 text-blue-600" />
              <h1 className="text-xl font-bold text-slate-800">Pannello Admin</h1>
            </div>
          </div>
          <button
            onClick={() => {
              if (window.confirm('Sei sicuro di voler uscire?')) {
                logout();
                navigate('/login');
              }
            }}
            className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-all"
            title="Logout"
          >
            <LogOut className="w-6 h-6" />
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 sm:p-6">
        {/* Tabs */}
        <div className="flex flex-wrap gap-3 mb-6">
          {/* Tab Utenti - solo per admin/superadmin */}
          {(user?.ruolo === 'admin' || user?.ruolo === 'superadmin') && (
            <TabButton id="users" label="Utenti" icon={Users} count={users.length} />
          )}
          {/* Tab Clienti - solo per admin/superadmin o operatori con permesso */}
          {(user?.ruolo === 'admin' || user?.ruolo === 'superadmin' || user?.permessi?.can_view_clienti) && (
            <TabButton id="clienti" label="Clienti" icon={Building2} count={clienti.length} />
          )}
          {/* Tab Magazzino - per admin/superadmin o operatori con permesso */}
          {(user?.ruolo === 'admin' || user?.ruolo === 'superadmin' || user?.permessi?.can_view_magazzino) && (
            <TabButton id="magazzino" label="Magazzino" icon={Package} count={magazzino.length} />
          )}
          {/* Tab Interventi - solo per admin/superadmin o operatori con permesso */}
          {(user?.ruolo === 'admin' || user?.ruolo === 'superadmin' || user?.permessi?.can_view_interventi) && (
            <TabButton id="interventi" label="Interventi" icon={FileText} count={interventi.length} />
          )}
          {/* Tab Log - solo per admin/superadmin */}
          {(user?.ruolo === 'admin' || user?.ruolo === 'superadmin') && (
            <TabButton id="logs" label="Log" icon={Activity} />
          )}
          {/* Tab Backup - solo per superadmin */}
          {user?.ruolo === 'superadmin' && (
            <TabButton id="backup" label="Backup" icon={HardDrive} />
          )}
        </div>

        {/* Search Bar per Clienti, Magazzino e Interventi */}
        {(activeTab === 'clienti' || activeTab === 'magazzino' || activeTab === 'interventi') && (
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={
                  activeTab === 'clienti'
                    ? 'Cerca cliente per ragione sociale, P.IVA o CF...'
                    : activeTab === 'magazzino'
                    ? 'Cerca prodotto per codice o descrizione...'
                    : 'Cerca RIT per cliente, numero RIT, seriale, part number o prodotto...'
                }
                className="w-full bg-white border border-gray-200 rounded-xl pl-11 pr-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">Caricamento...</div>
        ) : (
          <>
            {activeTab === 'users' && (
              <IOSCard>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-bold text-gray-900">Gestione Utenti</h2>
                  <button
                    onClick={() => setCreatingUser(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold"
                  >
                    <Plus className="w-4 h-4" />
                    Nuovo Utente
                  </button>
                </div>

                <div className="space-y-3">
                  {users
                    .filter((u) => {
                      // Se l'utente corrente è Admin (non SuperAdmin), nascondi gli utenti SuperAdmin
                      if (user?.ruolo === 'admin' && u.ruolo === 'superadmin') {
                        return false;
                      }
                      return true;
                    })
                    .map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <Users className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <div className="font-bold text-gray-900">{u.nome_completo}</div>
                          <div className="text-sm text-gray-600">{u.email}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            Ruolo: <span className="font-semibold">{u.ruolo}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold ${
                            u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {u.is_active ? 'Attivo' : 'Disattivato'}
                        </span>

                        {/* Azioni */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setEditingUser(u)}
                            title="Modifica"
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>

                          {(user?.ruolo === 'admin' || user?.ruolo === 'superadmin') && (
                            <button
                              onClick={async () => {
                                if (!confirm(`Vuoi inviare un nuovo link di accesso a ${u.email}?`)) return;
                                try {
                                  await axios.post(
                                    `${getApiUrl()}/api/auth/regenerate-access/${u.id}`,
                                    {},
                                    { headers: { Authorization: `Bearer ${token}` } }
                                  );
                                  alert('Link di accesso inviato via email.');
                                } catch (err: any) {
                                  console.error('Errore rigenerazione accesso:', err);
                                  alert(err?.response?.data?.detail || "Errore durante la rigenerazione dell'accesso");
                                }
                              }}
                              title="Rigenera accesso"
                              className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            >
                              <RefreshCcw className="w-4 h-4" />
                            </button>
                          )}

                          {(user?.ruolo === 'admin' || user?.ruolo === 'superadmin') && (
                            <button
                              onClick={async () => {
                                if (!confirm(`Sei sicuro di voler eliminare l'utente "${u.nome_completo}" (${u.email})?\n\nLo storico verrà preservato, ma l'utente non sarà più visibile nelle liste.`)) return;
                                try {
                                  const res = await axios.delete(`${getApiUrl()}/api/users/${u.id}`, {
                                    headers: { Authorization: `Bearer ${token}` },
                                  });

                                  if (res.data?.self_deleted) {
                                    alert('Il tuo utente è stato eliminato. Verrai disconnesso.');
                                    logout();
                                    navigate('/login');
                                    return;
                                  }
                                  
                                  alert('Utente eliminato con successo (soft delete)');
                                  loadData(); // Ricarica i dati
                                } catch (err: any) {
                                  const msg = err.response?.data?.detail || 'Errore durante l\'eliminazione';
                                  alert(`Errore: ${msg}`);
                                }
                              }}
                              title="Elimina utente"
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {users.filter((u) => {
                    // Se l'utente corrente è Admin (non SuperAdmin), nascondi gli utenti SuperAdmin
                    if (user?.ruolo === 'admin' && u.ruolo === 'superadmin') {
                      return false;
                    }
                    return true;
                  }).length === 0 && !loading && (
                    <div className="text-center py-12 text-gray-500">
                      Nessun utente presente
                    </div>
                  )}
                </div>
                
                {/* Sezione Utenti Eliminati */}
                <div className="mt-8 pt-6 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-md font-semibold text-gray-700">Utenti Eliminati</h3>
                    <button
                      onClick={() => {
                        setShowDeletedUsers(!showDeletedUsers);
                        if (!showDeletedUsers && deletedUsers.length === 0) {
                          // Carica utenti eliminati se non ancora caricati
                          axios.get(`${getApiUrl()}/api/users/deleted`)
                            .then(res => setDeletedUsers(res.data || []))
                            .catch(err => console.error('Errore caricamento utenti eliminati:', err));
                        }
                      }}
                      className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      {showDeletedUsers ? 'Nascondi' : 'Mostra'} ({deletedUsers.length})
                    </button>
                  </div>
                  
                  {showDeletedUsers && (
                    <div className="space-y-3">
                      {deletedUsers.length === 0 ? (
                        <div className="text-center py-8 text-gray-500 text-sm">
                          Nessun utente eliminato
                        </div>
                      ) : (
                        deletedUsers
                          .filter((u) => {
                            // Se l'utente corrente è Admin (non SuperAdmin), nascondi gli utenti SuperAdmin eliminati
                            if (user?.ruolo === 'admin' && u.ruolo === 'superadmin') {
                              return false;
                            }
                            return true;
                          })
                          .map((u) => (
                          <div
                            key={u.id}
                            className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 opacity-75"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                                <Users className="w-5 h-5 text-gray-400" />
                              </div>
                              <div>
                                <div className="font-bold text-gray-600 line-through">{u.nome_completo}</div>
                                <div className="text-sm text-gray-500">{u.email}</div>
                                <div className="text-xs text-gray-400 mt-1">
                                  Ruolo: <span className="font-semibold">{u.ruolo}</span> • 
                                  Eliminato il: {u.deleted_at ? new Date(u.deleted_at).toLocaleDateString('it-IT') : 'N/A'}
                                </div>
                              </div>
                            </div>
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-gray-200 text-gray-600">
                              Eliminato
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </IOSCard>
            )}
            {activeTab === 'clienti' && (
              <IOSCard>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-bold text-gray-900">Anagrafica Clienti</h2>
                  <Link
                    to="/nuovo-cliente"
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold"
                  >
                    <Plus className="w-4 h-4" />
                    Nuovo Cliente
                  </Link>
                </div>
                <div className="space-y-3">
                  {loading ? (
                    <div className="text-center py-12 text-gray-500">Caricamento...</div>
                  ) : clienti.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      {searchTerm ? 'Nessun cliente trovato' : 'Nessun cliente presente'}
                    </div>
                  ) : (
                    clienti.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors"
                      >
                        <div>
                          <div className="font-bold text-gray-900">{c.ragione_sociale}</div>
                          <div className="text-sm text-gray-600 mt-1">{c.indirizzo}</div>
                          {c.p_iva && (
                            <div className="text-xs text-gray-500 mt-1">P.IVA: {c.p_iva}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Link
                            to={`/nuovo-cliente/${c.id}`}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </Link>
                          {(user?.ruolo === 'admin' || user?.ruolo === 'superadmin') && (
                            <button
                              onClick={async () => {
                                if (!window.confirm(`Sei sicuro di voler eliminare il cliente "${c.ragione_sociale}"?\n\nLo storico verrà preservato, ma il cliente non sarà più visibile nelle liste.`)) {
                                  return;
                                }
                                try {
                                  await axios.delete(`${getApiUrl()}/clienti/${c.id}`, {
                                    headers: token ? { Authorization: `Bearer ${token}` } : {}
                                  });
                                  alert('Cliente eliminato con successo (soft delete)');
                                  // Ricarica i dati
                                  loadData();
                                } catch (err: any) {
                                  const msg = err.response?.data?.detail || 'Errore durante l\'eliminazione';
                                  alert(`Errore: ${msg}`);
                                }
                              }}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Elimina cliente"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                
                {/* Paginazione Clienti */}
                {!loading && clientiTotal > itemsPerPage && (
                  <div className="flex items-center justify-between mt-6 px-2">
                    <button
                      onClick={() => setClientiPage(prev => Math.max(1, prev - 1))}
                      disabled={clientiPage === 1}
                      className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Precedente
                    </button>
                    
                    <div className="text-sm text-gray-600">
                      Pagina {clientiPage} di {Math.ceil(clientiTotal / itemsPerPage)}
                      <span className="ml-2 text-gray-400">({clientiTotal} totali)</span>
                    </div>
                    
                    <button
                      onClick={() => setClientiPage(prev => prev + 1)}
                      disabled={clientiPage * itemsPerPage >= clientiTotal}
                      className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      Successiva
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </IOSCard>
            )}

            {activeTab === 'magazzino' && (
              <IOSCard>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-bold text-gray-900">Gestione Magazzino</h2>
                  {/* Mostra pulsante "Nuovo Prodotto" solo se l'utente ha il permesso */}
                  {(user?.ruolo === 'admin' || user?.ruolo === 'superadmin' || user?.permessi?.can_create_magazzino) && (
                    <Link
                      to="/nuovo-prodotto"
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold"
                    >
                      <Plus className="w-4 h-4" />
                      Nuovo Prodotto
                    </Link>
                  )}
                </div>
                <div className="space-y-3">
                  {magazzino.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors"
                    >
                      <div>
                        <div className="font-bold text-gray-900">{p.descrizione}</div>
                        <div className="text-sm text-gray-600 mt-1">Codice: {p.codice_articolo}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          Prezzo: €{p.prezzo_vendita?.toFixed(2)} | Giacenza: {p.giacenza}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold ${
                            p.giacenza > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {p.giacenza > 0 ? 'Disponibile' : 'Esaurito'}
                        </span>
                        {/* Mostra pulsanti modifica ed eliminazione solo se l'utente ha i permessi */}
                        {(user?.ruolo === 'admin' || user?.ruolo === 'superadmin' || user?.permessi?.can_edit_magazzino) && (
                          <Link
                            to={`/nuovo-prodotto/${p.id}`}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </Link>
                        )}
                        {(user?.ruolo === 'admin' || user?.ruolo === 'superadmin') && (
                          <button
                            onClick={async () => {
                              if (!window.confirm(`Sei sicuro di voler eliminare il prodotto "${p.descrizione}"?\n\nLo storico verrà preservato, ma il prodotto non sarà più visibile nelle liste.`)) {
                                return;
                              }
                              try {
                                await axios.delete(`${getApiUrl()}/magazzino/${p.id}`, {
                                  headers: token ? { Authorization: `Bearer ${token}` } : {}
                                });
                                alert('Prodotto eliminato con successo (soft delete)');
                                // Ricarica i dati
                                const res = await axios.get(`${getApiUrl()}/magazzino/?q=${searchTerm}`);
                                setMagazzino(res.data || []);
                              } catch (err: any) {
                                const msg = err.response?.data?.detail || 'Errore durante l\'eliminazione';
                                alert(`Errore: ${msg}`);
                              }
                            }}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Elimina prodotto"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </IOSCard>
            )}

            {activeTab === 'interventi' && (
              <IOSCard>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-bold text-gray-900">Lista Interventi</h2>
                </div>
                <div className="space-y-3">
                  {interventi.map((i) => (
                    <div
                      key={i.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors"
                    >
                      <div>
                        <div className="font-bold text-gray-900">{i.numero_relazione}</div>
                        <div className="text-sm text-gray-600 mt-1">{i.cliente_ragione_sociale}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(i.data_creazione).toLocaleDateString('it-IT')} - {i.macro_categoria}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => navigate(`/edit-rit/${i.id}`)}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold"
                        >
                          Modifica
                        </button>
                        <button
                          onClick={() => handleOpenPDF(i.id)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold"
                        >
                          PDF
                        </button>
                        {(user?.ruolo === 'admin' || user?.ruolo === 'superadmin') && (
                          <button
                            onClick={async () => {
                              if (!window.confirm(`Sei sicuro di voler eliminare il RIT "${i.numero_relazione}"?\n\nLo storico verrà preservato, ma il RIT non sarà più visibile nelle liste.`)) {
                                return;
                              }
                              try {
                                await axios.delete(`${getApiUrl()}/interventi/${i.id}`, {
                                  headers: token ? { Authorization: `Bearer ${token}` } : {}
                                });
                                alert('RIT eliminato con successo (soft delete)');
                                // Ricarica i dati
                                loadData();
                              } catch (err: any) {
                                const msg = err.response?.data?.detail || 'Errore durante l\'eliminazione';
                                alert(`Errore: ${msg}`);
                              }
                            }}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Elimina RIT"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Paginazione Interventi */}
                {!loading && interventiTotal > itemsPerPage && (
                  <div className="flex items-center justify-between mt-6 px-2">
                    <button
                      onClick={() => setInterventiPage(prev => Math.max(1, prev - 1))}
                      disabled={interventiPage === 1}
                      className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Precedente
                    </button>
                    
                    <div className="text-sm text-gray-600">
                      Pagina {interventiPage} di {Math.ceil(interventiTotal / itemsPerPage)}
                      <span className="ml-2 text-gray-400">({interventiTotal} totali)</span>
                    </div>
                    
                    <button
                      onClick={() => setInterventiPage(prev => prev + 1)}
                      disabled={interventiPage * itemsPerPage >= interventiTotal}
                      className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      Successiva
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </IOSCard>
            )}

            {activeTab === 'backup' && (
              <div className="space-y-6">
                {/* Sezione Configurazione */}
                <IOSCard>
                  <h2 className="text-lg font-bold text-gray-900 mb-4">Configurazione Backup <span className="ml-2 text-xs px-2 py-1 rounded-full bg-indigo-100 text-indigo-800 align-middle">UI v3</span></h2>
                  
                  {/* Configurazione NAS */}
                  <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-gray-800">Backup su NAS (Rete Locale)</h3>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={backupConfig.nas_enabled || false}
                          onChange={(e) => setBackupConfig({ ...backupConfig, nas_enabled: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                    {backupConfig.nas_enabled && (
                      <div className="mt-3 space-y-3 animate-in fade-in">
                        <IOSInput
                          label="Percorso NAS"
                          placeholder="Es: /mnt/nas/backups o \\server\backups"
                          value={backupConfig.nas_path || ''}
                          onChange={(e) => setBackupConfig({ ...backupConfig, nas_path: e.target.value })}
                        />
                        <p className="text-xs text-gray-500">
                          Inserisci il percorso completo della cartella NAS dove salvare i backup. 
                          Su Windows usa formato UNC (\\server\share), su Linux/Mac usa percorso montato (/mnt/nas/backups).
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Configurazione Cloud Storage */}
                  <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-gray-800">Backup su Cloud Storage</h3>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={backupConfig.cloud_enabled || false}
                          onChange={(e) => setBackupConfig({ ...backupConfig, cloud_enabled: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                    {backupConfig.cloud_enabled && (
                      <div className="mt-3 space-y-3 animate-in fade-in">
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">
                            Provider Cloud
                          </label>
                          <select
                            value={backupConfig.cloud_provider || ''}
                            onChange={(e) => setBackupConfig({ ...backupConfig, cloud_provider: e.target.value })}
                            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                          >
                            <option value="">Seleziona provider</option>
                            <option value="onedrive">OneDrive</option>
                            <option value="gdrive">Google Drive</option>
                            <option value="dropbox">Dropbox</option>
                          </select>
                        </div>
                        {backupConfig.cloud_provider && (
                          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <p className="text-xs text-blue-800 mb-2">
                              <strong>Configurazione rclone richiesta:</strong>
                            </p>
                            <p className="text-xs text-blue-700">
                              Per utilizzare {backupConfig.cloud_provider === 'onedrive' ? 'OneDrive' : backupConfig.cloud_provider === 'gdrive' ? 'Google Drive' : 'Dropbox'}, 
                              devi prima configurare rclone sul server. Vedi la documentazione in <code className="bg-blue-100 px-1 rounded">backup/rclone_setup.md</code>
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Configurazione Percorso Backup Locale */}
                  <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <h3 className="font-semibold text-gray-800 mb-3">Percorso Backup Locale</h3>
                    <div className="flex gap-2">
                      <IOSInput
                        label="Cartella di destinazione backup"
                        placeholder="Es: C:\Backup (verrà montato come /mnt/backup-local)"
                        value={backupConfig.local_path || ''}
                        onChange={(e) => setBackupConfig({ ...backupConfig, local_path: e.target.value })}
                        className="flex-1"
                      />
                      <div className="flex items-end pb-4">
                        <button
                          type="button"
                          onClick={handleBrowseLocalPath}
                          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm font-semibold whitespace-nowrap"
                        >
                          <FolderOpen className="w-4 h-4 inline mr-2" />
                          Sfoglia
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Seleziona la cartella sul PC dove salvare i backup. 
                      <strong className="text-blue-600"> Per Docker Desktop:</strong> Inserisci il percorso Windows (es: C:\Backup). 
                      Il sistema convertirà automaticamente in /mnt/backup-local nel container. 
                      Se lasciato vuoto, verrà usata la cartella predefinita "backups".
                    </p>
                    {backupConfig.local_path && backupConfig.local_path.startsWith('C:\\') && (
                      <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-xs text-blue-800">
                          <strong>ℹ️ Nota:</strong> Il percorso <code className="bg-blue-100 px-1 rounded">C:\Backup</code> verrà automaticamente montato come <code className="bg-blue-100 px-1 rounded">/mnt/backup-local</code> nel container Docker.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Help: Configurazione Cloud */}
                  <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-blue-900">Guida rapida: Cloud (OneDrive / Google Drive / Dropbox)</h3>
                        <p className="text-xs text-blue-800 mt-1">
                          Le destinazioni Cloud usano <strong>rclone</strong>. Devi creare un "remote" rclone e incollare qui la configurazione (JSON).
                        </p>
                      </div>
                    </div>

                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm font-semibold text-blue-900">Apri istruzioni dettagliate</summary>
                      <div className="mt-3 text-sm text-blue-900 space-y-3">
                        <div>
                          <div className="font-semibold">1) Crea il remote rclone</div>
                          <ul className="list-disc ml-5 mt-1 text-blue-900/90 text-sm">
                            <li>
                              Opzione A (consigliata): sul tuo PC installa rclone e lancia <code className="bg-blue-100 px-1 rounded">rclone config</code>.
                            </li>
                            <li>
                              Opzione B: nel container backend lancia <code className="bg-blue-100 px-1 rounded">docker exec -it sistema54_rit-backend-1 rclone config</code>.
                            </li>
                            <li>Durante la configurazione scegli il provider (OneDrive/Google Drive/Dropbox) e completa l'autorizzazione OAuth.</li>
                          </ul>
                        </div>

                        <div>
                          <div className="font-semibold">2) Esporta la configurazione in JSON</div>
                          <p className="text-blue-900/90 mt-1">
                            Esegui <code className="bg-blue-100 px-1 rounded">rclone config dump</code> e copia l'output (JSON).
                          </p>
                        </div>

                        <div>
                          <div className="font-semibold">3) Aggiungi la destinazione nella web app</div>
                          <ul className="list-disc ml-5 mt-1 text-blue-900/90 text-sm">
                            <li><strong>Nome destinazione</strong>: un'etichetta (es. <em>OneDrive</em>).</li>
                            <li><strong>Tipo</strong>: scegli il provider (rclone).</li>
                            <li><strong>Percorso remoto</strong>: formato <code className="bg-blue-100 px-1 rounded">REMOTE:/cartella</code> (es. <code className="bg-blue-100 px-1 rounded">onedrive_s54:/Sistema54/backups</code>).</li>
                            <li><strong>Config JSON</strong>: incolla il JSON ottenuto da <code className="bg-blue-100 px-1 rounded">rclone config dump</code>.</li>
                          </ul>
                        </div>

                        <div className="text-xs text-blue-900/80">
                          Nota sicurezza: la configurazione può contenere token di accesso. Trattala come una password e non condividerla.
                        </div>
                      </div>
                    </details>
                  </div>

                  <button
                    onClick={handleSaveBackupConfig}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold"
                  >
                    Salva Configurazione
                  </button>
                </IOSCard>

                {/* Sezione Gestione Backup */}
                <IOSCard>
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-bold text-gray-900">Gestione Backup <span className="ml-2 text-xs px-2 py-1 rounded-full bg-green-100 text-green-800 align-middle">UI v3</span></h2>
                    <div className="flex gap-2">
                      <button
                        onClick={handleCreateBackup}
                        disabled={backupLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold disabled:opacity-50"
                      >
                        <Upload className="w-4 h-4" />
                        Crea Backup
                      </button>
                      <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold cursor-pointer">
                        <FileUp className="w-4 h-4" />
                        Ripristina da File
                        <input
                          type="file"
                          accept=".tar.gz,.zip"
                          onChange={handleRestoreFromFile}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Scheduler & Retention per destinazione */}
                  <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-xl">
                    <h3 className="font-semibold text-gray-800 mb-3">Scheduler e Retention</h3>
                    <p className="text-xs text-gray-600 mb-4">
                      Configura retention e pianificazione in modo indipendente per <strong>Locale</strong>, <strong>NAS</strong> e <strong>Cloud</strong>.
                      Lo scheduler esegue un backup automatico giornaliero all'orario indicato (se abilitato).
                    </p>

                    {([
                      { key: 'local', label: 'Locale (PC / Host)', enabled: true, checkEnabled: () => true },
                      { key: 'nas', label: 'NAS (Rete Locale)', enabled: backupConfig.nas_enabled, checkEnabled: () => backupConfig.nas_enabled },
                      { key: 'cloud', label: 'Cloud / Rete (rclone)', enabled: backupConfig.cloud_enabled || backupTargets.some((t: any) => ['onedrive', 'gdrive', 'dropbox', 'smb', 'ftp', 'sftp'].includes(t.kind || t.provider)), checkEnabled: () => backupTargets.some((t: any) => ['onedrive', 'gdrive', 'dropbox', 'smb', 'ftp', 'sftp'].includes(t.kind || t.provider)) },
                    ] as Array<any>).map((row) => {
                      const keepKey = `${row.key}_keep_count`;
                      const schedEnabledKey = `${row.key}_schedule_enabled`;
                      const schedTimeKey = `${row.key}_schedule_time`;
                      const isEnabled = row.checkEnabled ? row.checkEnabled() : row.enabled;

                      return (
                        <div key={row.key} className="mb-4 last:mb-0 p-3 bg-white rounded-lg border border-gray-200">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="font-semibold text-gray-900">{row.label}</div>
                              <div className="text-xs text-gray-600 mt-1">
                                {isEnabled ? 'Destinazione abilitata.' : (row.key === 'cloud' ? 'Configura almeno una destinazione (OneDrive/Google Drive/Dropbox/SMB/FTP/SFTP) per abilitare lo scheduler.' : 'Destinazione non abilitata: abilitala nella sezione Configurazione Backup per renderla operativa.')}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-600">Scheduler</span>
                              <IOSSwitch
                                checked={!!backupConfig[schedEnabledKey]}
                                disabled={!isEnabled}
                                onChange={async (checked: boolean) => {
                                  console.log(`Scheduler ${row.key}: ${checked ? 'attivato' : 'disattivato'}, valore corrente:`, backupConfig[schedEnabledKey]);
                                  const newConfig = { ...backupConfig, [schedEnabledKey]: checked };
                                  setBackupConfig(newConfig);
                                  // Salva automaticamente quando si cambia il toggle
                                  try {
                                    console.log('Salvataggio configurazione scheduler...', newConfig);
                                    await handleSaveBackupConfigWithState(newConfig);
                                    console.log(`Scheduler ${row.key} salvato con successo`);
                                  } catch (err: any) {
                                    console.error(`Errore salvataggio scheduler ${row.key}:`, err);
                                    // Ripristina lo stato precedente in caso di errore
                                    setBackupConfig(backupConfig);
                                    alert(`Errore durante il salvataggio dello scheduler: ${err?.response?.data?.detail || err.message || 'Errore sconosciuto'}`);
                                  }
                                }}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                            <IOSInput
                              label="Retention (backup da mantenere)"
                              type="number"
                              min="1"
                              value={backupConfig[keepKey] ?? 10}
                              onChange={async (e: any) => {
                                  const newConfig = { ...backupConfig, [keepKey]: parseInt(e.target.value || '0', 10) };
                                  setBackupConfig(newConfig);
                                  // Salva automaticamente quando si cambia la retention
                                  try {
                                    await handleSaveBackupConfigWithState(newConfig);
                                  } catch (err) {
                                    console.error(`Errore salvataggio retention ${row.key}:`, err);
                                    setBackupConfig(backupConfig);
                                  }
                                }}
                              disabled={!isEnabled}
                            />
                            <div className="flex flex-col">
                              <label className="text-xs font-semibold text-gray-700 mb-1">Orario (giornaliero)</label>
                              <input
                                type="time"
                                value={backupConfig[schedTimeKey] || '02:00'}
                                onChange={async (e: any) => {
                                    const newConfig = { ...backupConfig, [schedTimeKey]: e.target.value };
                                    setBackupConfig(newConfig);
                                    // Salva automaticamente quando si cambia l'orario
                                    try {
                                      await handleSaveBackupConfigWithState(newConfig);
                                    } catch (err) {
                                      console.error(`Errore salvataggio orario ${row.key}:`, err);
                                      setBackupConfig(backupConfig);
                                    }
                                  }}
                                disabled={!isEnabled || !backupConfig[schedEnabledKey]}
                                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm disabled:opacity-50"
                              />
                              <div className="text-[11px] text-gray-500 mt-1">Esegue il backup una volta al giorno all'orario indicato.</div>
                            </div>
                            <div className="flex items-center text-xs text-gray-600">
                              <div>
                                <div className="font-semibold text-gray-700">Suggerimento</div>
                                <div>Usa fasce orarie notturne per ridurre l'impatto operativo.</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Destinazioni (Cloud / LAN) */}
                  <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-xl">
                    <div className="text-sm font-semibold text-gray-800 mb-2">Salva anche su destinazione</div>
                    <div className="text-xs text-gray-600 mb-3">
                      Seleziona una o più destinazioni configurate (Cloud/Lista di rete). Il backup viene creato
                      localmente sul server e poi caricato sulle destinazioni selezionate. Per salvarlo sul tuo PC,
                      usa il pulsante download nella lista dei backup.
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-3">
                      <input
                        className="border rounded-lg px-3 py-2 text-sm"
                        placeholder="Nome destinazione (es. OneDrive)"
                        value={newTargetName}
                        onChange={(e) => setNewTargetName(e.target.value)}
                      />
                      <select
                        className="border rounded-lg px-3 py-2 text-sm"
                        value={newTargetProvider}
                        onChange={(e) => setNewTargetProvider(e.target.value as any)}
                      >
                        <option value="onedrive">OneDrive (rclone)</option>
                        <option value="drive">Google Drive (rclone)</option>
                        <option value="dropbox">Dropbox (rclone)</option>
                        <option value="smb">Rete LAN / NAS (SMB)</option>
                        <option value="ftp">Server FTP</option>
                        <option value="sftp">Server SFTP</option>
                      </select>
                      <input
                        className="border rounded-lg px-3 py-2 text-sm"
                        placeholder="Percorso remoto (es. Sistema54/backups)"
                        value={newTargetRemotePath}
                        onChange={(e) => setNewTargetRemotePath(e.target.value)}
                      />
                      <button
                        className="px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700"
                        onClick={createBackupTarget}
                      >
                        Aggiungi
                      </button>
                    </div>

                    {/* Campi dedicati per SMB/FTP/SFTP */}
                    {['smb', 'ftp', 'sftp'].includes(newTargetProvider) ? (
                      <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 mb-3 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            className="border rounded-lg px-3 py-2 text-sm"
                            placeholder="Host / IP Server *"
                            value={newTargetHost}
                            onChange={(e) => setNewTargetHost(e.target.value)}
                          />
                          <input
                            type="text"
                            className="border rounded-lg px-3 py-2 text-sm"
                            placeholder="Porta"
                            value={newTargetPort}
                            onChange={(e) => setNewTargetPort(e.target.value)}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            className="border rounded-lg px-3 py-2 text-sm"
                            placeholder="Username"
                            value={newTargetUser}
                            onChange={(e) => setNewTargetUser(e.target.value)}
                          />
                          <input
                            type="password"
                            className="border rounded-lg px-3 py-2 text-sm"
                            placeholder="Password"
                            value={newTargetPass}
                            onChange={(e) => setNewTargetPass(e.target.value)}
                          />
                        </div>
                        {newTargetProvider === 'smb' && (
                          <>
                            <input
                              type="text"
                              className="border rounded-lg px-3 py-2 text-sm"
                              placeholder="Share (nome condivisione) *"
                              value={newTargetShare}
                              onChange={(e) => setNewTargetShare(e.target.value)}
                            />
                            <input
                              type="text"
                              className="border rounded-lg px-3 py-2 text-sm"
                              placeholder="Domain (es: WORKGROUP)"
                              value={newTargetDomain}
                              onChange={(e) => setNewTargetDomain(e.target.value)}
                            />
                          </>
                        )}
                        {newTargetProvider === 'sftp' && (
                          <input
                            type="text"
                            className="border rounded-lg px-3 py-2 text-sm"
                            placeholder="Path chiave SSH (opzionale, alternativa a password)"
                            value={newTargetKeyFile}
                            onChange={(e) => setNewTargetKeyFile(e.target.value)}
                          />
                        )}
                        <div className="text-xs text-gray-600 pt-1">
                          {newTargetProvider === 'smb' && (
                            <>* Host e Share sono obbligatori. Porta default: 445</>
                          )}
                          {newTargetProvider === 'ftp' && (
                            <>* Host obbligatorio. Porta default: 21</>
                          )}
                          {newTargetProvider === 'sftp' && (
                            <>* Host e Username obbligatori. Porta default: 22. Usa password OPPURE chiave SSH.</>
                          )}
                        </div>
                      </div>
                    ) : (
                      <textarea
                        className="w-full border rounded-lg px-3 py-2 text-xs font-mono mb-3"
                        rows={4}
                        placeholder='{"token":"{...}","client_id":"","client_secret":""}'
                        value={newTargetConfig}
                        onChange={(e) => setNewTargetConfig(e.target.value)}
                      />
                    )}
                    {backupTargets.length === 0 ? (
                      <div className="text-xs text-gray-500">Nessuna destinazione configurata.</div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {backupTargets.map((t) => (
                          <label key={t.id} className="flex items-center gap-2 text-sm text-gray-800">
                            <input
                              type="checkbox"
                              checked={selectedBackupTargetIds.includes(t.id)}
                              onChange={(e) => {
                                const newIds = e.target.checked 
                                  ? [...selectedBackupTargetIds, t.id]
                                  : selectedBackupTargetIds.filter((x) => x !== t.id);
                                setSelectedBackupTargetIds(newIds);
                                saveSelectedBackupTargets(newIds);
                              }}
                            />
                            <span className="font-medium flex-1">{t.name}</span>
                            <span className="text-xs text-gray-500">({t.kind || t.provider})</span>
                            <div className="flex gap-1 ml-2">
                              <button
                                onClick={() => startEditTarget(t)}
                                className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                                title="Modifica"
                              >
                                Modifica
                              </button>
                              <button
                                onClick={() => deleteBackupTarget(t.id)}
                                className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                                title="Elimina"
                              >
                                Elimina
                              </button>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}

                    {/* Modale Modifica Target */}
                    {editingTarget && (
                      <div className="mt-4 p-4 bg-white border-2 border-blue-200 rounded-xl">
                        <h4 className="font-semibold text-gray-800 mb-3">Modifica Destinazione: {editingTarget.name}</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
                          <input
                            className="border rounded-lg px-3 py-2 text-sm"
                            placeholder="Nome destinazione"
                            value={editTargetName}
                            onChange={(e) => setEditTargetName(e.target.value)}
                          />
                          <select
                            className="border rounded-lg px-3 py-2 text-sm"
                            value={editTargetProvider}
                            onChange={(e) => setEditTargetProvider(e.target.value as any)}
                          >
                            <option value="onedrive">OneDrive (rclone)</option>
                            <option value="drive">Google Drive (rclone)</option>
                            <option value="dropbox">Dropbox (rclone)</option>
                            <option value="smb">Rete LAN / NAS (SMB)</option>
                            <option value="ftp">Server FTP</option>
                            <option value="sftp">Server SFTP</option>
                          </select>
                          <input
                            className="border rounded-lg px-3 py-2 text-sm"
                            placeholder="Percorso remoto"
                            value={editTargetRemotePath}
                            onChange={(e) => setEditTargetRemotePath(e.target.value)}
                          />
                        </div>
                        {/* Campi dedicati per SMB/FTP/SFTP */}
                        {['smb', 'ftp', 'sftp'].includes(editTargetProvider) ? (
                          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 mb-3 space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="text"
                                className="border rounded-lg px-3 py-2 text-sm"
                                placeholder="Host / IP Server *"
                                value={editTargetHost}
                                onChange={(e) => setEditTargetHost(e.target.value)}
                              />
                              <input
                                type="text"
                                className="border rounded-lg px-3 py-2 text-sm"
                                placeholder="Porta"
                                value={editTargetPort}
                                onChange={(e) => setEditTargetPort(e.target.value)}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="text"
                                className="border rounded-lg px-3 py-2 text-sm"
                                placeholder="Username"
                                value={editTargetUser}
                                onChange={(e) => setEditTargetUser(e.target.value)}
                              />
                              <input
                                type="password"
                                className="border rounded-lg px-3 py-2 text-sm"
                                placeholder="Password"
                                value={editTargetPass}
                                onChange={(e) => setEditTargetPass(e.target.value)}
                              />
                            </div>
                            {editTargetProvider === 'smb' && (
                              <>
                                <input
                                  type="text"
                                  className="border rounded-lg px-3 py-2 text-sm"
                                  placeholder="Share (nome condivisione) *"
                                  value={editTargetShare}
                                  onChange={(e) => setEditTargetShare(e.target.value)}
                                />
                                <input
                                  type="text"
                                  className="border rounded-lg px-3 py-2 text-sm"
                                  placeholder="Domain (es: WORKGROUP)"
                                  value={editTargetDomain}
                                  onChange={(e) => setEditTargetDomain(e.target.value)}
                                />
                              </>
                            )}
                            {editTargetProvider === 'sftp' && (
                              <input
                                type="text"
                                className="border rounded-lg px-3 py-2 text-sm"
                                placeholder="Path chiave SSH (opzionale, alternativa a password)"
                                value={editTargetKeyFile}
                                onChange={(e) => setEditTargetKeyFile(e.target.value)}
                              />
                            )}
                            <div className="text-xs text-gray-600 pt-1">
                              {editTargetProvider === 'smb' && (
                                <>* Host e Share sono obbligatori. Porta default: 445</>
                              )}
                              {editTargetProvider === 'ftp' && (
                                <>* Host obbligatorio. Porta default: 21</>
                              )}
                              {editTargetProvider === 'sftp' && (
                                <>* Host e Username obbligatori. Porta default: 22. Usa password OPPURE chiave SSH.</>
                              )}
                            </div>
                          </div>
                        ) : (
                          <textarea
                            className="w-full border rounded-lg px-3 py-2 text-xs font-mono mb-3"
                            rows={4}
                            placeholder='{"token":"{...}","client_id":"","client_secret":""}'
                            value={editTargetConfig}
                            onChange={(e) => setEditTargetConfig(e.target.value)}
                          />
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={saveEditTarget}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold"
                          >
                            Salva Modifiche
                          </button>
                          <button
                            onClick={cancelEditTarget}
                            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 text-sm font-semibold"
                          >
                            Annulla
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Barra di Progresso Backup */}
                  {backupStatus && backupStatus.status !== 'idle' && (
                    <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1">
                          {backupStatus.status === 'running' && (
                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent"></div>
                          )}
                          {backupStatus.status === 'completed' && (
                            <div className="h-5 w-5 rounded-full bg-green-500 flex items-center justify-center">
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                          {backupStatus.status === 'error' && (
                            <div className="h-5 w-5 rounded-full bg-red-500 flex items-center justify-center">
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </div>
                          )}
                          <span className="font-semibold text-gray-900">
                            {backupStatus.status === 'running' && 'Backup in corso...'}
                            {backupStatus.status === 'completed' && 'Backup completato!'}
                            {backupStatus.status === 'error' && 'Errore durante il backup'}
                          </span>
                        </div>
                        <span className="text-sm font-bold text-blue-700">
                          {backupStatus.progress}%
                        </span>
                      </div>
                      
                      {/* Barra di progresso */}
                      <div className="w-full bg-gray-200 rounded-full h-3 mb-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ease-out ${
                            backupStatus.status === 'completed' 
                              ? 'bg-gradient-to-r from-green-500 to-emerald-500' 
                              : backupStatus.status === 'error'
                              ? 'bg-gradient-to-r from-red-500 to-rose-500'
                              : 'bg-gradient-to-r from-blue-500 to-indigo-500'
                          }`}
                          style={{ width: `${backupStatus.progress}%` }}
                        >
                          {backupStatus.status === 'running' && (
                            <div className="h-full w-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
                          )}
                        </div>
                      </div>
                      
                      {/* Messaggio di stato */}
                      {backupStatus.message && (
                        <p className="text-xs text-gray-600 mt-1">
                          {backupStatus.message}
                        </p>
                      )}
                      
                      {/* Messaggio di errore */}
                      {backupStatus.error && (
                        <p className="text-xs text-red-600 mt-1 font-semibold">
                          Errore: {backupStatus.error}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                    <h3 className="font-semibold text-blue-900 mb-2">Informazioni Backup</h3>
                    <p className="text-sm text-blue-800">
                      I backup includono: Database PostgreSQL, Volumi Docker (postgres_data, backend_uploads, pgadmin_data), 
                      e Configurazione (docker-compose.yml, nginx, .env). 
                      I backup possono essere caricati automaticamente su NAS o Cloud Storage se configurati.
                    </p>
                  </div>

                <div className="space-y-3">
                  {backupLoading && backups.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">Caricamento backup...</div>
                  ) : backups.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      Nessun backup disponibile. Clicca su "Crea Backup" per crearne uno.
                    </div>
                  ) : (
                    backups.map((backup) => (
                      <div
                        key={backup.id}
                        className="p-4 bg-gray-50 rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <HardDrive className="w-5 h-5 text-blue-600" />
                              <span className="font-bold text-gray-900">{backup.filename}</span>
                            </div>
                            <div className="text-sm text-gray-600 mt-1">
                              Creato: {backup.created_at_readable}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              Dimensione: {backup.size_mb} MB
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDownloadBackup(backup.id)}
                              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Scarica backup"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <div className="relative group">
                              <button
                                onClick={() => handleRestoreBackup(backup.id, 'full')}
                                disabled={restoringBackup === backup.id}
                                className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                                title="Ripristina backup completo"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                              <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                                <button
                                  onClick={() => handleRestoreBackup(backup.id, 'database')}
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-t-lg"
                                >
                                  Solo Database
                                </button>
                                <button
                                  onClick={() => handleRestoreBackup(backup.id, 'volumes')}
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                                >
                                  Solo Volumi
                                </button>
                                <button
                                  onClick={() => handleRestoreBackup(backup.id, 'config')}
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-b-lg"
                                >
                                  Solo Configurazione
                                </button>
                              </div>
                            </div>
                            <button
                              onClick={() => handleDeleteBackup(backup.id)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Elimina backup"
                            >
                              <Trash className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </IOSCard>
              </div>
            )}

            {activeTab === 'logs' && (
              <IOSCard>
                <div className="mb-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-4">Log delle Operazioni</h2>
                  
                  {/* Filtri */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">
                        Tipo Entità
                      </label>
                      <select
                        value={logFilters.entity_type}
                        onChange={(e) => setLogFilters({ ...logFilters, entity_type: e.target.value })}
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      >
                        <option value="">Tutti</option>
                        <option value="cliente">Clienti</option>
                        <option value="intervento">Interventi</option>
                        <option value="magazzino">Magazzino</option>
                        <option value="utente">Utenti</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">
                        Azione
                      </label>
                      <select
                        value={logFilters.action}
                        onChange={(e) => setLogFilters({ ...logFilters, action: e.target.value })}
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      >
                        <option value="">Tutte</option>
                        <option value="CREATE">Creazione</option>
                        <option value="UPDATE">Modifica</option>
                        <option value="DELETE">Eliminazione</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">
                        Data Inizio
                      </label>
                      <input
                        type="date"
                        value={logFilters.start_date}
                        onChange={(e) => setLogFilters({ ...logFilters, start_date: e.target.value })}
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">
                        Data Fine
                      </label>
                      <input
                        type="date"
                        value={logFilters.end_date}
                        onChange={(e) => setLogFilters({ ...logFilters, end_date: e.target.value })}
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={loadAuditLogs}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 text-sm font-semibold"
                      >
                        Applica Filtri
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {loading ? (
                    <div className="text-center py-12 text-gray-500">Caricamento...</div>
                  ) : auditLogs.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">Nessun log trovato</div>
                  ) : (
                    auditLogs.map((log) => {
                      const actionColors: { [key: string]: string } = {
                        CREATE: 'bg-green-100 text-green-700',
                        UPDATE: 'bg-blue-100 text-blue-700',
                        DELETE: 'bg-red-100 text-red-700'
                      };
                      const entityLabels: { [key: string]: string } = {
                        cliente: 'Cliente',
                        intervento: 'Intervento',
                        magazzino: 'Magazzino',
                        utente: 'Utente'
                      };
                      
                      return (
                        <div
                          key={log.id}
                          className="p-4 bg-gray-50 rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className={`px-2 py-1 rounded text-xs font-bold ${actionColors[log.action] || 'bg-gray-100 text-gray-700'}`}>
                                  {log.action}
                                </span>
                                <span className="px-2 py-1 rounded text-xs font-semibold bg-purple-100 text-purple-700">
                                  {entityLabels[log.entity_type] || log.entity_type}
                                </span>
                                {log.entity_name && (
                                  <span className="text-sm font-semibold text-gray-900">
                                    {log.entity_name}
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-gray-600">
                                <span className="font-semibold">{log.user_nome}</span> ({log.user_email})
                              </div>
                              {log.changes && Object.keys(log.changes).length > 0 && (
                                <div className="mt-2 text-xs text-gray-500">
                                  <div className="font-semibold mb-1">Modifiche:</div>
                                  {Object.entries(log.changes).map(([field, change]: [string, any]) => (
                                    <div key={field} className="ml-2">
                                      <span className="font-semibold">{field}:</span>{' '}
                                      <span className="text-red-600">{String(change.old || 'N/A')}</span>
                                      {' → '}
                                      <span className="text-green-600">{String(change.new || 'N/A')}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div className="text-xs text-gray-400 mt-2">
                                {new Date(log.timestamp).toLocaleString('it-IT')}
                                {log.ip_address && ` • IP: ${log.ip_address}`}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </IOSCard>
            )}
          </>
        )}
      </main>

      {/* Modale Modifica Utente */}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSave={() => {
            loadAllCounts();
            loadData();
          }}
        />
      )}

      {/* Modale Crea Utente */}
      {creatingUser && (
        <EditUserModal
          user={null}
          onClose={() => setCreatingUser(false)}
          onSave={() => {
            setCreatingUser(false);
            loadAllCounts();
            loadData();
          }}
        />
      )}
    </div>
  );
}