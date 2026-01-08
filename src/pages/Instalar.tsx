import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Download, Share, Check, Smartphone } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const Instalar = () => {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Detectar plataforma
    const userAgent = navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    const isAndroidDevice = /android/.test(userAgent);
    
    setIsIOS(isIOSDevice);
    setIsAndroid(isAndroidDevice);

    // Verificar se já está instalado (modo standalone)
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
                      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);
    setIsInstalled(standalone);

    // Capturar evento de instalação do Android/Chrome
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Detectar quando app foi instalado
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-background p-4 flex flex-col items-center justify-center">
      <div className="w-full max-w-md">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>

        <Card className="border-border">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div
                className="w-24 h-24 rounded-2xl bg-secondary border-2 border-border bg-cover bg-center shadow-lg"
                style={{ backgroundImage: `url('/images/skull.png')` }}
              />
            </div>
            <CardTitle className="text-2xl">Instalar Portal Regional</CardTitle>
          </CardHeader>

          <CardContent className="space-y-6">
            {isStandalone || isInstalled ? (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 mx-auto bg-green-500/20 rounded-full flex items-center justify-center">
                  <Check className="w-8 h-8 text-green-500" />
                </div>
                <p className="text-lg font-medium text-foreground">
                  App ja instalado!
                </p>
                <p className="text-sm text-muted-foreground">
                  O Portal Regional ja esta na sua tela inicial.
                </p>
              </div>
            ) : (
              <>
                <p className="text-center text-muted-foreground">
                  Instale o Portal Regional na sua tela inicial para acesso rapido!
                </p>

                {/* Botão de instalação Android/Chrome */}
                {deferredPrompt && (
                  <Button
                    onClick={handleInstallClick}
                    className="w-full h-14 text-lg bg-primary hover:bg-primary/90"
                  >
                    <Download className="w-5 h-5 mr-2" />
                    Instalar Agora
                  </Button>
                )}

                {/* Instruções para iOS */}
                {isIOS && !deferredPrompt && (
                  <div className="space-y-4 p-4 bg-secondary/50 rounded-xl">
                    <div className="flex items-center gap-2 text-foreground font-medium">
                      <Smartphone className="w-5 h-5" />
                      <span>No iPhone/iPad (Safari):</span>
                    </div>
                    <ol className="space-y-3 text-sm text-muted-foreground">
                      <li className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</span>
                        <span>Toque no icone <Share className="inline w-4 h-4 mx-1" /> (Compartilhar) na barra inferior do Safari</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</span>
                        <span>Role a lista e toque em <strong>"Adicionar a Tela de Inicio"</strong></span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">3</span>
                        <span>Confirme tocando em <strong>"Adicionar"</strong></span>
                      </li>
                    </ol>
                  </div>
                )}

                {/* Instruções para Android sem prompt */}
                {isAndroid && !deferredPrompt && (
                  <div className="space-y-4 p-4 bg-secondary/50 rounded-xl">
                    <div className="flex items-center gap-2 text-foreground font-medium">
                      <Smartphone className="w-5 h-5" />
                      <span>No Android (Chrome):</span>
                    </div>
                    <ol className="space-y-3 text-sm text-muted-foreground">
                      <li className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</span>
                        <span>Toque no menu <strong>⋮</strong> (tres pontos) no canto superior direito</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</span>
                        <span>Toque em <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar a tela inicial"</strong></span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">3</span>
                        <span>Confirme tocando em <strong>"Instalar"</strong></span>
                      </li>
                    </ol>
                  </div>
                )}

                {/* Desktop */}
                {!isIOS && !isAndroid && !deferredPrompt && (
                  <div className="text-center space-y-4 p-4 bg-secondary/50 rounded-xl">
                    <p className="text-sm text-muted-foreground">
                      Para instalar, acesse este portal pelo celular (Android ou iPhone) e siga as instrucoes na tela.
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Benefícios */}
            <div className="space-y-2 pt-4 border-t border-border">
              <p className="text-sm font-medium text-foreground">Beneficios:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>✓ Acesso rapido pela tela inicial</li>
                <li>✓ Abre em tela cheia (sem barra do navegador)</li>
                <li>✓ Atualizacoes automaticas</li>
                <li>✓ Nao ocupa espaco no celular</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Instalar;
