import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Search, Loader2 } from "lucide-react";
import { normalizeSearchTerm, removeAccents } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface ResultadoIntegrante {
  id: string;
  registro_id: number;
  nome_colete: string;
  comando_texto: string | null;
  regional_texto: string | null;
  divisao_texto: string | null;
  cargo_grau_texto: string | null;
  cargo_nome: string | null;
  grau: string | null;
  ativo: boolean;
  motivo_inativacao: string | null;
  data_inativacao: string | null;
  data_entrada: string | null;
  observacoes: string | null;
  vinculado: boolean;
  profile_id: string | null;
  profiles?: { photo_url: string | null; email: string | null; telefone: string | null } | null;
}

const ConsultaIntegrante = () => {
  const navigate = useNavigate();
  const [termo, setTermo] = useState("");
  const [loading, setLoading] = useState(false);
  const [buscou, setBuscou] = useState(false);
  const [resultados, setResultados] = useState<ResultadoIntegrante[]>([]);

  const buscar = async () => {
    const t = termo.trim();
    if (t.length < 2) {
      toast.info("Digite ao menos 2 caracteres (ID ou nome de colete)");
      return;
    }
    setLoading(true);
    setBuscou(true);
    try {
      let query = supabase
        .from("integrantes_portal")
        .select(`*, profiles:profile_id ( photo_url, email, telefone )`)
        .order("nome_colete")
        .limit(50);

      if (/^\d+$/.test(t)) {
        query = query.eq("registro_id", parseInt(t, 10));
      } else {
        query = query.ilike("nome_colete_ascii", `%${normalizeSearchTerm(t)}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setResultados((data as any[]) || []);
    } catch (e: any) {
      toast.error(e.message || "Erro ao buscar integrante");
      setResultados([]);
    } finally {
      setLoading(false);
    }
  };

  const fmtData = (d: string | null) => (d ? format(new Date(d), "dd/MM/yyyy", { locale: ptBR }) : "—");
  const motivoLabel: Record<string, string> = {
    desligado: "Desligado", expulso: "Expulso", transferido: "Transferido",
    falecido: "Falecido", afastado: "Afastado", promovido: "Promovido", outro: "Outro",
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground">Consultar Integrante</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Buscar por ID ou nome de colete..."
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && buscar()}
          />
          <Button onClick={buscar} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>

        {buscou && !loading && resultados.length === 0 && (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhum integrante encontrado.
          </CardContent></Card>
        )}

        <div className="space-y-3">
          {resultados.map((r) => {
            const foto = r.profiles?.photo_url || null;
            return (
              <Card key={r.id} className={r.ativo ? "" : "border-muted bg-muted/30"}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-16 w-16 border border-border">
                      {foto && <AvatarImage src={foto} alt={r.nome_colete} />}
                      <AvatarFallback>{(r.nome_colete || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground">{removeAccents(r.nome_colete)}</span>
                        <Badge variant="outline" className="text-[10px]">ID {r.registro_id}</Badge>
                        <Badge variant={r.ativo ? "default" : "secondary"} className="text-[10px]">
                          {r.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                        {!r.ativo && r.motivo_inativacao && (
                          <Badge variant="destructive" className="text-[10px]">
                            {motivoLabel[r.motivo_inativacao] || r.motivo_inativacao}
                          </Badge>
                        )}
                        {r.vinculado && <Badge variant="outline" className="text-[10px]">Vinculado</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        {r.cargo_grau_texto && <p>{removeAccents(r.cargo_grau_texto)}</p>}
                        {r.divisao_texto && <p>{removeAccents(r.divisao_texto)}</p>}
                        {r.regional_texto && <p>{removeAccents(r.regional_texto)}</p>}
                        {r.comando_texto && <p>{removeAccents(r.comando_texto)}</p>}
                        {r.data_entrada && <p>Entrada: {fmtData(r.data_entrada)}</p>}
                        {!r.ativo && <p>Desligamento: {fmtData(r.data_inativacao)}</p>}
                        {r.profiles?.telefone && <p>Tel: {r.profiles.telefone}</p>}
                        {r.profiles?.email && <p className="truncate">Email: {r.profiles.email}</p>}
                        {r.observacoes && <p className="italic">{r.observacoes}</p>}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ConsultaIntegrante;
