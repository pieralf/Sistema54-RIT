import { useState, useRef, useEffect } from 'react';
import { Camera, X, Check, RotateCcw } from 'lucide-react';

interface CameraCaptureProps {
  onCapture: (imageDataUrl: string) => void;
  onClose: () => void;
}

export default function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment'); // 'environment' = posteriore, 'user' = anteriore
  const [isSecureContext, setIsSecureContext] = useState(true);

  const isCameraSupported = () =>
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices !== 'undefined' &&
    typeof navigator.mediaDevices.getUserMedia === 'function';

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [facingMode]);

  const startCamera = async () => {
    try {
      const secureContext = typeof window !== 'undefined' ? window.isSecureContext : true;
      setIsSecureContext(secureContext);
      if (!secureContext || !isCameraSupported()) {
        setError(
          !secureContext
            ? 'Accesso alla telecamera richiede HTTPS o localhost. Usa il caricamento manuale.'
            : 'La telecamera non è supportata su questo dispositivo. Usa il caricamento manuale.'
        );
        return;
      }
      // Ferma stream esistente
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      // Richiedi accesso alla telecamera
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setError(null);
    } catch (err: any) {
      console.error('Errore accesso telecamera:', err);
      setError(
        err.name === 'NotAllowedError'
          ? 'Accesso alla telecamera negato. Abilita i permessi nel browser.'
          : err.name === 'NotFoundError'
          ? 'Nessuna telecamera trovata.'
          : 'Errore accesso telecamera: ' + err.message
      );
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Imposta dimensioni canvas uguali al video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Disegna il frame corrente del video sul canvas
    context.drawImage(video, 0, 0);

    // Converti in base64
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);
    onCapture(imageDataUrl);
    stopCamera();
  };

  const switchCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const handleFileCapture = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onCapture(reader.result);
        stopCamera();
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="bg-black/80 text-white p-4 flex justify-between items-center">
        <h3 className="font-bold text-lg">Scatta Foto</h3>
        <button
          onClick={() => {
            stopCamera();
            onClose();
          }}
          className="p-2 hover:bg-white/20 rounded-full"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Video Preview */}
      <div className="flex-1 relative flex items-center justify-center bg-black">
        {error ? (
          <div className="text-white text-center p-8">
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={startCamera}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold"
            >
              Riprova
            </button>
            <div className="mt-6">
              <label className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/10 border border-white/20 text-white cursor-pointer">
                <span>Carica foto</span>
                <input
                  type="file"
                  accept="image/*"
                  capture={facingMode}
                  onChange={handleFileCapture}
                  className="hidden"
                />
              </label>
              {!isSecureContext && (
                <div className="mt-2 text-xs text-gray-300">
                  Suggerimento: su Android la fotocamera via browser richiede HTTPS.
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-contain"
            />
            <canvas ref={canvasRef} className="hidden" />
          </>
        )}
      </div>

      {/* Controls */}
      {!error && (
        <div className="bg-black/80 p-6 flex justify-center items-center gap-6">
          <button
            onClick={switchCamera}
            className="p-4 bg-white/20 hover:bg-white/30 rounded-full text-white"
            title="Cambia telecamera"
          >
            <RotateCcw className="w-6 h-6" />
          </button>
          
          <button
            onClick={capturePhoto}
            className="w-20 h-20 rounded-full bg-white border-4 border-gray-300 shadow-lg hover:scale-105 transition-transform"
            title="Scatta foto"
          >
            <div className="w-full h-full rounded-full bg-white"></div>
          </button>
          
          <div className="w-12"></div> {/* Spacer per centrare il pulsante */}
        </div>
      )}
    </div>
  );
}
