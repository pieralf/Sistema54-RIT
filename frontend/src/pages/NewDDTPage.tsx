import { useState, useEffect, useRef } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { ChevronLeft, Plus, Trash2, Save, Search, UserPlus, X, Camera, Image as ImageIcon, PenTool, Home } from 'lucide-react';
import { IOSCard, IOSInput, IOSTextArea } from '../components/ui/ios-elements';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import SignatureCanvas from 'react-signature-canvas';
import { getApiUrl } from '../config/api';
import { useAuthStore } from '../store/authStore';
import CameraCapture from '../components/CameraCapture';
import { useFocusRegistry } from '../hooks/useFocusRegistry';

type ProdottoDDT = {
  tipo_prodotto: string;
  marca?: string;
  modello?: string;
  serial_number?: string;
  descrizione_prodotto?: string;
  difetto_segnalato: string;
  difetto_appurato?: string;
  foto_prodotto?: string[];
};

type FormValues = {
  cliente_id: number;
  cliente_ragione_sociale: string;
  cliente_indirizzo: string;
  sede_id?: number;
  // Campi singoli prodotto (mantenuti per retrocompatibilità)
  tipo_prodotto?: string;
  marca?: string;
  modello?: string;
  serial_number?: string;
  descrizione_prodotto?: string;
  difetto_segnalato?: string;
  difetto_appurato?: string;
  // Array prodotti (nuovo)
  prodotti: ProdottoDDT[];
  note?: string;
  firma_tecnico?: string;
  firma_cliente?: string;
  nome_cliente?: string;
  cognome_cliente?: string;
};

// --- MODALE NUOVO CLIENTE ---
const NewClientModal = ({ isOpen, onClose, onClientCreated }: any) => {
  const { register, handleSubmit, formState: { errors } } = useForm();

  const onSave = async (data: any) => {
    try {
      const res = await axios.post(`${getApiUrl()}/clienti/`, {
        ...data,
        citta: data.citta || "-",
        cap: data.cap || "00000"
      });
      onClientCreated(res.data);
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Errore sconosciuto.";
      alert("Attenzione: " + msg);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="bg-blue-600 p-4 flex justify-between items-center text-white shrink-0">
          <h3 className="font-bold flex items-center gap-2"><UserPlus className="w-5 h-5" /> Nuovo Cliente</h3>
          <button onClick={onClose} className="hover:bg-blue-700 p-1 rounded-full"><X className="w-6 h-6" /></button>
        </div>
        <div className="p-4 space-y-3 overflow-y-auto">
          <div>
            <IOSInput label="Ragione Sociale *" {...register("ragione_sociale", { required: "Campo obbligatorio" })} />
            {errors.ragione_sociale && <p className="text-red-500 text-xs mt-1 ml-1">{String(errors.ragione_sociale.message)}</p>}
          </div>
          <div>
            <IOSInput label="Indirizzo Completo *" {...register("indirizzo", { required: "Campo obbligatorio" })} />
            {errors.indirizzo && <p className="text-red-500 text-xs mt-1 ml-1">{String(errors.indirizzo.message)}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <IOSInput label="P.IVA" {...register("p_iva")} />
            <IOSInput label="Codice Fiscale" {...register("codice_fiscale")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <IOSInput label="Referente (Nome Cognome)" {...register("referente_nome")} />
            <IOSInput label="Cellulare Referente" {...register("referente_cellulare")} />
          </div>
          <button onClick={handleSubmit(onSave)} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold mt-4 shadow-lg">SALVA ANAGRAFICA</button>
        </div>
      </div>
    </div>
  );
};

// --- MODALE FIRMA PROFESSIONALE (UNIFICATO CON RIT) ---
const SignatureModal = ({ isOpen, onClose, onConfirm, formData }: any) => {
  const sigPadRef = useRef<any>(null);
  const [step, setStep] = useState(1);
  const [tempTecnico, setTempTecnico] = useState<string>("");
  const [tempCliente, setTempCliente] = useState<string>("");
  const [isDrawing, setIsDrawing] = useState(false);
  const [nomeCliente, setNomeCliente] = useState(formData?.nome_cliente || '');
  const [cognomeCliente, setCognomeCliente] = useState(formData?.cognome_cliente || '');
  const [acceptedClauses, setAcceptedClauses] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Reset quando si apre
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setTempTecnico("");
      setTempCliente("");
      setIsDrawing(false);
      setNomeCliente(formData?.nome_cliente || '');
      setCognomeCliente(formData?.cognome_cliente || '');
      setAcceptedClauses(false);
    }
  }, [isOpen, formData]);

  // Reset canvas quando cambia step
  useEffect(() => {
    if (sigPadRef.current && isOpen) {
      sigPadRef.current.clear();
    }
  }, [step, isOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const query = window.matchMedia('(max-width: 1024px)');
    const update = () => setIsMobile(query.matches);
    update();
    if (query.addEventListener) {
      query.addEventListener('change', update);
      return () => query.removeEventListener('change', update);
    }
    query.addListener(update);
    return () => query.removeListener(update);
  }, []);

  if (!isOpen) return null;

  const handleNext = () => {
    if (sigPadRef.current && sigPadRef.current.isEmpty()) {
      alert("⚠️ Errore: Manca la firma del tecnico.");
      return;
    }
    const data = sigPadRef.current.getTrimmedCanvas().toDataURL('image/png');
    setTempTecnico(data);
    setStep(2);
  };

  const handleMobileAccept = () => {
    if (!acceptedClauses) {
      alert("⚠️ Devi accettare le clausole per proseguire.");
      return;
    }
    setStep(3);
  };

  const handleMobileClientSign = () => {
    if (sigPadRef.current && sigPadRef.current.isEmpty()) {
      alert("⚠️ Errore: Manca la firma del cliente.");
      return;
    }
    const data = sigPadRef.current.getTrimmedCanvas().toDataURL('image/png');
    setTempCliente(data);
    setStep(4);
  };

  const handleFinish = () => {
    if (!nomeCliente.trim() || !cognomeCliente.trim()) {
      alert("⚠️ Errore: Inserisci nome e cognome del firmatario.");
      return;
    }
    const firmaCliente = isMobile ? tempCliente : sigPadRef.current.getTrimmedCanvas().toDataURL('image/png');
    if (!firmaCliente) {
      alert("⚠️ Errore: Manca la firma del cliente.");
      return;
    }
    onConfirm(tempTecnico, firmaCliente, nomeCliente.trim(), cognomeCliente.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95">
        {!isMobile && (
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-5 text-white flex justify-between items-center shrink-0">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <PenTool className="w-6 h-6" />
              Firma Digitale {step === 1 ? "Tecnico (1/2)" : "Cliente (2/2)"}
            </h3>
            <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-full transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
        )}
        
        <div className="flex-1 overflow-y-auto p-6 md:p-8 scrollbar-hidden">
          {isMobile ? (
            <div key={step} className="space-y-5 animate-in fade-in">
              {step === 1 && (
                <>
                  <div className="text-center">
                    <p className="text-base font-semibold text-gray-800 mb-1">Firma del Tecnico</p>
                    <p className="text-xs text-gray-500">Firma nell'area sottostante</p>
                  </div>
                  <div className="rounded-2xl bg-white border border-gray-200 px-4 py-3 shadow-inner">
                    <div className="relative bg-white rounded-xl overflow-hidden aspect-[3/1]" style={{ touchAction: 'none' }}>
                      <SignatureCanvas
                        ref={sigPadRef}
                        penColor="#1e293b"
                        backgroundColor="transparent"
                        velocityFilterWeight={0.7}
                        minWidth={2}
                        maxWidth={3}
                        throttle={16}
                        onBegin={() => setIsDrawing(true)}
                        onEnd={() => setIsDrawing(false)}
                        canvasProps={{
                          className: 'w-full h-full touch-none',
                          style: { touchAction: 'none' }
                        }}
                      />
                      <div className="absolute left-4 right-4 bottom-5 h-px bg-gray-300" />
                      {!isDrawing && sigPadRef.current?.isEmpty() && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <p className="text-gray-300 text-sm font-medium">Firma qui</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => sigPadRef.current?.clear()}
                      className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2.5 rounded-xl font-semibold transition-all"
                    >
                      Annulla
                    </button>
                    <button
                      onClick={handleNext}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-bold transition-all shadow-md"
                    >
                      Firma
                    </button>
                  </div>
                </>
              )}
              {step === 2 && (
                <>
                  <div className="text-center">
                    <p className="text-base font-semibold text-gray-800 mb-2">Accettazione Clausole</p>
                    <p className="text-xs text-gray-500">Conferma prima della firma cliente</p>
                  </div>
                  <label className="flex items-start gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={acceptedClauses}
                      onChange={(e) => setAcceptedClauses(e.target.checked)}
                      className="mt-1"
                    />
                    Il cliente dichiara di aver letto e accettato le clausole.
                  </label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setStep(1)}
                      className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2.5 rounded-xl font-semibold transition-all"
                    >
                      ← Indietro
                    </button>
                    <button
                      onClick={handleMobileAccept}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-bold transition-all shadow-md"
                    >
                      Firma cliente →
                    </button>
                  </div>
                </>
              )}
              {step === 3 && (
                <>
                  <div className="text-center">
                    <p className="text-base font-semibold text-gray-800 mb-1">Firma Cliente</p>
                    <p className="text-xs text-gray-500">Firma nell'area sottostante</p>
                  </div>
                  <div className="rounded-2xl bg-white border border-gray-200 px-4 py-3 shadow-inner">
                    <div className="relative bg-white rounded-xl overflow-hidden aspect-[3/1]" style={{ touchAction: 'none' }}>
                      <SignatureCanvas
                        ref={sigPadRef}
                        penColor="#1e293b"
                        backgroundColor="transparent"
                        velocityFilterWeight={0.7}
                        minWidth={2}
                        maxWidth={3}
                        throttle={16}
                        onBegin={() => setIsDrawing(true)}
                        onEnd={() => setIsDrawing(false)}
                        canvasProps={{
                          className: 'w-full h-full touch-none',
                          style: { touchAction: 'none' }
                        }}
                      />
                      <div className="absolute left-4 right-4 bottom-5 h-px bg-gray-300" />
                      {!isDrawing && sigPadRef.current?.isEmpty() && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <p className="text-gray-300 text-sm font-medium">Firma qui</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => sigPadRef.current?.clear()}
                      className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2.5 rounded-xl font-semibold transition-all"
                    >
                      Annulla
                    </button>
                    <button
                      onClick={handleMobileClientSign}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-bold transition-all shadow-md"
                    >
                      Firma
                    </button>
                  </div>
                </>
              )}
              {step === 4 && (
                <>
                  <div className="text-center">
                    <p className="text-base font-semibold text-gray-800 mb-2">Dati Firmatario</p>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                        Nome Firmatario *
                      </label>
                      <input
                        type="text"
                        value={nomeCliente}
                        onChange={(e) => setNomeCliente(e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Nome"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                        Cognome Firmatario *
                      </label>
                      <input
                        type="text"
                        value={cognomeCliente}
                        onChange={(e) => setCognomeCliente(e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Cognome"
                        required
                      />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setStep(3)}
                      className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2.5 rounded-xl font-semibold transition-all"
                    >
                      ← Indietro
                    </button>
                    <button
                      onClick={handleFinish}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-bold transition-all shadow-md"
                    >
                      Fine
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div key={step} className="space-y-5 animate-in fade-in">
              <div className="text-center">
                <p className="text-base font-semibold text-gray-800 mb-1">
                  {step === 1 ? "Firma del Tecnico Esecutore" : "Firma Cliente per Accettazione"}
                </p>
                <p className="text-xs text-gray-500">
                  {step === 1 
                    ? "Firma nell'area sottostante utilizzando il dito o lo stilo" 
                    : "Il cliente deve firmare per accettare il ritiro del prodotto"}
                </p>
              </div>
              
              {/* Canvas Firma - Ottimizzato per Touch */}
              <div className="border-3 border-dashed border-blue-300 rounded-2xl bg-gradient-to-br from-gray-50 to-white p-2 shadow-inner">
                <div className="relative bg-white rounded-xl overflow-hidden" style={{ height: '300px', touchAction: 'none' }}>
                  <SignatureCanvas 
                    ref={sigPadRef}
                    penColor="#1e293b"
                    backgroundColor="transparent"
                    velocityFilterWeight={0.7}
                    minWidth={2}
                    maxWidth={3}
                    throttle={16}
                    onBegin={() => setIsDrawing(true)}
                    onEnd={() => setIsDrawing(false)}
                    canvasProps={{
                      className: 'w-full h-full touch-none',
                      style: { touchAction: 'none' }
                    }} 
                  />
                  {!isDrawing && sigPadRef.current?.isEmpty() && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <p className="text-gray-300 text-sm font-medium">Firma qui</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Controlli */}
              <div className="flex gap-3">
                <button 
                  onClick={() => sigPadRef.current?.clear()} 
                  className="flex-1 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 py-2.5 rounded-xl font-semibold transition-all border border-red-200"
                >
                  🗑️ Pulisci
                </button>
                {step === 1 ? (
                  <button 
                    onClick={handleNext} 
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-bold transition-all shadow-md"
                  >
                    Avanti →
                  </button>
                ) : (
                  <>
                    <button 
                      onClick={() => setStep(1)} 
                      className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2.5 rounded-xl font-semibold transition-all"
                    >
                      ← Indietro
                    </button>
                    <button 
                      onClick={handleFinish} 
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl font-bold transition-all shadow-md flex items-center justify-center gap-2"
                    >
                      <Save className="w-4 h-4" /> Conferma
                    </button>
                  </>
                )}
              </div>

              {/* Campi Nome/Cognome Firmatario - Solo nel passo 2 */}
              {step === 2 && (
                <>
                  <div className="space-y-3 mt-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                        Nome Firmatario *
                      </label>
                      <input
                        type="text"
                        value={nomeCliente}
                        onChange={(e) => setNomeCliente(e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Nome"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                        Cognome Firmatario *
                      </label>
                      <input
                        type="text"
                        value={cognomeCliente}
                        onChange={(e) => setCognomeCliente(e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Cognome"
                        required
                      />
                    </div>
                  </div>
                  
                  {/* Disclaimer Legale */}
                  <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-lg mt-4">
                    <p className="text-xs text-amber-800 leading-relaxed text-justify">
                      Il Cliente, apponendo la propria firma, dichiara di aver verificato il prodotto ritirato e di accettare il ritiro senza riserve, riconoscendo lo stato del prodotto e la congruità della descrizione del difetto. Autorizza altresì il trattamento dei dati personali raccolti, inclusa l'acquisizione del tratto grafico della firma, esclusivamente per finalità amministrative, contabili e di gestione contrattuale, ai sensi del Regolamento UE 2016/679 (GDPR). La presente sottoscrizione ha piena validità legale.
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// --- PAGINA PRINCIPALE ---
export default function NewDDTPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { token } = useAuthStore();

  // Stati Modali
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [prodottoCorrenteIndex, setProdottoCorrenteIndex] = useState<number | null>(null);
  
  // Ricerca Cliente
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [clienteMultisede, setClienteMultisede] = useState<any>(null);
  const [sediCliente, setSediCliente] = useState<any[]>([]);
  
  // Dati temporanei
  const [formDataTemp, setFormDataTemp] = useState<any>(null);
  
  const { register, handleSubmit, watch, setValue, control } = useForm<FormValues>({
    defaultValues: {
      prodotti: [{
        tipo_prodotto: "",
        marca: "",
        modello: "",
        serial_number: "",
        descrizione_prodotto: "",
        difetto_segnalato: "",
        difetto_appurato: "",
        foto_prodotto: []
      }],
      note: ""
    }
  });
  const clienteSelezionato = watch("cliente_ragione_sociale");
  const { getRef, setLastFocus } = useFocusRegistry(!clienteSelezionato, [searchTerm, clienteSelezionato]);

  const { fields: prodottiFields, append: appendProdotto, remove: removeProdotto } = useFieldArray({
    control,
    name: "prodotti"
  });
  
  // Foto per prodotto corrente (quando si modifica un prodotto)
  const [fotoPerProdotto, setFotoPerProdotto] = useState<{ [key: number]: string[] }>({});

  const sedeId = watch("sede_id");

  // Cerca clienti
  useEffect(() => {
    if (!searchTerm) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    const delay = setTimeout(async () => {
      try {
        const res = await axios.get(`${getApiUrl()}/clienti/?q=${encodeURIComponent(searchTerm)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSearchResults(res.data);
        setShowResults(true);
      } catch (e) {
        console.error(e);
      }
    }, 300);
    return () => clearTimeout(delay);
  }, [searchTerm, token]);

  // Carica sedi quando selezioni cliente
  useEffect(() => {
    const clienteId = watch("cliente_id");
    if (clienteId && clienteMultisede?.has_multisede) {
      axios.get(`${getApiUrl()}/clienti/${clienteId}/sedi`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(res => {
        setSediCliente(res.data);
      }).catch(console.error);
    } else {
      setSediCliente([]);
    }
  }, [watch("cliente_id"), clienteMultisede, token]);

  const selectCliente = (cliente: any) => {
    setValue("cliente_id", cliente.id);
    setValue("cliente_ragione_sociale", cliente.ragione_sociale);
    setValue("cliente_indirizzo", cliente.indirizzo || "");
    setClienteMultisede(cliente);
    setSearchTerm("");
    setShowResults(false);
    setValue("sede_id", undefined);
  };

  const handleClientCreated = (cliente: any) => {
    selectCliente(cliente);
    setIsClientModalOpen(false);
  };

  const handleCameraCapture = (imageDataUrl: string) => {
    if (prodottoCorrenteIndex === null) {
      setIsCameraOpen(false);
      return;
    }
    setFotoPerProdotto(prev => ({
      ...prev,
      [prodottoCorrenteIndex]: [...(prev[prodottoCorrenteIndex] || []), imageDataUrl]
    }));
    setIsCameraOpen(false);
    setProdottoCorrenteIndex(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, prodottoIndex: number) => {
    const files = e.target.files;
    if (!files) return;
    
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setFotoPerProdotto(prev => ({
            ...prev,
            [prodottoIndex]: [...(prev[prodottoIndex] || []), event.target.result as string]
          }));
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removeFoto = (prodottoIndex: number, fotoIndex: number) => {
    if (!window.confirm("Vuoi eliminare questa foto?")) return;
    setFotoPerProdotto(prev => ({
      ...prev,
      [prodottoIndex]: (prev[prodottoIndex] || []).filter((_, i) => i !== fotoIndex)
    }));
  };

  const onSubmit = async (data: FormValues) => {
    if (!data.cliente_id) {
      alert("Seleziona un cliente");
      return;
    }
    
    // Valida che ci sia almeno un prodotto con tutti i campi obbligatori
    if (!data.prodotti || data.prodotti.length === 0) {
      alert("Aggiungi almeno un prodotto");
      return;
    }
    
    // Valida ogni prodotto
    for (let i = 0; i < data.prodotti.length; i++) {
      const prodotto = data.prodotti[i];
      if (!prodotto.tipo_prodotto || !prodotto.difetto_segnalato) {
        alert(`Compila tutti i campi obbligatori per il prodotto ${i + 1}`);
        return;
      }
    }

    // Aggiungi le foto ai prodotti
    const prodottiConFoto = data.prodotti.map((prodotto, index) => ({
      ...prodotto,
      foto_prodotto: fotoPerProdotto[index] || []
    }));

    setFormDataTemp({ ...data, prodotti: prodottiConFoto });
    setIsSignatureModalOpen(true);
  };

  const handleSignatureConfirm = async (firmaTec: string, firmaCli: string, nomeCliente: string, cognomeCliente: string) => {
    setIsSignatureModalOpen(false);
    setIsSubmitting(true);
    
    try {
      if (!formDataTemp) {
        throw new Error('Dati DDT mancanti. Riprova il salvataggio.');
      }

      // Prepara i prodotti con le foto
      const prodottiFinali = formDataTemp.prodotti.map((prodotto: ProdottoDDT) => ({
        ...prodotto,
        // Evita di salvare data URL nel DB: verranno caricate dopo via upload
        foto_prodotto: (prodotto.foto_prodotto || []).filter((foto) => !foto.startsWith('data:image'))
      }));

      const finalData = {
        ...formDataTemp,
        prodotti: prodottiFinali,
        // Mantieni retrocompatibilità: usa il primo prodotto per i campi singoli
        tipo_prodotto: prodottiFinali[0]?.tipo_prodotto || "",
        marca: prodottiFinali[0]?.marca || "",
        modello: prodottiFinali[0]?.modello || "",
        serial_number: prodottiFinali[0]?.serial_number || "",
        descrizione_prodotto: prodottiFinali[0]?.descrizione_prodotto || "",
        difetto_segnalato: prodottiFinali[0]?.difetto_segnalato || "",
        difetto_appurato: prodottiFinali[0]?.difetto_appurato || "",
        foto_prodotto: prodottiFinali[0]?.foto_prodotto || [],
        firma_tecnico: firmaTec,
        firma_cliente: firmaCli,
        nome_cliente: nomeCliente,
        cognome_cliente: cognomeCliente,
        stato: "in_magazzino"
      };

      const response = await axios.post(`${getApiUrl()}/ddt/`, finalData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const ddtId = response.data.id;
      const numeroDdt = response.data.numero_ddt;

      // Upload foto dopo creazione DDT (associa alla riga prodotto corretta)
      for (const [indexKey, fotoList] of Object.entries(fotoPerProdotto)) {
        const prodottoIndex = Number(indexKey);
        for (const foto of fotoList) {
          if (!foto.startsWith('data:image')) continue;
          try {
            const response = await fetch(foto);
            const blob = await response.blob();
            const file = new File([blob], 'foto.jpg', { type: 'image/jpeg' });
            
            const formData = new FormData();
            formData.append('file', file);
            
            await axios.post(`${getApiUrl()}/ddt/${ddtId}/upload-foto`, formData, {
              params: { prodotto_index: prodottoIndex },
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'multipart/form-data'
              }
            });
          } catch (err) {
            console.error('Errore upload foto:', err);
          }
        }
      }

      // Invio email DDT dopo upload foto (allegato con foto)
      try {
        await axios.post(`${getApiUrl()}/ddt/${ddtId}/send-email`, null, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      } catch (emailErr) {
        console.error('Errore invio email DDT:', emailErr);
      }

      // Scarica e apre il PDF con autenticazione (come nel RIT)
      let pdfOpened = false;
      try {
        const pdfResponse = await axios.get(`${getApiUrl()}/ddt/${ddtId}/pdf`, {
          responseType: 'blob',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        // Verifica che il contenuto sia valido
        if (pdfResponse.data && pdfResponse.data.size > 0) {
          // Estrai il nome file dall'header Content-Disposition se disponibile
          let filename = numeroDdt;
          const contentDisposition = pdfResponse.headers['content-disposition'];
          if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
            if (filenameMatch && filenameMatch[1]) {
              filename = filenameMatch[1].replace(/['"]/g, '').replace('.pdf', '');
            }
          }
          
          // Crea un File object con il nome corretto per preservare il nome file
          const file = new File([pdfResponse.data], `${filename}.pdf`, { type: 'application/pdf' });
          const url = window.URL.createObjectURL(file);
          
          // Forza il download con il nome corretto invece di aprire in una nuova finestra
          const link = document.createElement('a');
          link.href = url;
          link.download = `${filename}.pdf`;
          link.style.display = 'none';
          document.body.appendChild(link);
          
          // Apri in una nuova finestra dopo il download per visualizzarlo
          setTimeout(() => {
            link.click();
            pdfOpened = true;
            
            // Apri anche in una nuova finestra per visualizzazione
            const pdfWindow = window.open(url, '_blank');
            if (!pdfWindow) {
              // Se il popup è bloccato, almeno il download è avvenuto
              console.log('Popup bloccato, ma download completato');
            }
            
            // Pulisci dopo un delay
            setTimeout(() => {
              document.body.removeChild(link);
              window.URL.revokeObjectURL(url);
            }, 2000);
          }, 100);
        } else {
          console.error('PDF vuoto o non valido');
        }
      } catch (pdfErr: any) {
        console.error('Errore apertura PDF:', pdfErr);
        const errorMsg = pdfErr.response?.data?.detail || pdfErr.message || 'Errore sconosciuto';
        alert(`⚠️ DDT ${numeroDdt} CREATO!\n\nErrore nell'apertura del PDF: ${errorMsg}\n\nPuoi scaricarlo dalla lista DDT.`);
      }
      
      // Non bloccare con alert - naviga direttamente
      navigate('/');
    } catch (err: any) {
      console.error(err);
      alert('Errore: ' + (err.response?.data?.detail || 'Errore sconosciuto'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 pb-20 relative font-sans">
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm">
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
          <h1 className="text-lg font-bold text-gray-900 tracking-tight">Nuovo DDT - Ritiro Prodotto</h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <input type="hidden" {...register("cliente_id", { valueAsNumber: true })} />
          <input type="hidden" {...register("cliente_ragione_sociale")} />
          <input type="hidden" {...register("cliente_indirizzo")} />
          {/* Selezione Cliente */}
          <IOSCard className="overflow-visible">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-bold text-gray-900 text-base">Cliente</h2>
              <button onClick={() => setIsClientModalOpen(true)} className="text-xs font-bold bg-blue-50 text-blue-600 px-3 py-1.5 rounded-full flex items-center gap-1 border border-blue-100"><UserPlus className="w-3 h-3" /> NUOVO</button>
            </div>
            <div className="relative z-20">
              {!clienteSelezionato ? (
                <>
                  <div className="relative group">
                    <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      className="w-full bg-white border border-gray-200 rounded-xl py-3 pl-10 pr-4 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                      placeholder="Cerca Ragione Sociale..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      onFocus={() => setLastFocus('cliente-search')}
                      ref={getRef('cliente-search') as any}
                    />
                  </div>
                  {showResults && searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-xl mt-2 max-h-64 overflow-y-auto z-30">
                      {searchResults.map(c => (
                        <div key={c.id} onClick={() => selectCliente(c)} className="p-3 hover:bg-blue-50 cursor-pointer border-b last:border-0">
                          <div className="font-bold text-gray-800">{c.ragione_sociale}</div>
                          <div className="text-xs text-gray-500">{c.indirizzo}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-4 relative">
                  <button onClick={() => { 
                    setValue("cliente_id", 0); 
                    setValue("cliente_ragione_sociale", ""); 
                    setValue("sede_id", undefined);
                    setSediCliente([]);
                    setClienteMultisede(null);
                  }} className="absolute top-3 right-3 text-blue-300 hover:text-red-500"><X className="w-4 h-4" /></button>
                  <div className="font-bold text-blue-900 text-lg pr-8">{clienteSelezionato}</div>
                  
                  {clienteMultisede && sediCliente.length > 0 ? (
                    <div className="mt-3">
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">
                        Seleziona Sede
                      </label>
                      <select
                        {...register("sede_id")}
                        onChange={(e) => {
                          const sedeId = e.target.value ? parseInt(e.target.value) : undefined;
                          setValue("sede_id", sedeId);
                          if (sedeId) {
                            const sede = sediCliente.find(s => s.id === sedeId);
                            if (sede) {
                              setValue("cliente_indirizzo", sede.indirizzo_completo);
                            }
                          } else {
                            setValue("cliente_indirizzo", clienteMultisede.indirizzo);
                          }
                        }}
                        className="w-full bg-white border border-gray-200 rounded-xl py-2.5 px-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      >
                        {!clienteMultisede?.sede_legale_operativa && (
                          <option value="">Sede Centrale/Legale</option>
                        )}
                        {sediCliente.map((sede) => (
                          <option key={sede.id} value={sede.id}>
                            {sede.nome_sede}
                          </option>
                        ))}
                      </select>
                      <div className="text-sm text-blue-600/80 mt-2">
                        {watch("sede_id") ? (
                          sediCliente.find(s => s.id === parseInt(watch("sede_id")?.toString() || "0"))?.indirizzo_completo
                        ) : (
                          watch("cliente_indirizzo")
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-blue-600/80 mt-1">{watch("cliente_indirizzo")}</div>
                  )}
                </div>
              )}
            </div>
          </IOSCard>

          {/* Prodotti */}
          <IOSCard>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-base font-bold text-gray-900">Prodotti</h2>
            </div>

            {prodottiFields.map((field, index) => (
              <div key={field.id} className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-semibold text-slate-700">Prodotto {index + 1}</h3>
                  {prodottiFields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        removeProdotto(index);
                        // Rimuovi anche le foto associate
                        const newFotoPerProdotto = { ...fotoPerProdotto };
                        delete newFotoPerProdotto[index];
                        // Riorganizza gli indici
                        const reorganized: { [key: number]: string[] } = {};
                        Object.keys(newFotoPerProdotto).forEach((key) => {
                          const oldIndex = parseInt(key);
                          if (oldIndex > index) {
                            reorganized[oldIndex - 1] = newFotoPerProdotto[oldIndex];
                          } else if (oldIndex < index) {
                            reorganized[oldIndex] = newFotoPerProdotto[oldIndex];
                          }
                        });
                        setFotoPerProdotto(reorganized);
                      }}
                      className="text-red-600 hover:text-red-700 p-1"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  <IOSInput 
                    label="Tipo Prodotto *" 
                    placeholder="es. PC, Stampante, Router..." 
                    {...register(`prodotti.${index}.tipo_prodotto`, { required: true })} 
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <IOSInput label="Marca" {...register(`prodotti.${index}.marca`)} />
                    <IOSInput label="Modello" {...register(`prodotti.${index}.modello`)} />
                  </div>
                  <IOSInput label="Numero di Serie" {...register(`prodotti.${index}.serial_number`)} />
                  <IOSTextArea label="Descrizione Prodotto" {...register(`prodotti.${index}.descrizione_prodotto`)} rows={2} />
                  <IOSTextArea 
                    label="Difetto Segnalato *" 
                    {...register(`prodotti.${index}.difetto_segnalato`, { required: true })} 
                    rows={3} 
                  />
                  <IOSTextArea label="Difetto Appurato" {...register(`prodotti.${index}.difetto_appurato`)} rows={3} />
                  
                  {/* Foto per questo prodotto */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 ml-1">
                      Foto Prodotto
                    </label>
                    <div className="flex gap-3 mb-3">
                      <button
                        type="button"
                        onClick={() => {
                          setProdottoCorrenteIndex(index);
                          setIsCameraOpen(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm"
                      >
                        <Camera className="w-4 h-4" />
                        Scatta Foto
                      </button>
                      <label className="flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl font-semibold cursor-pointer text-sm">
                        <ImageIcon className="w-4 h-4" />
                        Carica da File
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={(e) => handleFileUpload(e, index)}
                        />
                      </label>
                    </div>
                    {fotoPerProdotto[index] && fotoPerProdotto[index].length > 0 && (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {fotoPerProdotto[index].map((foto, fotoIndex) => (
                          <div key={fotoIndex} className="relative group">
                            <img src={foto} alt={`Foto ${fotoIndex + 1}`} className="w-full h-24 object-cover rounded-lg" />
                            <button
                              type="button"
                              onClick={() => removeFoto(index, fotoIndex)}
                              className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => appendProdotto({
                  tipo_prodotto: "",
                  marca: "",
                  modello: "",
                  serial_number: "",
                  descrizione_prodotto: "",
                  difetto_segnalato: "",
                  difetto_appurato: "",
                  foto_prodotto: []
                })}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold text-sm"
              >
                <Plus className="w-4 h-4" />
                Aggiungi Prodotto
              </button>
            </div>
          </IOSCard>

          {/* Note */}
          <IOSCard>
            <h2 className="text-base font-bold text-gray-900 mb-4">Note</h2>
            <IOSTextArea label="Note Aggiuntive" {...register("note")} rows={3} />
          </IOSCard>

          {/* Pulsanti */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 rounded-xl font-bold"
            >
              ANNULLA
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold disabled:opacity-50"
            >
              {isSubmitting ? "SALVATAGGIO..." : "SALVA E FIRMA"}
            </button>
          </div>
        </form>
      </main>

      {/* Modali */}
      <NewClientModal isOpen={isClientModalOpen} onClose={() => setIsClientModalOpen(false)} onClientCreated={handleClientCreated} />
      <SignatureModal isOpen={isSignatureModalOpen} onClose={() => setIsSignatureModalOpen(false)} onConfirm={handleSignatureConfirm} formData={formDataTemp} />
      {isCameraOpen && (
        <CameraCapture
          onCapture={handleCameraCapture}
          onClose={() => {
            setIsCameraOpen(false);
            setProdottoCorrenteIndex(null);
          }}
        />
      )}
    </div>
  );
}
