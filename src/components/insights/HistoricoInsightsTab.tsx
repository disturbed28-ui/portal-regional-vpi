import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useEscopoInsights, useInsightsLista } from "@/hooks/useInsights";
import {
  calcularParticipacao,
  formatarPercentual,
} from "@/lib/insightsCalculo";
import { containsNormalized } from "@/lib/utils";
import { StatusBadge } from "./StatusToggle";

const formatarData = (iso: string) => {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
};

const formatarDataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

export const HistoricoInsightsTab = () => {
  const escopo = useEscopoInsights();
  const [dataInicial, setDataInicial] = useState("");
  const [dataFinal, setDataFinal] = useState("");
  const [numero, setNumero] = useState("");
  const [divisaoId, setDivisaoId] = useState("todas");
  const [buscaIntegrante, setBuscaIntegrante] = useState("");
  const [buscaResponsavel, setBuscaResponsavel] = useState("");

  const divisoesEscopo = escopo.divisoesDisponiveis.map((d) => d.id);
  const nomesDivisao = useMemo(
    () => new Map(escopo.divisoesDisponiveis.map((d) => [d.id, d.nome])),
    [escopo.divisoesDisponiveis]
  );

  const { data: insights, isLoading } = useInsightsLista(
    {
      dataInicial: dataInicial || null,
      dataFinal: dataFinal || null,
      numeroInsight: numero ? parseInt(numero, 10) : null,
      divisaoId: divisaoId === "todas" ? null : divisaoId,
      divisoesEscopo,
    },
    !escopo.loading
  );

  const lista = useMemo(() => {
    return (insights || []).filter((i) => {
      if (buscaResponsavel && !containsNormalized(i.responsavel_nome || "", buscaResponsavel))
        return false;
      if (
        buscaIntegrante &&
        !i.insight_participacoes?.some((p) =>
          containsNormalized(p.nome_colete_snapshot, buscaIntegrante)
        )
      )
        return false;
      return true;
    });
  }, [insights, buscaIntegrante, buscaResponsavel]);

  return (
    <div className="space-y-3 pb-6">
      <Card className="p-3 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Data inicial</Label>
            <Input type="date" className="h-11" value={dataInicial} onChange={(e) => setDataInicial(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Data final</Label>
            <Input type="date" className="h-11" value={dataFinal} onChange={(e) => setDataFinal(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Nº do Insight</Label>
            <Input
              type="number"
              inputMode="numeric"
              className="h-11"
              placeholder="Todos"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Divisão</Label>
            <Select value={divisaoId} onValueChange={setDivisaoId}>
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {escopo.divisoesDisponiveis.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Integrante</Label>
            <Input
              className="h-11"
              placeholder="Nome de colete"
              value={buscaIntegrante}
              onChange={(e) => setBuscaIntegrante(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Responsável</Label>
            <Input
              className="h-11"
              placeholder="Quem lançou"
              value={buscaResponsavel}
              onChange={(e) => setBuscaResponsavel(e.target.value)}
            />
          </div>
        </div>
      </Card>

      {(isLoading || escopo.loading) && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && lista.length === 0 && (
        <Card className="p-4 text-center text-sm text-muted-foreground">
          Nenhum lançamento encontrado para os filtros selecionados.
        </Card>
      )}

      {lista.length > 0 && (
        <Accordion type="multiple" className="space-y-2">
          {lista.map((insight) => {
            const resumo = calcularParticipacao(
              (insight.insight_participacoes || []).map((p) => p.status)
            );
            return (
              <AccordionItem
                key={insight.id}
                value={insight.id}
                className="rounded-lg border bg-card px-3"
              >
                <AccordionTrigger className="py-3 hover:no-underline">
                  <div className="flex-1 space-y-1 pr-2 text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">
                        Insight {String(insight.numero_insight).padStart(3, "0")}
                      </span>
                      <Badge variant="secondary" className="text-[10px]">
                        {formatarPercentual(resumo.percentual)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatarData(insight.data_insight)} ·{" "}
                      {nomesDivisao.get(insight.divisao_id) || "Divisão"}
                    </p>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-2 pb-3">
                  <div className="rounded-md bg-muted/50 p-2 text-[11px] text-muted-foreground">
                    <p>Responsável: {insight.responsavel_nome || "—"}</p>
                    <p>Lançado em: {formatarDataHora(insight.created_at)}</p>
                    {insight.updated_at !== insight.created_at && (
                      <p>Alterado em: {formatarDataHora(insight.updated_at)}</p>
                    )}
                    <p>
                      {resumo.respondeu} respondeu · {resumo.naoRespondeu} não respondeu ·{" "}
                      {resumo.naoAplicavel} N/A
                    </p>
                  </div>
                  <div className="space-y-1">
                    {(insight.insight_participacoes || [])
                      .slice()
                      .sort((a, b) => a.nome_colete_snapshot.localeCompare(b.nome_colete_snapshot))
                      .map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between gap-2 rounded-md border p-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium">
                              {p.nome_colete_snapshot}
                            </p>
                            <p className="truncate text-[10px] text-muted-foreground">
                              {p.cargo_grau_texto_snapshot ||
                                (p.grau_snapshot ? `Grau ${p.grau_snapshot}` : "—")}
                            </p>
                          </div>
                          <StatusBadge status={p.status} />
                        </div>
                      ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </div>
  );
};
