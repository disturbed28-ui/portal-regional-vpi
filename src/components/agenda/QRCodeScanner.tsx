import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "@/integrations/supabase/client";

interface QRCodeScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (profileId: string, integranteId: string) => void;
}

export function QRCodeScanner({ open, onOpenChange, onScan }: QRCodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const processingRef = useRef<boolean>(false);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const scannerId = "qr-reader";

  useEffect(() => {
    if (open) {
      // Aguardar o DOM estar pronto antes de iniciar o scanner
      const timer = setTimeout(() => {
        startScanning();
      }, 100);
      return () => clearTimeout(timer);
    } else {
      stopScanning();
    }
  }, [open]);

  const startScanning = async () => {
    setLoading(true);
    try {
      console.log("[QRCodeScanner] Iniciando scanner de QR Code...");
      
      // Verificar se o elemento existe
      const element = document.getElementById(scannerId);
      if (!element) {
        console.error("[QRCodeScanner] Elemento não encontrado, tentando novamente...");
        setTimeout(startScanning, 200);
        return;
      }
      
      // Verificar se já existe um scanner ativo
      if (scannerRef.current) {
        console.log("[QRCodeScanner] Scanner já existe, limpando...");
        await stopScanning();
      }
      
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
        } else if (error.message.includes("NotFoundError") || error.message.includes("not found")) {
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

  const handleQRCodeDetected = async (decodedText: string) => {
    // Evitar processar o mesmo QR Code múltiplas vezes
    if (processingRef.current) {
      console.log("[QRCodeScanner] Já processando um QR Code, ignorando...");
      return;
    }
    
    processingRef.current = true;
    console.log("[QRCodeScanner] Processando QR Code:", decodedText);
    
    // Parar o scanner
    await stopScanning();
    
    try {
      // Verificar formato: profileId|integranteId ou apenas profileId
      let profileId: string;
      let integranteId: string;
      
      if (decodedText.includes('|')) {
        [profileId, integranteId] = decodedText.split('|');
      } else {
        // Só tem profileId, buscar integranteId no banco
        profileId = decodedText;
        
        console.log("[QRCodeScanner] Buscando integrante com profile_id:", profileId);
        
        const { data: integrante, error } = await supabase
          .from('integrantes_portal')
          .select('id')
          .eq('profile_id', profileId)
          .single();
        
        if (error || !integrante) {
          console.error("[QRCodeScanner] Integrante não encontrado:", error);
          toast({
            title: "Integrante não encontrado",
            description: "Não foi possível localizar este integrante no sistema",
            variant: "destructive",
          });
          processingRef.current = false;
          onOpenChange(false);
          return;
        }
        
        integranteId = integrante.id;
        console.log("[QRCodeScanner] Integrante encontrado:", integranteId);
      }
      
      onScan(profileId, integranteId);
      onOpenChange(false);
      
      toast({
        title: "QR Code lido com sucesso",
        description: "Presença será registrada",
      });
    } catch (error) {
      console.error("[QRCodeScanner] Erro ao processar QR Code:", error);
      toast({
        title: "Erro ao processar QR Code",
        description: "Tente novamente",
        variant: "destructive",
      });
    } finally {
      processingRef.current = false;
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
