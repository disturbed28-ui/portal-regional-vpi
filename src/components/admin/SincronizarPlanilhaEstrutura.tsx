import { useState } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RefreshCw, ExternalLink } from "lucide-react";

export const SincronizarPlanilhaEstrutura = () => {
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  const sincronizar = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("sync-estrutura-sheets", { body: {} });
    setLoading(false);
    if (error) {
      const det = error instanceof FunctionsHttpError ? await error.context.text() : error.message;
      console.error("sync-estrutura-sheets", det);
      toast.error("Não foi possível sincronizar a planilha", { duration: 6000, dismissible: false });
      return;
    }
    setUrl(data.url);
    toast.success(
      `Planilha atualizada: ${data.totais.regionais} regionais e ${data.totais.divisoes} divisões`,
      { duration: 6000, dismissible: false },
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <Button variant="outline" size="sm" onClick={sincronizar} disabled={loading}>
        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
        Sincronizar agora com a planilha
      </Button>
      {url && (
        <Button variant="link" size="sm" asChild>
          <a href={url} target="_blank" rel="noreferrer">
            Abrir planilha <ExternalLink className="h-3 w-3 ml-1" />
          </a>
        </Button>
      )}
    </div>
  );
};
