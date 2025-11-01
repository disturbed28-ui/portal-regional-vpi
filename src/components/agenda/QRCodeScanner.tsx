import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface QRCodeScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (profileId: string, integranteId: string) => void;
}

export function QRCodeScanner({ open, onOpenChange, onScan }: QRCodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [open]);

  const startCamera = async () => {
    setLoading(true);
    try {
      console.log("[QRCodeScanner] Solicitando acesso à câmera...");
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      console.log("[QRCodeScanner] Câmera acessada com sucesso");
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        setStream(mediaStream);
        
        // Aguardar o vídeo carregar e começar a tocar
        videoRef.current.onloadedmetadata = () => {
          console.log("[QRCodeScanner] Vídeo carregado, iniciando reprodução");
          videoRef.current?.play().then(() => {
            console.log("[QRCodeScanner] Vídeo reproduzindo");
            setScanning(true);
            setLoading(false);
          }).catch(err => {
            console.error("[QRCodeScanner] Erro ao reproduzir vídeo:", err);
            setLoading(false);
          });
        };
      }
    } catch (error) {
      console.error("[QRCodeScanner] Erro ao acessar câmera:", error);
      setLoading(false);
      
      let errorMessage = "Não foi possível acessar a câmera";
      
      if (error instanceof Error) {
        if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
          errorMessage = "Permissão de câmera negada. Por favor, permita o acesso à câmera nas configurações do navegador.";
        } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
          errorMessage = "Nenhuma câmera encontrada no dispositivo.";
        } else if (error.name === "NotReadableError" || error.name === "TrackStartError") {
          errorMessage = "Câmera já está em uso por outro aplicativo.";
        }
      }
      
      toast({
        title: "Erro ao acessar câmera",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const stopCamera = () => {
    console.log("[QRCodeScanner] Parando câmera");
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setScanning(false);
    setLoading(false);
  };

  // Função temporária para simular leitura de QR code
  // Em produção, usar biblioteca como html5-qrcode ou jsqr
  const handleManualInput = () => {
    const input = prompt("Cole o ID do QR Code (formato: profileId|integranteId):");
    if (input && input.includes('|')) {
      const [profileId, integranteId] = input.split('|');
      onScan(profileId, integranteId);
      onOpenChange(false);
    } else {
      toast({
        title: "Erro",
        description: "QR Code inválido",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Escanear QR Code</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative aspect-square bg-muted rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${scanning ? 'block' : 'hidden'}`}
            />
            
            {!scanning && (
              <div className="flex flex-col items-center justify-center h-full gap-2">
                <Camera className="w-16 h-16 text-muted-foreground" />
                {loading && (
                  <p className="text-sm text-muted-foreground animate-pulse">
                    Carregando câmera...
                  </p>
                )}
              </div>
            )}
            
            {scanning && (
              <div className="absolute inset-0 border-2 border-primary/50 m-8 rounded-lg pointer-events-none" />
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleManualInput}
            >
              Inserir Manualmente
            </Button>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <p className="text-sm text-muted-foreground text-center">
            Aponte a câmera para o QR Code do integrante
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
