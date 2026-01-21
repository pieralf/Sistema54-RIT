import { useState, useEffect, useRef } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Save, Search, UserPlus, X, PenTool, Home, Camera, Image as ImageIcon, Plus, Trash2, Package } from 'lucide-react';
import { IOSCard, IOSInput, IOSTextArea, IOSToggle } from '../components/ui/ios-elements';
import axios from 'axios';
import SignatureCanvas from 'react-signature-canvas';
import { getApiUrl } from '../config/api';
import { useAuthStore } from '../store/authStore';
import CameraCapture from '../components/CameraCapture';
import { useFocusRegistry } from '../hooks/useFocusRegistry';

type Ricambio = {
  descrizione: string;
  quantita: number;
  prezzo_unitario: number;
  prodotto_id?: number;
};

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
  // Campi singoli prodotto (retrocompatibilità)
  tipo_prodotto?: string;
  marca?: string;
  modello?: string;
  serial_number?: string;
  descrizione_prodotto?: string;
  difetto_segnalato?: string;
  difetto_appurato?: string;
  // Array prodotti
  prodotti: ProdottoDDT[];
  note?: string;
  foto_prodotto?: string[];
  tipo_ddt?: string;
  stato?: string;
  in_attesa_cliente?: boolean;
  note_lavoro?: string;
  ricambi?: Ricambio[];
  costi_extra?: number;
  descrizione_extra?: string;
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

export default function EditDDTPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token, user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [clienteMultisede, setClienteMultisede] = useState<any>(null);
  const [sediCliente, setSediCliente] = useState<any[]>([]);
  const [formDataTemp, setFormDataTemp] = useState<any>(null);
  const [numeroDdt, setNumeroDdt] = useState<string>("");
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [prodottoCorrenteIndex, setProdottoCorrenteIndex] = useState<number | null>(null);
  const [fotoPerProdotto, setFotoPerProdotto] = useState<{ [key: number]: string[] }>({});
  const [magazzino, setMagazzino] = useState<any[]>([]);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [assignmentEnabled, setAssignmentEnabled] = useState(false);
  const [selectedTecnicoId, setSelectedTecnicoId] = useState<number | ''>('');
  const [transferTecnicoId, setTransferTecnicoId] = useState<number | ''>('');
  const [ddtMeta, setDdtMeta] = useState<any>(null);

  const dedupeFotos = (fotos: string[] = []) =>
    Array.from(new Set(fotos.filter(Boolean)));

  const { register, handleSubmit, watch, setValue, reset, control } = useForm<FormValues>({
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
      }]
    }
  });
  const clienteSelezionato = watch("cliente_ragione_sociale");
  const { getRef, setLastFocus } = useFocusRegistry(!clienteSelezionato, [searchTerm, clienteSelezionato]);
  
  const { fields: prodottiFields, append: appendProdotto, remove: removeProdotto } = useFieldArray({
    control,
    name: "prodotti"
  });

  const ricambiFields = useFieldArray({
    control,
    name: "ricambi"
  });

  const sedeId = watch("sede_id");
  const shouldShowFirme = watch("tipo_ddt") === "uscita" || watch("stato") === "consegnato";

  const loadDDT = async () => {
    if (!token || !id) return;
    try {
      const res = await axios.get(`${getApiUrl()}/ddt/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const ddt = res.data;
      setNumeroDdt(ddt.numero_ddt);
      
      const statoNormalizzato = ddt.stato === "respinto" ? "scartato" : (ddt.stato || "in_magazzino");

      const prodottiData = Array.isArray(ddt.prodotti) && ddt.prodotti.length > 0
        ? ddt.prodotti
        : [{
            tipo_prodotto: ddt.tipo_prodotto || "",
            marca: ddt.marca || "",
            modello: ddt.modello || "",
            serial_number: ddt.serial_number || "",
            descrizione_prodotto: ddt.descrizione_prodotto || "",
            difetto_segnalato: ddt.difetto_segnalato || "",
            difetto_appurato: ddt.difetto_appurato || "",
            foto_prodotto: ddt.foto_prodotto || []
          }];

      reset({
        cliente_id: ddt.cliente_id,
        cliente_ragione_sociale: ddt.cliente_ragione_sociale,
        cliente_indirizzo: ddt.cliente_indirizzo || ddt.sede_indirizzo || "",
        sede_id: ddt.sede_id || undefined,
        prodotti: prodottiData,
        // Retrocompatibilità: usa primo prodotto
        tipo_prodotto: prodottiData[0]?.tipo_prodotto || "",
        marca: prodottiData[0]?.marca || "",
        modello: prodottiData[0]?.modello || "",
        serial_number: prodottiData[0]?.serial_number || "",
        descrizione_prodotto: prodottiData[0]?.descrizione_prodotto || "",
        difetto_segnalato: prodottiData[0]?.difetto_segnalato || "",
        difetto_appurato: prodottiData[0]?.difetto_appurato || "",
        note: ddt.note || "",
        foto_prodotto: ddt.foto_prodotto || [],
        tipo_ddt: ddt.tipo_ddt || "ingresso",
        stato: statoNormalizzato,
        in_attesa_cliente: ddt.in_attesa_cliente || false,
        note_lavoro: ddt.note_lavoro || "",
        ricambi: ddt.ricambi_utilizzati || [],
        costi_extra: ddt.costi_extra || 0,
        descrizione_extra: ddt.descrizione_extra || "",
        firma_tecnico: ddt.firma_tecnico,
        firma_cliente: ddt.firma_cliente,
        nome_cliente: ddt.nome_cliente,
        cognome_cliente: ddt.cognome_cliente
      });
      
      // Imposta ricambi nel form (senza duplicazioni)
      ricambiFields.replace(
        (ddt.ricambi_utilizzati || []).map((r: any) => ({
          descrizione: r.descrizione || "",
          quantita: r.quantita || 1,
          prezzo_unitario: r.prezzo_unitario || 0,
          prodotto_id: r.prodotto_id
        }))
      );
      
      setFotoPerProdotto(
        prodottiData.reduce((acc: any, prodotto: any, idx: number) => {
          acc[idx] = dedupeFotos(prodotto?.foto_prodotto || []);
          return acc;
        }, {})
      );

      setDdtMeta({
        assegnazione_stato: ddt.assegnazione_stato || "da_assegnare",
        tecnico_assegnato_id: ddt.tecnico_assegnato_id || null,
        tecnico_assegnato_nome: ddt.tecnico_assegnato_nome || null,
        tecnico_assegnazione_pending_id: ddt.tecnico_assegnazione_pending_id || null,
        tecnico_assegnazione_pending_nome: ddt.tecnico_assegnazione_pending_nome || null,
        note_log: ddt.note_log || [],
        assegnazioni_log: ddt.assegnazioni_log || []
      });
      
      // Carica cliente per multisede
      if (ddt.cliente_id) {
        try {
          const clienteRes = await axios.get(`${getApiUrl()}/clienti/${ddt.cliente_id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setClienteMultisede(clienteRes.data);
          if (clienteRes.data?.has_multisede) {
            const sediRes = await axios.get(`${getApiUrl()}/clienti/${ddt.cliente_id}/sedi`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            setSediCliente(sediRes.data || []);
          }
        } catch (err) {
          console.error('Errore caricamento cliente:', err);
        }
      }
    } catch (err: any) {
      console.error('Errore caricamento DDT:', err);
      alert('Errore nel caricamento del DDT: ' + (err.response?.data?.detail || 'Errore sconosciuto'));
      navigate('/admin?tab=ddt');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDDT();
  }, [id, token, navigate, reset]);

  useEffect(() => {
    if (!token) return;
    axios.get(`${getApiUrl()}/api/users/tecnici`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then((res) => {
      setTechnicians(res.data || []);
    }).catch((err) => {
      console.error('Errore caricamento tecnici:', err);
      setTechnicians([]);
    });
  }, [token]);

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
  const normalizePhotoUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('data:image')) return url;
    if (url.startsWith('blob:')) return url;
    if (url.startsWith('http')) return url;
    return `${getApiUrl()}${url.startsWith('/') ? url : `/${url}`}`;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, prodottoIndex: number) => {
    const files = e.target.files;
    if (files) {
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
    }
    e.target.value = '';
  };

  const removeFoto = (prodottoIndex: number, fotoIndex: number) => {
    if (!window.confirm("Vuoi eliminare questa foto?")) return;
    setFotoPerProdotto(prev => ({
      ...prev,
      [prodottoIndex]: (prev[prodottoIndex] || []).filter((_, i) => i !== fotoIndex)
    }));
  };

  const canManageAssignment = user?.ruolo === 'admin' || user?.ruolo === 'superadmin';

  const handleAssignToTecnico = async () => {
    if (!id || !selectedTecnicoId) return;
    try {
      await axios.post(
        `${getApiUrl()}/ddt/${id}/assign`,
        { tecnico_id: Number(selectedTecnicoId) },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAssignmentEnabled(false);
      setSelectedTecnicoId('');
      await loadDDT();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Errore durante l'assegnazione");
    }
  };

  const handleAcceptAssignment = async () => {
    if (!id) return;
    try {
      await axios.post(
        `${getApiUrl()}/ddt/${id}/accept-assignment`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await loadDDT();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Errore durante l'accettazione");
    }
  };

  const handleRejectAssignment = async () => {
    if (!id) return;
    try {
      await axios.post(
        `${getApiUrl()}/ddt/${id}/reject-assignment`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await loadDDT();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Errore durante il rifiuto");
    }
  };

  const handleTransferRequest = async () => {
    if (!id || !transferTecnicoId) return;
    try {
      await axios.post(
        `${getApiUrl()}/ddt/${id}/request-transfer`,
        { tecnico_id: Number(transferTecnicoId) },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setTransferTecnicoId('');
      await loadDDT();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Errore durante il trasferimento");
    }
  };

  // Carica magazzino per selezione prodotti
  useEffect(() => {
    if (isProductModalOpen) {
      axios.get(`${getApiUrl()}/magazzino/?q=`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(res => {
        setMagazzino(res.data || []);
      }).catch(console.error);
    }
  }, [isProductModalOpen, token]);

  const handleAddProductFromStore = (product: any) => {
    ricambiFields.append({
      descrizione: product.descrizione,
      quantita: 1,
      prezzo_unitario: product.prezzo_vendita || 0,
      prodotto_id: product.id
    });
    setIsProductModalOpen(false);
  };

  const onSubmit = async (data: FormValues) => {
    if (!data.cliente_id) {
      alert("Seleziona un cliente");
      return;
    }
    if (!data.prodotti || data.prodotti.length === 0) {
      alert("Aggiungi almeno un prodotto");
      return;
    }
    for (let i = 0; i < data.prodotti.length; i++) {
      const prodotto = data.prodotti[i];
      if (!prodotto.tipo_prodotto || !prodotto.difetto_segnalato) {
        alert(`Compila tutti i campi obbligatori per il prodotto ${i + 1}`);
        return;
      }
    }

    // Firme solo per DDT uscita o quando si passa a consegnato
    const richiedeFirme = (data.tipo_ddt === "uscita" || data.stato === "consegnato");
    if (richiedeFirme) {
      const prodottiConFoto = data.prodotti.map((prodotto, index) => ({
        ...prodotto,
        foto_prodotto: fotoPerProdotto[index] || []
      }));
      setFormDataTemp({ ...data, prodotti: prodottiConFoto });
      setIsSignatureModalOpen(true);
      return;
    }

    // Se non richiede firme, salva direttamente
    const prodottiConFoto = data.prodotti.map((prodotto, index) => ({
      ...prodotto,
      foto_prodotto: fotoPerProdotto[index] || []
    }));
    await handleSave({ ...data, prodotti: prodottiConFoto });
  };

  const handleSave = async (data: FormValues, firmaTec?: string, firmaCli?: string, nomeCliente?: string, cognomeCliente?: string) => {
    setIsSubmitting(true);
    
    try {
      const prodottiFinali = (data.prodotti || []).map((prodotto) => ({
        ...prodotto,
        foto_prodotto: (prodotto.foto_prodotto || []).filter((foto) => !foto.startsWith('data:image'))
      }));
      const fotoDaCaricare = (data.prodotti || [])
        .map((prodotto, index) => ({
          prodottoIndex: index,
          fotoList: (prodotto.foto_prodotto || []).filter((foto) => foto.startsWith('data:image'))
        }))
        .filter((item) => item.fotoList.length > 0);

      const finalData = {
        ...data,
        prodotti: prodottiFinali,
        // Retrocompatibilità: usa primo prodotto
        tipo_prodotto: prodottiFinali[0]?.tipo_prodotto || "",
        marca: prodottiFinali[0]?.marca || "",
        modello: prodottiFinali[0]?.modello || "",
        serial_number: prodottiFinali[0]?.serial_number || "",
        descrizione_prodotto: prodottiFinali[0]?.descrizione_prodotto || "",
        difetto_segnalato: prodottiFinali[0]?.difetto_segnalato || "",
        difetto_appurato: prodottiFinali[0]?.difetto_appurato || "",
        firma_tecnico: firmaTec || data.firma_tecnico,
        firma_cliente: firmaCli || data.firma_cliente,
        nome_cliente: nomeCliente || data.nome_cliente,
        cognome_cliente: cognomeCliente || data.cognome_cliente,
        // Evita di salvare data URL nel DB: verranno caricate dopo via upload
        foto_prodotto: prodottiFinali[0]?.foto_prodotto || [],
        ricambi_utilizzati: data.ricambi || [],
        costi_extra: data.costi_extra || 0,
        descrizione_extra: data.descrizione_extra || "",
        note_lavoro: data.note_lavoro || ""
      };

      await axios.put(`${getApiUrl()}/ddt/${id}`, finalData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      // Carica eventuali nuove foto dopo l'update
      for (const item of fotoDaCaricare) {
        for (const foto of item.fotoList) {
          try {
            const response = await fetch(foto);
            const blob = await response.blob();
            const file = new File([blob], 'foto.jpg', { type: 'image/jpeg' });

            const formData = new FormData();
            formData.append('file', file);

            await axios.post(`${getApiUrl()}/ddt/${id}/upload-foto`, formData, {
              params: { prodotto_index: item.prodottoIndex },
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

      alert(`DDT ${numeroDdt} aggiornato con successo!`);
      navigate('/admin?tab=ddt');
    } catch (err: any) {
      console.error(err);
      alert('Errore: ' + (err.response?.data?.detail || 'Errore sconosciuto'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignatureConfirm = async (firmaTec: string, firmaCli: string, nomeCliente: string, cognomeCliente: string) => {
    setIsSignatureModalOpen(false);
    await handleSave(formDataTemp, firmaTec, firmaCli, nomeCliente, cognomeCliente);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-500">Caricamento DDT...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Modifica DDT - {numeroDdt}</h1>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <NewClientModal isOpen={isClientModalOpen} onClose={() => setIsClientModalOpen(false)} onClientCreated={handleClientCreated} />
          <SignatureModal isOpen={isSignatureModalOpen} onClose={() => setIsSignatureModalOpen(false)} onConfirm={handleSignatureConfirm} formData={formDataTemp} />
          {isCameraOpen && <CameraCapture onCapture={handleCameraCapture} onClose={() => setIsCameraOpen(false)} />}
          
          {/* Modale Selezione Prodotto Magazzino */}
          {isProductModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
              <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-2xl flex flex-col">
                <div className="bg-blue-600 p-4 flex justify-between items-center text-white shrink-0">
                  <h3 className="font-bold flex items-center gap-2"><Package className="w-5 h-5" /> Seleziona Prodotto da Magazzino</h3>
                  <button onClick={() => setIsProductModalOpen(false)} className="hover:bg-blue-700 p-1 rounded-full"><X className="w-6 h-6" /></button>
                </div>
                <div className="p-4 overflow-y-auto flex-1">
                  <div className="space-y-2">
                    {magazzino.map((product) => (
                      <div
                        key={product.id}
                        onClick={() => handleAddProductFromStore(product)}
                        className="p-3 hover:bg-blue-50 cursor-pointer rounded-lg border border-gray-200"
                      >
                        <div className="font-bold text-gray-800">{product.descrizione}</div>
                        <div className="text-sm text-gray-600">Codice: {product.codice_articolo}</div>
                        <div className="text-sm font-semibold text-blue-600">€ {product.prezzo_vendita?.toFixed(2) || '0.00'}</div>
                      </div>
                    ))}
                    {magazzino.length === 0 && (
                      <p className="text-center text-gray-500 py-8">Nessun prodotto disponibile in magazzino</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

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
              <h2 className="text-lg font-bold text-slate-800">Prodotti</h2>
            </div>

            {prodottiFields.map((field, index) => (
              <div key={field.id} className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-md font-semibold text-slate-700">Prodotto {index + 1}</h3>
                  {prodottiFields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        removeProdotto(index);
                        const newFotoPerProdotto = { ...fotoPerProdotto };
                        delete newFotoPerProdotto[index];
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
                            <img src={normalizePhotoUrl(foto)} alt={`Foto ${fotoIndex + 1}`} className="w-full h-24 object-cover rounded-lg" />
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
            <h2 className="text-lg font-bold text-slate-800 mb-4">Note</h2>
            <IOSTextArea label="Note Aggiuntive" {...register("note")} rows={3} />
            {ddtMeta?.note_log?.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Storico note firmate</p>
                {ddtMeta.note_log.map((entry: any, idx: number) => (
                  <div key={idx} className="text-xs text-gray-600 border border-gray-100 rounded-lg p-2 bg-gray-50">
                    <div className="font-semibold text-gray-800">{entry.tecnico_nome || 'Tecnico'}</div>
                    <div className="text-gray-500">{entry.campo} • {entry.timestamp}</div>
                    <div className="mt-1 text-gray-700">{entry.valore}</div>
                  </div>
                ))}
              </div>
            )}
          </IOSCard>

          {/* Assegnazione tecnico */}
          <IOSCard>
            <h2 className="text-lg font-bold text-slate-800 mb-4">Assegnazione Tecnico</h2>
            <div className="space-y-3 text-sm text-gray-600">
              <div>
                <span className="font-semibold text-gray-700">Stato assegnazione: </span>
                <span className="capitalize">{ddtMeta?.assegnazione_stato?.replace(/_/g, ' ') || 'da assegnare'}</span>
              </div>
              <div>
                <span className="font-semibold text-gray-700">Tecnico assegnato: </span>
                <span>{ddtMeta?.tecnico_assegnato_nome || '-'}</span>
              </div>
              {ddtMeta?.tecnico_assegnazione_pending_nome && (
                <div>
                  <span className="font-semibold text-gray-700">In attesa di risposta: </span>
                  <span>{ddtMeta.tecnico_assegnazione_pending_nome}</span>
                </div>
              )}
            </div>

            {canManageAssignment && (
              <div className="mt-4 border-t border-gray-100 pt-4">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <input
                    type="checkbox"
                    checked={assignmentEnabled}
                    onChange={(e) => setAssignmentEnabled(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  Assegna a Tecnico
                </label>
                {assignmentEnabled && (
                  <div className="mt-3 flex flex-col sm:flex-row gap-3">
                    <select
                      value={selectedTecnicoId}
                      onChange={(e) => setSelectedTecnicoId(e.target.value ? Number(e.target.value) : '')}
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    >
                      <option value="">Seleziona tecnico</option>
                      {technicians.map((t: any) => (
                        <option key={t.id} value={t.id}>{t.nome_completo}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleAssignToTecnico}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-xl text-sm font-semibold"
                    >
                      Conferma
                    </button>
                  </div>
                )}
              </div>
            )}

            {ddtMeta?.tecnico_assegnazione_pending_id === user?.id && (
              <div className="mt-4 border-t border-gray-100 pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={handleAcceptAssignment}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-xl text-sm font-semibold"
                >
                  Accetta DDT
                </button>
                <button
                  type="button"
                  onClick={handleRejectAssignment}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-3 rounded-xl text-sm font-semibold"
                >
                  Rimanda indietro
                </button>
              </div>
            )}

            {ddtMeta?.tecnico_assegnato_id === user?.id && (
              <div className="mt-4 border-t border-gray-100 pt-4">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Passa a collega
                </label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <select
                    value={transferTecnicoId}
                    onChange={(e) => setTransferTecnicoId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  >
                    <option value="">Seleziona tecnico</option>
                    {technicians
                      .filter((t: any) => t.id !== user?.id)
                      .map((t: any) => (
                        <option key={t.id} value={t.id}>{t.nome_completo}</option>
                      ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleTransferRequest}
                    className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-3 rounded-xl text-sm font-semibold"
                  >
                    Invia richiesta
                  </button>
                </div>
              </div>
            )}
          </IOSCard>

          {/* Tipo DDT e Stato */}
          <IOSCard>
            <h2 className="text-lg font-bold text-slate-800 mb-4">Tipo DDT e Stato</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">
                  Tipo DDT
                </label>
                <select {...register("tipo_ddt")} className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-blue-500" disabled={watch("tipo_ddt") === "uscita"}>
                  <option value="ingresso">DDT Ingresso</option>
                  <option value="uscita">DDT Uscita</option>
                </select>
                {watch("tipo_ddt") === "uscita" && (
                  <p className="text-xs text-gray-500 mt-1">DDT Uscita generato da DDT Ingresso</p>
                )}
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">
                  Stato
                </label>
                <select {...register("stato")} className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="in_magazzino">In Magazzino</option>
                  <option value="in_riparazione">In Riparazione</option>
                  <option value="riparato">Riparato (in attesa di consegna)</option>
                  <option value="in_attesa_cliente">In Attesa del Cliente</option>
                  <option value="consegnato">Consegnato</option>
                  <option value="scartato">Non riparabile (sospeso in attesa di consegna)</option>
                </select>
                {watch("stato") && (
                  <div className="mt-2">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                      watch("stato") === 'in_magazzino' ? 'bg-black text-white' :
                      watch("stato") === 'in_riparazione' ? 'bg-orange-500 text-white' :
                      watch("stato") === 'riparato' ? 'bg-blue-600 text-white' :
                      watch("stato") === 'in_attesa_cliente' ? 'bg-yellow-100 text-yellow-700' :
                      watch("stato") === 'consegnato' ? 'bg-green-600 text-white' :
                      watch("stato") === 'scartato' ? 'bg-red-600 text-white' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {watch("stato") === 'riparato'
                        ? 'Riparato (in attesa di consegna)'
                        : watch("stato") === 'scartato'
                          ? 'Non riparabile (sospeso in attesa di consegna)'
                          : watch("stato")?.replace('_', ' ') || 'N/A'}
                    </span>
                  </div>
                )}
              </div>
              
              <IOSToggle
                label="In Attesa del Cliente (Sospensione)"
                checked={watch("in_attesa_cliente") || false}
                onChange={(checked) => setValue("in_attesa_cliente", checked)}
              />
              
              {(watch("stato") === "riparato" || watch("stato") === "scartato" || watch("in_attesa_cliente")) && (
                <div className="mt-4 animate-in fade-in">
                  <IOSTextArea 
                    label="Note Lavoro Eseguito *" 
                    {...register("note_lavoro", { required: watch("stato") === "riparato" || watch("stato") === "scartato" || watch("in_attesa_cliente") })} 
                    rows={4}
                    placeholder="Descrivi il lavoro eseguito, le riparazioni effettuate o il motivo della sospensione..."
                  />
                </div>
              )}
            </div>
          </IOSCard>

          {/* Ricambi e Costi */}
          <IOSCard>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-slate-800">Ricambi Utilizzati</h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(true)}
                  className="text-xs font-bold text-blue-600 bg-white px-3 py-1.5 rounded-full flex items-center border border-gray-200 shadow-sm"
                >
                  <Package className="w-3 h-3 mr-1" /> DAL MAGAZZINO
                </button>
                <button
                  type="button"
                  onClick={() => ricambiFields.append({ descrizione: "", quantita: 1, prezzo_unitario: 0 })}
                  className="text-xs font-bold text-blue-600 bg-white px-3 py-1.5 rounded-full flex items-center border border-gray-200 shadow-sm"
                >
                  <Plus className="w-3 h-3 mr-1" /> AGGIUNGI
                </button>
              </div>
            </div>
            <div className="space-y-3">
              {ricambiFields.fields.map((field, index) => (
                <div key={field.id} className="bg-white p-4 rounded-xl border border-gray-200 flex gap-3 items-end">
                  <div className="flex-1">
                    <IOSInput label="Descrizione" {...register(`ricambi.${index}.descrizione`)} />
                  </div>
                  <div className="w-24">
                    <IOSInput label="Q.tà" type="number" {...register(`ricambi.${index}.quantita`, { valueAsNumber: true })} />
                  </div>
                  <div className="w-32">
                    <IOSInput
                      label="Prezzo Unit."
                      type="number"
                      step="0.01"
                      {...register(`ricambi.${index}.prezzo_unitario`, {
                        valueAsNumber: true,
                        onChange: (e) => {
                          const val = parseFloat(e.target.value);
                          if (isNaN(val) || val < 0) {
                            setValue(`ricambi.${index}.prezzo_unitario`, 0);
                          }
                        }
                      })}
                    />
                  </div>
                  <div className="w-32 text-right">
                    <div className="text-xs text-gray-500 mb-1">Totale</div>
                    <div className="font-bold text-gray-800">
                      € {((watch(`ricambi.${index}.quantita`) || 0) * (watch(`ricambi.${index}.prezzo_unitario`) || 0)).toFixed(2)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => ricambiFields.remove(index)}
                    className="text-red-500 hover:text-red-700 p-2"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {ricambiFields.fields.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">Nessun ricambio aggiunto</p>
              )}
            </div>
            
            {/* Costi Extra */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-base font-bold text-slate-800 mb-4">Costi Extra</h3>
              <IOSInput
                label="Importo Costi Extra"
                type="number"
                step="0.01"
                {...register("costi_extra", { valueAsNumber: true })}
              />
              <IOSTextArea
                label="Descrizione Costi Extra"
                {...register("descrizione_extra")}
                rows={2}
                placeholder="Descrivi i costi extra (es. trasporto, interventi aggiuntivi...)"
              />
            </div>
            
            {/* Totale */}
            <div className="mt-6 pt-6 border-t-2 border-blue-200 bg-blue-50 rounded-xl p-4">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-gray-800">TOTALE</span>
                <span className="text-2xl font-bold text-blue-600">
                  € {(
                    (ricambiFields.fields.reduce((acc, _, idx) => {
                      const qty = watch(`ricambi.${idx}.quantita`) || 0;
                      const price = watch(`ricambi.${idx}.prezzo_unitario`) || 0;
                      return acc + (qty * price);
                    }, 0)) +
                    (watch("costi_extra") || 0)
                  ).toFixed(2)}
                </span>
              </div>
              <div className="text-xs text-gray-600 mt-2">
                (IVA esclusa)
              </div>
            </div>
          </IOSCard>

          {/* Firme */}
          {shouldShowFirme && (
            <IOSCard>
              <h2 className="text-lg font-bold text-slate-800 mb-4">Firme</h2>
              <div className="space-y-4">
                {watch("firma_tecnico") && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Firma Tecnico</label>
                    <img src={watch("firma_tecnico")} alt="Firma Tecnico" className="border border-gray-200 rounded-lg p-2 bg-white max-h-32" />
                  </div>
                )}
                {watch("firma_cliente") && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Firma Cliente</label>
                    <img src={watch("firma_cliente")} alt="Firma Cliente" className="border border-gray-200 rounded-lg p-2 bg-white max-h-32" />
                    {watch("nome_cliente") && watch("cognome_cliente") && (
                      <p className="text-sm text-gray-600 mt-1">{watch("nome_cliente")} {watch("cognome_cliente")}</p>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setIsSignatureModalOpen(true)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold shadow-lg"
                >
                  {watch("firma_tecnico") && watch("firma_cliente") ? "Modifica Firme" : "Aggiungi Firme"}
                </button>
              </div>
            </IOSCard>
          )}

          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => navigate('/admin?tab=ddt')}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 rounded-xl font-bold"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? 'Salvataggio...' : <><Save className="w-5 h-5" /> Salva Modifiche</>}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
