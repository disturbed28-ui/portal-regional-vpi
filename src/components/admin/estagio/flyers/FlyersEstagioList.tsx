import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { getNivelAcesso } from "@/lib/grauUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ReadOnlyBanner } from "@/components/ui/read-only-banner";
import { Image, Loader2, CheckCircle, Clock, Send, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface FlyerItem {
  solicitacao_id: string;
  integrante_nome_colete: string;
  cargo_estagio_nome: string;
  grau_estagio: string;
  divisao_nome: string;
  divisao_id: string;
  regional_id: string;
  status_flyer: string;
  data_aprovacao: string | null;
  data_inicio_estagio: string | null;
}

interface FlyersEstagioListProps {
  userId?: string;
  readOnly?: boolean;
}

export function FlyersEstagioList({ userId, readOnly = false }: FlyersEstagioListProps) {
  const [items, setItems] = useState<FlyerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const { profile } = useProfile(userId);

  const fetchData = async () => {
    if (!userId) return;
    setLoading(true);

    try {
      const { data: userProfile } = await supabase
        .from("profiles")
        .select("divisao_id, regional_id, grau")
        .eq("id", userId)
        .maybeSingle();

      let nivelAcesso = "comando";
      if (userProfile?.grau) {
        nivelAcesso = getNivelAcesso(userProfile.grau);
      }

      let query = supabase
        .from("solicitacoes_estagio")
        .select(`
          id,
          status_flyer,
          grau_estagio,
          divisao_id,
          regional_id,
          data_aprovacao,
          data_inicio_estagio,
          integrantes_portal!solicitacoes_estagio_integrante_id_fkey(nome_colete),
          cargos!solicitacoes_estagio_cargo_estagio_id_fkey(nome),
          divisoes!solicitacoes_estagio_divisao_id_fkey(nome)
        `)
        .eq("status", "Em Estagio");

      if (nivelAcesso === "regional" && userProfile?.regional_id) {
        query = query.eq("regional_id", userProfile.regional_id);
      } else if (nivelAcesso === "divisao" && userProfile?.divisao_id) {
        query = query.eq("divisao_id", userProfile.divisao_id);
      }

      const { data, error } = await query;
      if (error) throw error;

      const mapped: FlyerItem[] = (data || []).map((sol: any) => ({
        solicitacao_id: sol.id,
        integrante_nome_colete: sol.integrantes_portal?.nome_colete || "N/A",
        cargo_estagio_nome: sol.cargos?.nome || "N/A",
        grau_estagio: sol.grau_estagio,
        divisao_nome: sol.divisoes?.nome || "N/A",
        divisao_id: sol.divisao_id || "",
        regional_id: sol.regional_id || "",
        status_flyer: sol.status_flyer || "pendente",
        data_aprovacao: sol.data_aprovacao,
        data_inicio_estagio: sol.data_inicio_estagio,
      }));

      // Ordenar: pendente primeiro, depois solicitado, depois concluido
      const ordem: Record<string, number> = { pendente: 0, solicitado: 1, concluido: 2 };
      mapped.sort((a, b) => (ordem[a.status_flyer] ?? 3) - (ordem[b.status_flyer] ?? 3));

      setItems(mapped);
    } catch (err: any) {
      console.error("Erro ao buscar flyers:", err);
      toast({ title: "Erro", description: "Não foi possível carregar a lista de flyers.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [userId]);

  const atualizarStatusFlyer = async (solicitacaoId: string, novoStatus: string) => {
    if (readOnly) return;
    setUpdating(solicitacaoId);

    try {
      const { error } = await supabase
        .from("solicitacoes_estagio")
        .update({ status_flyer: novoStatus })
        .eq("id", solicitacaoId);

      if (error) throw error;

      setItems((prev) =>
        prev.map((item) =>
          item.solicitacao_id === solicitacaoId ? { ...item, status_flyer: novoStatus } : item
        )
      );

      const labels: Record<string, string> = {
        pendente: "Pendente",
        solicitado: "Solicitado",
        concluido: "Concluído",
      };

      toast({ title: "Status atualizado", description: `Flyer marcado como "${labels[novoStatus]}".` });
    } catch (err: any) {
      console.error("Erro ao atualizar status do flyer:", err);
      toast({ title: "Erro", description: "Não foi possível atualizar o status.", variant: "destructive" });
    } finally {
      setUpdating(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pendente":
        return <Badge variant="outline" className="border-amber-500 text-amber-600 gap-1"><Clock className="h-3 w-3" /> Pendente</Badge>;
      case "solicitado":
        return <Badge variant="outline" className="border-blue-500 text-blue-600 gap-1"><Send className="h-3 w-3" /> Solicitado</Badge>;
      case "concluido":
        return <Badge variant="outline" className="border-green-500 text-green-600 gap-1"><CheckCircle className="h-3 w-3" /> Concluído</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getNextAction = (status: string) => {
    switch (status) {
      case "pendente":
        return { label: "Marcar Solicitado", next: "solicitado" };
      case "solicitado":
        return { label: "Marcar Concluído", next: "concluido" };
      default:
        return null;
    }
  };

  const filteredItems = filtroStatus === "todos" ? items : items.filter((i) => i.status_flyer === filtroStatus);

  const contadores = {
    pendente: items.filter((i) => i.status_flyer === "pendente").length,
    solicitado: items.filter((i) => i.status_flyer === "solicitado").length,
    concluido: items.filter((i) => i.status_flyer === "concluido").length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {readOnly && <ReadOnlyBanner />}

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Image className="h-5 w-5 text-primary" />
              Flyers de Estágio
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchData} className="gap-1">
              <RefreshCw className="h-3.5 w-3.5" />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Contadores */}
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="secondary" className="gap-1">
              <Clock className="h-3 w-3 text-amber-500" /> Pendentes: {contadores.pendente}
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <Send className="h-3 w-3 text-blue-500" /> Solicitados: {contadores.solicitado}
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <CheckCircle className="h-3 w-3 text-green-500" /> Concluídos: {contadores.concluido}
            </Badge>
          </div>

          {/* Filtro */}
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos ({items.length})</SelectItem>
              <SelectItem value="pendente">Pendentes ({contadores.pendente})</SelectItem>
              <SelectItem value="solicitado">Solicitados ({contadores.solicitado})</SelectItem>
              <SelectItem value="concluido">Concluídos ({contadores.concluido})</SelectItem>
            </SelectContent>
          </Select>

          {/* Lista */}
          {filteredItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              {items.length === 0
                ? "Nenhum integrante com estágio ativo no momento."
                : "Nenhum flyer encontrado com o filtro selecionado."}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredItems.map((item) => {
                const action = getNextAction(item.status_flyer);
                const isUpdating = updating === item.solicitacao_id;

                return (
                  <div
                    key={item.solicitacao_id}
                    className="p-3 rounded-lg border border-border/50 bg-secondary/30 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <p className="font-medium text-sm break-words">{item.integrante_nome_colete}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.cargo_estagio_nome} • Grau {item.grau_estagio}
                        </p>
                        <p className="text-xs text-muted-foreground">{item.divisao_nome}</p>
                        {item.data_inicio_estagio && (
                          <p className="text-xs text-muted-foreground">
                            Início: {format(new Date(item.data_inicio_estagio), "dd/MM/yyyy", { locale: ptBR })}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0">{getStatusBadge(item.status_flyer)}</div>
                    </div>

                    {!readOnly && action && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-xs"
                        disabled={isUpdating}
                        onClick={() => atualizarStatusFlyer(item.solicitacao_id, action.next)}
                      >
                        {isUpdating ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                        ) : null}
                        {action.label}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
