import { useEffect } from "react";
import { useParams } from "react-router-dom";

// Link curto de flyer: redireciona para a função que assina e abre a imagem.
// A função é pública, então o link funciona em convites de WhatsApp.
export default function FlyerRedirect() {
  const { code } = useParams<{ code: string }>();

  useEffect(() => {
    if (code) {
      const base = import.meta.env.VITE_SUPABASE_URL;
      window.location.replace(`${base}/functions/v1/flyer/${code}`);
    }
  }, [code]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <p className="text-muted-foreground">Abrindo o flyer...</p>
    </div>
  );
}
