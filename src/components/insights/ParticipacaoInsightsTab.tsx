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
  agruparParticipacao,
  formatarPercentual,
  InsightStatus,
} from "@/lib/insightsCalculo";
import { containsNormalized } from "@/lib/utils";

interface Registro {
  divisaoId: string;
  integranteId: string;
  nome: string;
  status: InsightStatus;
}

export const ParticipacaoInsightsTab = () => {
  const escopo = useEscopoInsights();
  const [dataInicial, setDataInicial] = useState("");
  const [dataFinal, setDataFinal] = useState("");
  const [divisaoId, setDivisaoId] = useState("todas");
  const [buscaIntegrante, setBuscaIntegrante] = useState("");

  const divisoesEscopo = escopo.divisoesDisponiveis.map((d) => d.id);
  const nomesDivisao = useMemo(
    () => new Map(escopo.divisoesDisponiveis.map((d) => [d.id, d.nome])),
    [escopo.divisoesDisponiveis]
  );

  const { data: insights, isLoading } = useInsightsLista(
    {
      dataInicial: dataInicial || null,
      dataFinal: dataFinal || null,
      divisaoId: divisaoId === "todas" ? null : divisaoId,
      divisoesEscopo,
    },
    !escopo.loading
  );

  const { registros, totalInsights } = useMemo(() => {
    const regs: Registro[] = [];
    let total = 0;
    (insights || []).forEach((insight) => {
      const participacoes = (insight.insight_participacoes || []).filter((p) =>
        buscaIntegrante ? containsNormalized(p.nome_colete_snapshot, buscaIntegrante) : true
      );
      if (participacoes.length === 0) return;
      total++;
      participacoes.forEach((p) =>
        regs.push({
          divisaoId: p.divisao_id_snapshot || insight.divisao_id,
          integranteId: p.integrante_id,
          nome: p.nome_colete_snapshot,
          status: p.status,
        })
      );
    });
    return { registros: regs, totalInsights: total };
  }, [insights, buscaIntegrante]);

  const geral = useMemo(
    () => calcularParticipacao(registros.map((r) => r.status)),
    [registros]
  );

  const porDivisao = useMemo(() => {
    const grupos = agruparParticipacao(registros, (r) => r.divisaoId, (r) => r.status);
    return Array.from(grupos.entries())
      .map(([id, resumo]) => ({
        id,
        nome: nomesDivisao.get(id) || "Divisão",
        resumo,
        integrantes: Array.from(
          agruparParticipacao(
            registros.filter((r) => r.divisaoId === id),
            (r) => r.integranteId,
            (r) => r.status
          ).entries()
        )
          .map(([integranteId, res]) => ({
            id: integranteId,
            nome:
              registros.find((r) => r.integranteId === integranteId)?.nome || "Integrante",
            resumo: res,
          }))
          .sort((a, b) => (b.resumo.percentual ?? -1) - (a.resumo.percentual ?? -1)),
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [registros, nomesDivisao]);

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
            <Label className="text-xs">Divisão</Label>
            <Select value={divisaoId} onValueChange={setDivisaoId}>
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as divisões</SelectItem>
                {escopo.divisoesDisponiveis.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Integrante</Label>
            <Input
              className="h-11"
              placeholder="Nome de colete"
              value={buscaIntegrante}
              onChange={(e) => setBuscaIntegrante(e.target.value)}
            />
          </div>
        </div>
      </Card>

      {(isLoading || escopo.loading) && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && registros.length === 0 && (
        <Card className="p-4 text-center text-sm text-muted-foreground">
          Nenhum dado de participação para os filtros selecionados.
        </Card>
      )}

      {registros.length > 0 && (
        <>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">
              {divisaoId === "todas" ? "Participação Regional" : "Participação da Divisão"}
            </p>
            <p className="text-3xl font-bold">{formatarPercentual(geral.percentual)}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md bg-muted/50 p-2">
                <p className="text-muted-foreground">Insights considerados</p>
                <p className="text-base font-semibold">{totalInsights}</p>
              </div>
              <div className="rounded-md bg-muted/50 p-2">
                <p className="text-muted-foreground">Respostas aplicáveis</p>
                <p className="text-base font-semibold">{geral.aplicaveis}</p>
              </div>
              <div className="rounded-md bg-muted/50 p-2">
                <p className="text-muted-foreground">Respostas recebidas</p>
                <p className="text-base font-semibold text-emerald-600">{geral.respondeu}</p>
              </div>
              <div className="rounded-md bg-muted/50 p-2">
                <p className="text-muted-foreground">Não respondidos</p>
                <p className="text-base font-semibold text-destructive">{geral.naoRespondeu}</p>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Registros N/A ({geral.naoAplicavel}) não entram no cálculo.
            </p>
          </Card>

          <Accordion type="multiple" className="space-y-2">
            {porDivisao.map((divisao) => (
              <AccordionItem
                key={divisao.id}
                value={divisao.id}
                className="rounded-lg border bg-card px-3"
              >
                <AccordionTrigger className="py-3 hover:no-underline">
                  <div className="flex flex-1 items-center justify-between gap-2 pr-2 text-left">
                    <span className="truncate text-sm font-semibold">{divisao.nome}</span>
                    <Badge variant="secondary" className="shrink-0 text-[10px]">
                      {formatarPercentual(divisao.resumo.percentual)}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-1 pb-3">
                  {divisao.integrantes.map((integrante) => (
                    <div
                      key={integrante.id}
                      className="flex items-center justify-between gap-2 rounded-md border p-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium">{integrante.nome}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {integrante.resumo.respondeu}/{integrante.resumo.aplicaveis} aplicáveis
                        </p>
                      </div>
                      <span className="shrink-0 text-xs font-semibold">
                        {formatarPercentual(integrante.resumo.percentual)}
                      </span>
                    </div>
                  ))}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </>
      )}
    </div>
  );
};
