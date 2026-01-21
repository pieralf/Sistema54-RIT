import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { ChevronLeft, Save, Building2, Palette, Receipt, Upload, X, Image as ImageIcon, Home, Package } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { IOSCard, IOSInput, IOSTextArea } from '../components/ui/ios-elements';
import { getApiUrl } from '../config/api';
import TwoFactorSettings from '../components/TwoFactorSettings';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';

const CATEGORIE = ["Informatica & IT", "Printing & Office", "Manutenzione Gen.", "Sistemi Fiscali"];

export default function SettingsPage() {
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [clientiImportFile, setClientiImportFile] = useState<File | null>(null);
  const [magazzinoImportFile, setMagazzinoImportFile] = useState<File | null>(null);
  const [sediImportFile, setSediImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const { register, handleSubmit, setValue, watch } = useForm<any>();
  const [advancedConfig, setAdvancedConfig] = useState<any>({});
  const { updateSettings } = useSettingsStore();
  const { user } = useAuthStore();

  useEffect(() => {
    // Gestione errore connessione
    axios.get(`${getApiUrl()}/impostazioni/`)
      .then(res => {
        const data = res.data || {};
        setValue('nome_azienda', data.nome_azienda || "");
        setValue('indirizzo_completo', data.indirizzo_completo || "");
        setValue('p_iva', data.p_iva || "");
        setValue('telefono', data.telefono || "");
        setValue('email', data.email || "");
        setValue('email_responsabile_ddt', data.email_responsabile_ddt || "");
        setValue('contratti_alert_emails', data.contratti_alert_emails || "");
        setValue('contratti_alert_giorni_1', data.contratti_alert_giorni_1 || 30);
        setValue('contratti_alert_giorni_2', data.contratti_alert_giorni_2 || 60);
        setValue('contratti_alert_giorni_3', data.contratti_alert_giorni_3 || 90);
        setValue('contratti_alert_abilitato', data.contratti_alert_abilitato !== false);
        setValue('letture_copie_alert_emails', data.letture_copie_alert_emails || "");
        setValue('letture_copie_alert_giorni_1', data.letture_copie_alert_giorni_1 || 7);
        setValue('letture_copie_alert_giorni_2', data.letture_copie_alert_giorni_2 || 14);
        setValue('letture_copie_alert_giorni_3', data.letture_copie_alert_giorni_3 || 30);
        setValue('letture_copie_alert_abilitato', data.letture_copie_alert_abilitato !== false);
        setValue('backup_alert_emails', data.backup_alert_emails || "");
        setValue('backup_alert_abilitato', data.backup_alert_abilitato !== false);
        setValue('ddt_alert_giorni_1', data.ddt_alert_giorni_1 || 30);
        setValue('ddt_alert_giorni_2', data.ddt_alert_giorni_2 || 60);
        setValue('ddt_alert_giorni_3', data.ddt_alert_giorni_3 || 90);
        setValue('ddt_alert_abilitato', data.ddt_alert_abilitato !== false);
        setValue('ddt_assegnazione_modalita', data.ddt_assegnazione_modalita || "manual");
        setValue('ddt_assegnazione_alert_abilitato', data.ddt_assegnazione_alert_abilitato !== false);
        setValue('smtp_server', data.smtp_server || "");
        setValue('smtp_port', data.smtp_port || 587);
        setValue('smtp_username', data.smtp_username || "");
        setValue('smtp_password', data.smtp_password || "");
        setValue('smtp_use_tls', data.smtp_use_tls !== false);
        setValue('colore_primario', data.colore_primario || "#4F46E5");
        setValue('logo_url', data.logo_url || "");
        setLogoUrl(data.logo_url || "");
        setValue('testo_privacy', data.testo_privacy || "");
        const adv = data.configurazioni_avanzate || {};
        setAdvancedConfig(adv);
        setValue('ddt_auto_strategy', adv.ddt_auto_strategy || "round_robin_weighted");
        setValue('ddt_auto_prioritize_assigned', adv.ddt_auto_prioritize_assigned !== false);
        setValue('ddt_auto_prioritize_worked', adv.ddt_auto_prioritize_worked !== false);

        const tariffe = data.tariffe_categorie || {};
        CATEGORIE.forEach(cat => {
            setValue(`tariffe_${cat}_orario`, tariffe[cat]?.orario || 50);
            setValue(`tariffe_${cat}_chiamata`, tariffe[cat]?.chiamata || 30);
        });
      })
      .catch(err => console.warn("Backend non raggiungibile o dati vuoti", err));
  }, [setValue]);

  const onSubmit = async (data: any) => {
    setIsSaving(true);
    
    const tariffe_categorie: any = {};
    CATEGORIE.forEach(cat => {
        tariffe_categorie[cat] = {
            orario: parseFloat(data[`tariffe_${cat}_orario`] || 0),
            chiamata: parseFloat(data[`tariffe_${cat}_chiamata`] || 0)
        };
    });

    const payload = {
        nome_azienda: data.nome_azienda || "Azienda Demo",
        indirizzo_completo: data.indirizzo_completo || "",
        p_iva: data.p_iva || "",
        telefono: data.telefono || "",
        email: data.email || "",
        email_responsabile_ddt: data.email_responsabile_ddt || "",
        contratti_alert_emails: data.contratti_alert_emails || "",
        contratti_alert_giorni_1: data.contratti_alert_giorni_1 ? parseInt(data.contratti_alert_giorni_1) : 30,
        contratti_alert_giorni_2: data.contratti_alert_giorni_2 ? parseInt(data.contratti_alert_giorni_2) : 60,
        contratti_alert_giorni_3: data.contratti_alert_giorni_3 ? parseInt(data.contratti_alert_giorni_3) : 90,
        contratti_alert_abilitato: data.contratti_alert_abilitato !== false,
        letture_copie_alert_emails: data.letture_copie_alert_emails || "",
        letture_copie_alert_giorni_1: data.letture_copie_alert_giorni_1 ? parseInt(data.letture_copie_alert_giorni_1) : 7,
        letture_copie_alert_giorni_2: data.letture_copie_alert_giorni_2 ? parseInt(data.letture_copie_alert_giorni_2) : 14,
        letture_copie_alert_giorni_3: data.letture_copie_alert_giorni_3 ? parseInt(data.letture_copie_alert_giorni_3) : 30,
        letture_copie_alert_abilitato: data.letture_copie_alert_abilitato !== false,
        backup_alert_emails: data.backup_alert_emails || "",
        backup_alert_abilitato: data.backup_alert_abilitato !== false,
        ddt_alert_giorni_1: data.ddt_alert_giorni_1 ? parseInt(data.ddt_alert_giorni_1) : 30,
        ddt_alert_giorni_2: data.ddt_alert_giorni_2 ? parseInt(data.ddt_alert_giorni_2) : 60,
        ddt_alert_giorni_3: data.ddt_alert_giorni_3 ? parseInt(data.ddt_alert_giorni_3) : 90,
        ddt_alert_abilitato: data.ddt_alert_abilitato !== false,
        ddt_assegnazione_modalita: data.ddt_assegnazione_modalita || "manual",
        ddt_assegnazione_alert_abilitato: data.ddt_assegnazione_alert_abilitato !== false,
        smtp_server: data.smtp_server || "",
        smtp_port: data.smtp_port ? parseInt(data.smtp_port) : 587,
        smtp_username: data.smtp_username || "",
        smtp_password: data.smtp_password || "",
        smtp_use_tls: data.smtp_use_tls !== false,
        colore_primario: data.colore_primario || "#4F46E5",
        logo_url: data.logo_url || "",
        testo_privacy: data.testo_privacy || "",
        tariffe_categorie: tariffe_categorie,
        configurazioni_avanzate: {
          ...(advancedConfig || {}),
          ddt_auto_strategy: data.ddt_auto_strategy || "round_robin_weighted",
          ddt_auto_prioritize_assigned: data.ddt_auto_prioritize_assigned !== false,
          ddt_auto_prioritize_worked: data.ddt_auto_prioritize_worked !== false
        }
    };

    try {
      await axios.put(`${getApiUrl()}/impostazioni/`, payload);
      // Aggiorna lo store delle impostazioni
      updateSettings({
        nome_azienda: payload.nome_azienda,
        logo_url: payload.logo_url,
        colore_primario: payload.colore_primario
      });
      alert('Configurazione salvata con successo.');
    } catch (error) {
      alert('Errore di connessione al server.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleImport = async (type: 'clienti' | 'magazzino' | 'sedi') => {
    const file = type === 'clienti'
      ? clientiImportFile
      : type === 'magazzino'
        ? magazzinoImportFile
        : sediImportFile;
    if (!file) {
      alert('Seleziona un file da importare');
      return;
    }
    setIsImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const endpoint = type === 'clienti'
        ? `${getApiUrl()}/superadmin/import/clienti`
        : type === 'magazzino'
          ? `${getApiUrl()}/superadmin/import/magazzino`
          : `${getApiUrl()}/superadmin/import/sedi`;
      const res = await axios.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const { created, updated, errors, error_report_url } = res.data || {};
      if (error_report_url) {
        window.open(`${getApiUrl()}${error_report_url}`, '_blank');
      }
      alert(`Import completato.\nCreati: ${created || 0}\nAggiornati: ${updated || 0}\nErrori: ${(errors || []).length}`);
    } catch (err: any) {
      alert('Errore importazione: ' + (err.response?.data?.detail || 'Errore sconosciuto'));
    } finally {
      setIsImporting(false);
    }
  };

  const currentColor = watch("colore_primario");

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Verifica tipo file
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/svg+xml', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert('Formato file non supportato. Usa PNG, JPG, GIF, SVG o WEBP');
      return;
    }

    // Verifica dimensione (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('File troppo grande. Massimo 5MB');
      return;
    }

    setIsUploadingLogo(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post(`${getApiUrl()}/api/upload/logo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
        setLogoUrl(res.data.logo_url);
        setValue('logo_url', res.data.logo_url);
        // Aggiorna lo store
        updateSettings({ logo_url: res.data.logo_url });
        alert('Logo caricato con successo!');
    } catch (err: any) {
      alert('Errore durante l\'upload: ' + (err.response?.data?.detail || 'Errore sconosciuto'));
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!confirm('Rimuovere il logo?')) return;
    setLogoUrl('');
    setValue('logo_url', '');
    // Aggiorna lo store
    updateSettings({ logo_url: '' });
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans">
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-200 px-6 py-4 flex items-center justify-between">
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
            <h1 className="text-xl font-bold text-slate-800">Impostazioni</h1>
        </div>
        <button 
            onClick={handleSubmit(onSubmit)} 
            disabled={isSaving} 
            className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-md transition-all disabled:opacity-50"
        >
            {isSaving ? '...' : <><Save className="w-4 h-4" /> Salva</>}
        </button>
      </header>

      <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6 sm:space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
            <div className="space-y-8">
                <IOSCard>
                    <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center"><Building2 className="w-5 h-5 mr-2 text-blue-500" /> Azienda</h2>
                    <IOSInput label="Ragione Sociale" {...register("nome_azienda")} />
                    <IOSInput label="Indirizzo" {...register("indirizzo_completo")} />
                    <div className="grid grid-cols-2 gap-4">
                        <IOSInput label="P.IVA" {...register("p_iva")} />
                        <IOSInput label="Telefono" {...register("telefono")} />
                    </div>
                    <IOSInput label="Email" {...register("email")} />
                </IOSCard>

                <IOSCard>
                    <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center"><Package className="w-5 h-5 mr-2 text-slate-500" /> Alert Backup</h2>
                    <IOSInput
                      label="Contatto/i e-mail Alert Backup"
                      type="text"
                      {...register("backup_alert_emails")}
                      placeholder="email1@azienda.it, email2@azienda.it"
                    />
                    <div className="mb-2">
                        <label className="flex items-center gap-2 font-semibold text-sm mb-2 text-gray-700 cursor-pointer">
                            <input
                                type="checkbox"
                                {...register("backup_alert_abilitato")}
                                className="w-4 h-4 rounded text-blue-600"
                            />
                            Abilita Alert Backup
                        </label>
                        <p className="text-xs text-gray-500 ml-6">Notifiche inviate quando un backup termina con successo o errore</p>
                    </div>
                </IOSCard>

                <IOSCard>
                    <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center"><Receipt className="w-5 h-5 mr-2 text-orange-500" /> Configurazione SMTP</h2>
                    <p className="text-xs text-gray-500 mb-4">Configurazione server email per l'invio di notifiche automatiche</p>
                    <IOSInput 
                      label="Server SMTP" 
                      {...register("smtp_server")} 
                      placeholder="smtp.gmail.com"
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <IOSInput 
                          label="Porta SMTP" 
                          type="number"
                          {...register("smtp_port")} 
                          placeholder="587"
                        />
                        <div className="flex items-center pt-6">
                            <input 
                                type="checkbox" 
                                {...register("smtp_use_tls")} 
                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                            />
                            <label className="ml-2 text-sm text-gray-700">Usa TLS/SSL</label>
                        </div>
                    </div>
                    <IOSInput 
                      label="Username/Email SMTP" 
                      type="email"
                      {...register("smtp_username")} 
                      placeholder="tuaemail@gmail.com"
                    />
                    <IOSInput 
                      label="Password App (Gmail)" 
                      type="password"
                      {...register("smtp_password")} 
                      placeholder="Password app generata da Gmail"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                        Per Gmail: genera una "Password app" da <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Google Account</a>
                    </p>
                </IOSCard>

                <IOSCard>
                    <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center"><Palette className="w-5 h-5 mr-2 text-purple-500" /> PDF & Grafica</h2>
                    <div className="flex gap-4 items-center mb-4">
                        <div className="flex-1"><IOSInput label="Colore Hex" {...register("colore_primario")} /></div>
                        <div className="w-10 h-10 rounded-lg border shadow-sm mt-1" style={{ backgroundColor: currentColor || '#4F46E5' }}></div>
                    </div>
                    
                    {/* Upload Logo */}
                    <div className="mb-4">
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">
                            Logo Azienda
                        </label>
                        {logoUrl ? (
                            <div className="relative">
                                <img 
                                    src={`${getApiUrl()}${logoUrl}`} 
                                    alt="Logo" 
                                    className="w-32 h-32 object-contain border border-gray-200 rounded-xl p-2 bg-white"
                                />
                                <button
                                    type="button"
                                    onClick={handleRemoveLogo}
                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <Upload className="w-8 h-8 text-gray-400 mb-2" />
                                    <p className="text-sm text-gray-500">
                                        {isUploadingLogo ? 'Caricamento...' : 'Clicca per caricare logo'}
                                    </p>
                                    <p className="text-xs text-gray-400 mt-1">PNG, JPG, GIF, SVG, WEBP (max 5MB)</p>
                                </div>
                                <input
                                    type="file"
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleLogoUpload}
                                    disabled={isUploadingLogo}
                                />
                            </label>
                        )}
                        <input type="hidden" {...register("logo_url")} />
                    </div>
                    
                    <IOSTextArea label="Privacy Footer" {...register("testo_privacy")} rows={3} />
                </IOSCard>
            </div>

            <div className="space-y-8">
                <IOSCard>
                    <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center"><Package className="w-5 h-5 mr-2 text-orange-500" /> Gestione DDT</h2>
                    <p className="text-xs text-gray-500 mb-4">Configurazione assegnazione e alert DDT</p>
                    <div className="mb-4">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Modalità assegnazione DDT</label>
                        <select
                          {...register("ddt_assegnazione_modalita")}
                          className="w-full bg-white border border-gray-200 rounded-xl px-3 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        >
                          <option value="manual">Manuale</option>
                          <option value="auto">Automatica</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-2">
                          In modalità manuale viene inviato un promemoria ogni 24 ore ai responsabili DDT se ci sono DDT da assegnare.
                        </p>
                    </div>
                    {watch("ddt_assegnazione_modalita") === "auto" && (
                      <div className="mb-4 rounded-xl border border-gray-100 bg-gray-50/60 p-4">
                        <h3 className="text-sm font-semibold text-gray-800 mb-2">Strategia auto-assegnazione</h3>
                        <select
                          {...register("ddt_auto_strategy")}
                          className="w-full bg-white border border-gray-200 rounded-xl px-3 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        >
                          <option value="round_robin_weighted">Round-robin con priorità carichi bassi</option>
                          <option value="round_robin_only">Round-robin semplice</option>
                        </select>
                        <div className="mt-3 space-y-2">
                          <label className="flex items-center gap-2 text-sm text-gray-700">
                            <input
                              type="checkbox"
                              {...register("ddt_auto_prioritize_assigned")}
                              className="w-4 h-4 rounded text-blue-600"
                            />
                            Priorità ai tecnici con meno DDT assegnati attivi
                          </label>
                          <label className="flex items-center gap-2 text-sm text-gray-700">
                            <input
                              type="checkbox"
                              {...register("ddt_auto_prioritize_worked")}
                              className="w-4 h-4 rounded text-blue-600"
                            />
                            Priorità ai tecnici con meno DDT lavorati (riparato/consegnato/scartato)
                          </label>
                        </div>
                        <p className="text-xs text-gray-500 mt-3">
                          L’algoritmo sceglie tra i tecnici con i carichi più bassi e applica un round-robin per distribuire le assegnazioni.
                        </p>
                      </div>
                    )}
                    <div className="mb-4">
                        <label className="flex items-center gap-2 font-semibold text-sm mb-2 text-gray-700 cursor-pointer">
                            <input
                                type="checkbox"
                                {...register("ddt_assegnazione_alert_abilitato")}
                                className="w-4 h-4 rounded text-blue-600"
                            />
                            Abilita promemoria assegnazioni DDT (ogni 24 ore)
                        </label>
                    </div>
                    <IOSInput 
                      label="Contatto/i e-mail Responsabile/i DDT" 
                      type="text"
                      {...register("email_responsabile_ddt")} 
                      placeholder="email1@azienda.it, email2@azienda.it"
                    />
                    <div className="mb-4">
                        <label className="flex items-center gap-2 font-semibold text-sm mb-2 text-gray-700 cursor-pointer">
                            <input 
                                type="checkbox" 
                                {...register("ddt_alert_abilitato")} 
                                className="w-4 h-4 rounded text-blue-600" 
                            /> 
                            Abilita Alert DDT
                        </label>
                        <p className="text-xs text-gray-500 ml-6">Invia notifiche automatiche per prodotti in magazzino</p>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <IOSInput 
                          label="Primo Alert (giorni)" 
                          type="number"
                          {...register("ddt_alert_giorni_1")} 
                          placeholder="30"
                        />
                        <IOSInput 
                          label="Secondo Alert (giorni)" 
                          type="number"
                          {...register("ddt_alert_giorni_2")} 
                          placeholder="60"
                        />
                        <IOSInput 
                          label="Terzo Alert (giorni)" 
                          type="number"
                          {...register("ddt_alert_giorni_3")} 
                          placeholder="90"
                        />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                        Gli alert vengono inviati quando un prodotto DDT rimane nel suo ultimo stato oltre i giorni specificati
                    </p>
                </IOSCard>
                <IOSCard>
                    <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center"><Package className="w-5 h-5 mr-2 text-indigo-500" /> Alert Contratti e Letture Copie</h2>
                    <div className="space-y-6">
                        <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
                            <h3 className="text-sm font-semibold text-gray-800 mb-3">Alert Scadenze Contratti</h3>
                            <IOSInput
                              label="Contatto/i e-mail Scadenze Contratti"
                              type="text"
                              {...register("contratti_alert_emails")}
                              placeholder="email1@azienda.it, email2@azienda.it"
                            />
                            <div className="mb-4">
                                <label className="flex items-center gap-2 font-semibold text-sm mb-2 text-gray-700 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        {...register("contratti_alert_abilitato")}
                                        className="w-4 h-4 rounded text-blue-600"
                                    />
                                    Abilita Alert Contratti
                                </label>
                                <p className="text-xs text-gray-500 ml-6">Invia notifiche automatiche sulle scadenze contratti</p>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <IOSInput label="Primo Alert (giorni)" type="number" {...register("contratti_alert_giorni_1")} />
                                <IOSInput label="Secondo Alert (giorni)" type="number" {...register("contratti_alert_giorni_2")} />
                                <IOSInput label="Terzo Alert (giorni)" type="number" {...register("contratti_alert_giorni_3")} />
                            </div>
                        </div>
                        <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
                            <h3 className="text-sm font-semibold text-gray-800 mb-3">Alert Letture Copie</h3>
                            <IOSInput
                              label="Contatto/i e-mail Letture Copie"
                              type="text"
                              {...register("letture_copie_alert_emails")}
                              placeholder="email1@azienda.it, email2@azienda.it"
                            />
                            <div className="mb-4">
                                <label className="flex items-center gap-2 font-semibold text-sm mb-2 text-gray-700 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        {...register("letture_copie_alert_abilitato")}
                                        className="w-4 h-4 rounded text-blue-600"
                                    />
                                    Abilita Alert Letture Copie
                                </label>
                                <p className="text-xs text-gray-500 ml-6">Invia notifiche automatiche sulle letture copie in scadenza</p>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <IOSInput label="Primo Alert (giorni)" type="number" {...register("letture_copie_alert_giorni_1")} />
                                <IOSInput label="Secondo Alert (giorni)" type="number" {...register("letture_copie_alert_giorni_2")} />
                                <IOSInput label="Terzo Alert (giorni)" type="number" {...register("letture_copie_alert_giorni_3")} />
                            </div>
                        </div>
                    </div>
                </IOSCard>
                <IOSCard>
                    <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center"><Receipt className="w-5 h-5 mr-2 text-emerald-500" /> Listini Base</h2>
                    {CATEGORIE.map(cat => (
                        <div key={cat} className="mb-6 last:mb-0 border-b border-gray-100 last:border-0 pb-4 last:pb-0">
                            <p className="font-semibold text-slate-700 mb-2 text-sm">{cat}</p>
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="text-[10px] uppercase text-slate-400">Orario €</label>
                                    <input type="number" {...register(`tariffe_${cat}_orario`)} className="w-full border-b border-gray-200 bg-transparent py-1 text-slate-800 font-medium outline-none focus:border-blue-500" />
                                </div>
                                <div className="flex-1">
                                    <label className="text-[10px] uppercase text-slate-400">Chiamata €</label>
                                    <input type="number" {...register(`tariffe_${cat}_chiamata`)} className="w-full border-b border-gray-200 bg-transparent py-1 text-slate-800 font-medium outline-none focus:border-blue-500" />
                                </div>
                            </div>
                        </div>
                    ))}
                </IOSCard>
            </div>
        </div>

        {user?.ruolo === 'superadmin' && (
          <IOSCard>
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
              <Package className="w-5 h-5 mr-2 text-emerald-500" /> Importazione Massiva
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Scarica i template XLS e importa i dati. Campi obbligatori con "*".
            </p>
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="pb-2">Tipo</th>
                    <th className="pb-2">Template</th>
                    <th className="pb-2">Campi obbligatori</th>
                  </tr>
                </thead>
                <tbody className="text-gray-800">
                  <tr className="border-t">
                    <td className="py-3 font-semibold">Clienti</td>
                    <td className="py-3">
                      <a
                        href="/templates/clienti_import_template.xls"
                        className="text-emerald-600 hover:text-emerald-700 font-semibold"
                        download
                      >
                        Scarica template
                      </a>
                    </td>
                    <td className="py-3">ragione_sociale*, indirizzo*</td>
                  </tr>
                  <tr className="border-t">
                    <td className="py-3 font-semibold">Sedi clienti</td>
                    <td className="py-3">
                      <a
                        href="/templates/sedi_import_template.xls"
                        className="text-emerald-600 hover:text-emerald-700 font-semibold"
                        download
                      >
                        Scarica template
                      </a>
                    </td>
                    <td className="py-3">cliente_ragione_sociale* o cliente_p_iva o cliente_codice_fiscale, nome_sede*, indirizzo_completo*, sede_legale (se richiesto)</td>
                  </tr>
                  <tr className="border-t">
                    <td className="py-3 font-semibold">Prodotti magazzino</td>
                    <td className="py-3">
                      <a
                        href="/templates/magazzino_import_template.xls"
                        className="text-emerald-600 hover:text-emerald-700 font-semibold"
                        download
                      >
                        Scarica template
                      </a>
                    </td>
                    <td className="py-3">codice_articolo*, descrizione*, prezzo_vendita*, giacenza*</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr_180px] gap-3 items-center bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                <div>Tipo</div>
                <div>File</div>
                <div>Azione</div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr_180px] gap-3 items-center px-4 py-3 border-t border-gray-200">
                <div className="text-sm font-semibold text-gray-700">Importa Clienti</div>
                <input
                  type="file"
                  accept=".xls,.csv,.tsv"
                  onChange={(e) => setClientiImportFile(e.target.files?.[0] || null)}
                  className="text-sm"
                />
                <button
                  type="button"
                  onClick={() => handleImport('clienti')}
                  disabled={isImporting}
                  className="px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60 w-[160px]"
                >
                  Carica Clienti
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr_180px] gap-3 items-center px-4 py-3 border-t border-gray-200">
                <div className="text-sm font-semibold text-gray-700">Importa Sedi</div>
                <input
                  type="file"
                  accept=".xls,.csv,.tsv"
                  onChange={(e) => setSediImportFile(e.target.files?.[0] || null)}
                  className="text-sm"
                />
                <button
                  type="button"
                  onClick={() => handleImport('sedi')}
                  disabled={isImporting}
                  className="px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60 w-[160px]"
                >
                  Carica Sedi
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr_180px] gap-3 items-center px-4 py-3 border-t border-gray-200">
                <div className="text-sm font-semibold text-gray-700">Importa Magazzino</div>
                <input
                  type="file"
                  accept=".xls,.csv,.tsv"
                  onChange={(e) => setMagazzinoImportFile(e.target.files?.[0] || null)}
                  className="text-sm"
                />
                <button
                  type="button"
                  onClick={() => handleImport('magazzino')}
                  disabled={isImporting}
                  className="px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60 w-[160px]"
                >
                  Carica Magazzino
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              Formati supportati: XLS (tab), CSV o TSV. Le righe che iniziano con "#" vengono ignorate.
            </p>
          </IOSCard>
        )}

        {/* Sezione 2FA per SuperAdmin */}
        <TwoFactorSettings />
      </main>
    </div>
  );
}