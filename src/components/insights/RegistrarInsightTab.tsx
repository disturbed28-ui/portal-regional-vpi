import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Save, RotateCcw, CheckCheck, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  useEscopoInsights,
  useIntegrantesDivisaoInsight,
  useInsightExistente,
  useSalvarInsight,
} from "@/hooks/useInsights";
import {
  InsightStatus,
  statusPadraoPorGrau,
  grauObrigatorio,
  calcularParticipacao,
  formatarPercentual,
} from "@/lib/insightsCalculo";
import { StatusToggle } from "./StatusToggle";

export interface EdicaoInsight {
  dataInsight: string;
  numeroInsight: number;
  divisaoId: string;
  token: number;
}

export const RegistrarInsightTab = ({ edicao }: { edicao?: EdicaoInsight | null }) => {
  const escopo = useEscopoInsights();
  const [dataInsight, setDataInsight] = useState(() => new Date().toISOString().slice(0, 10));
  const [numeroInsight, setNumeroInsight] = useState("");
  const [divisaoId, setDivisaoId] = useState<string>("");
  const [statusMap, setStatusMap] = useState<Record<string, InsightStatus>>({});

  // Reabertura de um lançamento vindo do Histórico
  useEffect(() => {
    if (!edicao) return;
    setDataInsight(edicao.dataInsight);
    setNumeroInsight(String(edicao.numeroInsight));
    setDivisaoId(edicao.divisaoId);
  }, [edicao?.token]);

  // Pré-selecionar a divisão do usuário quando existir
  useEffect(() => {
    if (!divisaoId && escopo.divisoesDisponiveis.length > 0) {
      const padrao =
        escopo.divisoesDisponiveis.find((d) => d.id === escopo.divisaoIdUsuario) ||
        (escopo.divisoesDisponiveis.length === 1 ? escopo.divisoesDisponiveis[0] : null);
      if (padrao) setDivisaoId(padrao.id);
    }
  }, [escopo.divisoesDisponiveis, escopo.divisaoIdUsuario, divisaoId]);


  const numero = numeroInsight ? parseInt(numeroInsight, 10) : null;
  const cabecalhoPronto = !!dataInsight && !!numero && !!divisaoId;

  const { data: integrantes, isLoading: loadingIntegrantes } =
    useIntegrantesDivisaoInsight(cabecalhoPronto ? divisaoId : null);
  const { data: existente, isLoading: loadingExistente } = useInsightExistente(
    divisaoId || null,
    numero,
    dataInsight || null
  );
  const salvar = useSalvarInsight();

  // Carregar padrões (ou o lançamento existente) ao montar a lista
  useEffect(() => {
    if (!integrantes) return;
    const base: Record<string, InsightStatus> = {};
    integrantes.forEach((i) => {
      base[i.id] = statusPadraoPorGrau(i.grau);
    });
    existente?.insight_participacoes?.forEach((p) => {
      if (base[p.integrante_id] !== undefined) base[p.integrante_id] = p.status;
    });
    setStatusMap(base);
  }, [integrantes, existente]);

  const resumo = useMemo(
    () => calcularParticipacao(Object.values(statusMap)),
    [statusMap]
  );

  const restaurarPadrao = () => {
    if (!integrantes) return;
    const base: Record<string, InsightStatus> = {};
    integrantes.forEach((i) => (base[i.id] = statusPadraoPorGrau(i.grau)));
    setStatusMap(base);
  };

  const marcarAplicaveis = () => {
    if (!integrantes) return;
    setStatusMap((prev) => {
      const novo = { ...prev };
      integrantes.forEach((i) => {
        if (grauObrigatorio(i.grau)) novo[i.id] = "RESPONDEU";
      });
      return novo;
    });
  };

  const handleSalvar = async () => {
    if (!cabecalhoPronto || !integrantes?.length) return;
    try {
      await salvar.mutateAsync({
        insightId: existente?.id || null,
        numeroInsight: numero!,
        dataInsight,
        divisaoId,
        regionalId: escopo.regionalId,
        responsavelNome: escopo.responsavelNome,
        userId: escopo.userId,
        participacoes: integrantes.map((i) => ({
          integrante_id: i.id,
          nome_colete_snapshot: i.nome_colete,
          grau_snapshot: i.grau,
          cargo_grau_texto_snapshot: i.cargo_grau_texto,
          divisao_id_snapshot: i.divisao_id,
          status: statusMap[i.id] || statusPadraoPorGrau(i.grau),
        })),
      });
      toast.success(
        existente ? "Lançamento atualizado com sucesso" : "Insight registrado com sucesso",
        { duration: 6000, dismissible: false }
      );
    } catch (e: any) {
      toast.error("Erro ao salvar o Insight", {
        description: e?.message,
        duration: 6000,
        dismissible: false,
      });
    }
  };

  if (escopo.loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-28">
      {/* Cabeçalho */}
      <Card className="p-3 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="data-insight" className="text-xs">Data do Insight</Label>
            <Input
              id="data-insight"
              type="date"
              className="h-11"
              value={dataInsight}
              onChange={(e) => setDataInsight(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="numero-insight" className="text-xs">Nº do Insight</Label>
            <Input
              id="numero-insight"
              type="number"
              inputMode="numeric"
              min={1}
              placeholder="Ex.: 37"
              className="h-11"
              value={numeroInsight}
              onChange={(e) => setNumeroInsight(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Divisão</Label>
          <Select value={divisaoId} onValueChange={setDivisaoId}>
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Selecione a divisão" />
            </SelectTrigger>
            <SelectContent>
              {escopo.divisoesDisponiveis.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <p className="text-xs text-muted-foreground">
          Responsável pelo lançamento: <strong>{escopo.responsavelNome}</strong>
        </p>
      </Card>

      {!cabecalhoPronto && (
        <Card className="p-4 text-center text-sm text-muted-foreground">
          Informe a data, o número do Insight e a divisão para carregar os integrantes.
        </Card>
      )}

      {cabecalhoPronto && existente && !loadingExistente && (
        <Card className="flex items-start gap-2 border-amber-500/50 bg-amber-500/10 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-xs">
            Já existe lançamento deste Insight para esta divisão nesta data. Os status
            registrados foram carregados — ao salvar, o lançamento existente será atualizado.
          </p>
        </Card>
      )}

      {cabecalhoPronto && (loadingIntegrantes || loadingExistente) && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {cabecalhoPronto && !loadingIntegrantes && integrantes?.length === 0 && (
        <Card className="p-4 text-center text-sm text-muted-foreground">
          Nenhum integrante ativo encontrado nesta divisão.
        </Card>
      )}

      {cabecalhoPronto && !loadingIntegrantes && !!integrantes?.length && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="h-11 text-xs" onClick={marcarAplicaveis}>
              <CheckCheck className="mr-1 h-4 w-4" />
              Marcar aplicáveis
            </Button>
            <Button variant="outline" className="h-11 text-xs" onClick={restaurarPadrao}>
              <RotateCcw className="mr-1 h-4 w-4" />
              Restaurar padrão
            </Button>
          </div>

          <div className="space-y-2">
            {integrantes.map((i) => (
              <Card key={i.id} className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{i.nome_colete}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {i.cargo_grau_texto || i.cargo_nome || "—"}
                    </p>
                  </div>
                  {grauObrigatorio(i.grau) && (
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      Obrigatório
                    </Badge>
                  )}
                </div>
                <StatusToggle
                  status={statusMap[i.id] || statusPadraoPorGrau(i.grau)}
                  onChange={(s) => setStatusMap((prev) => ({ ...prev, [i.id]: s }))}
                />
              </Card>
            ))}
          </div>

          {/* Barra fixa de ação (acessível com o polegar) */}
          <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-3 backdrop-blur">
            <div className="mx-auto flex max-w-2xl items-center gap-3">
              <div className="min-w-0 text-xs">
                <p className="font-semibold">
                  Participação: {formatarPercentual(resumo.percentual)}
                </p>
                <p className="text-muted-foreground">
                  {resumo.respondeu} de {resumo.aplicaveis} aplicáveis · {resumo.naoAplicavel} N/A
                </p>
              </div>
              <Button
                className="ml-auto h-12 flex-1"
                onClick={handleSalvar}
                disabled={salvar.isPending}
              >
                {salvar.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {existente ? "Atualizar" : "Salvar"}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
