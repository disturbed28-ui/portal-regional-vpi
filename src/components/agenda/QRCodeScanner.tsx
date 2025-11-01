import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Html5Qrcode } from "html5-qrcode";

interface QRCodeScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (profileId: string, integranteId: string) => void;
}

export function QRCodeScanner({ open, onOpenChange, onScan }: QRCodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const scannerId = "qr-reader";

  useEffect(() => {
    if (open) {
      startScanning();
    } else {
      stopScanning();
    }

    return () => {
      stopScanning();
    };
  }, [open]);

  const startScanning = async () => {
    setLoading(true);
    try {
      console.log("[QRCodeScanner] Iniciando scanner de QR Code...");
      
      scannerRef.current = new Html5Qrcode(scannerId);
      
      await scannerRef.current.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
        },
        (decodedText) => {
          console.log("[QRCodeScanner] QR Code detectado:", decodedText);
          handleQRCodeDetected(decodedText);
        },
        (errorMessage) => {
          // Ignora erros de "não encontrou QR code" - isso é normal
          if (!errorMessage.includes("NotFoundException")) {
            console.log("[QRCodeScanner] Erro ao escanear:", errorMessage);
          }
        }
      );
      
      console.log("[QRCodeScanner] Scanner iniciado com sucesso");
      setScanning(true);
      setLoading(false);
    } catch (error) {
      console.error("[QRCodeScanner] Erro ao iniciar scanner:", error);
      setLoading(false);
      
      let errorMessage = "Não foi possível acessar a câmera";
      
      if (error instanceof Error) {
        if (error.message.includes("NotAllowedError") || error.message.includes("Permission")) {
          errorMessage = "Permissão de câmera negada. Por favor, permita o acesso à câmera nas configurações do navegador.";
        } else if (error.message.includes("NotFoundError")) {
          errorMessage = "Nenhuma câmera encontrada no dispositivo.";
        } else if (error.message.includes("NotReadableError")) {
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

  const stopScanning = async () => {
    console.log("[QRCodeScanner] Parando scanner");
    try {
      if (scannerRef.current && scanning) {
        await scannerRef.current.stop();
        scannerRef.current.clear();
        scannerRef.current = null;
      }
    } catch (error) {
      console.error("[QRCodeScanner] Erro ao parar scanner:", error);
    }
    setScanning(false);
    setLoading(false);
  };

  const handleQRCodeDetected = (decodedText: string) => {
    console.log("[QRCodeScanner] Processando QR Code:", decodedText);
    
    // Parar o scanner
    stopScanning();
    
    // Verificar formato: profileId|integranteId
    if (decodedText.includes('|')) {
      const [profileId, integranteId] = decodedText.split('|');
      onScan(profileId, integranteId);
      onOpenChange(false);
      
      toast({
        title: "QR Code lido com sucesso",
        description: "Presença será registrada",
      });
    } else {
      toast({
        title: "QR Code inválido",
        description: "O formato do QR Code não é válido",
        variant: "destructive",
      });
      // Reiniciar scanner
      startScanning();
    }
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
          <div className="relative">
            <div 
              id={scannerId}
              className="w-full aspect-square rounded-lg overflow-hidden"
            />
            
            {!scanning && loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted rounded-lg gap-2">
                <Camera className="w-16 h-16 text-muted-foreground" />
                <p className="text-sm text-muted-foreground animate-pulse">
                  Carregando câmera...
                </p>
              </div>
            )}
            
            {scanning && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-full text-sm">
                Aponte para o QR Code
              </div>
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
