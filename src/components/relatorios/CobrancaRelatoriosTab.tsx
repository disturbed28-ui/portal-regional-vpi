import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Phone, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import {
  calcularPeriodosCobraveis,
  useCobrancaRelatorios,
} from "@/hooks/useCobrancaRelatorios";
import { useWhatsAppTemplates } from "@/hooks/useWhatsAppTemplates";
import { BotaoEnviarWhatsApp } from "@/components/whatsapp/BotaoEnviarWhatsApp";
import { renderTemplate } from "@/lib/whatsapp";
import { removeAccents } from "@/lib/utils";

interface Props {
  /** Período pré-selecionado (label). Se omitido, usa o mais recente. */
  initialPeriodoLabel?: string;
}

/**
 * Aba "Cobrança de Relatórios" para uso dentro da página Relatórios.
 * Lista divisões da regional sem relatório fechado para o período selecionado
 * e oferece botão WhatsApp para enviar lembrete ao diretor.
 */
export const CobrancaRelatoriosTab = ({ initialPeriodoLabel }: Props) => {
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);

  const periodos = useMemo(() => calcularPeriodosCobraveis(), []);
  const [periodoLabel, setPeriodoLabel] = useState<string>(
    initialPeriodoLabel ?? "",
  );

  useEffect(() => {
    if (!periodoLabel && periodos.length > 0) {
      setPeriodoLabel(periodos[0].label);
    }
  }, [periodos, periodoLabel]);

  const periodo = useMemo(
    () => periodos.find((p) => p.label === periodoLabel) ?? null,
    [periodos, periodoLabel],
  );

  const { data: templates } = useWhatsAppTemplates();
  const template = (templates ?? []).find((t) => t.chave === "relatorios_cobranca");

  const { divisoes, totalPendentes, loading, refetch } = useCobrancaRelatorios(
    profile?.regional_id ?? undefined,
    periodo,
  );

  return (
    <div className="space-y-4">
      {/* Header com refresh */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Divisões da sua regional sem relatório fechado no período selecionado.
        </p>
        <Button variant="outline" size="sm" onClick={refetch} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Seletor de período */}
      <div>
        <label className="text-sm font-medium mb-2 block">Período</label>
        <Select value={periodoLabel} onValueChange={setPeriodoLabel}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {periodos.map((p) => (
              <SelectItem key={p.label} value={p.label}>
                {p.label} (cobrança em {p.dataCobranca.split("-").reverse().join("/")})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Resumo */}
      {periodo && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm text-muted-foreground">
                Período:{" "}
                <span className="font-medium text-foreground">
                  {periodo.textoMensagem}
                </span>
              </p>
              <Badge
                variant={totalPendentes === 0 ? "default" : "destructive"}
                className="text-sm"
              >
                {totalPendentes === 0
                  ? "Nenhuma pendência"
                  : `${totalPendentes} divisão(ões) pendente(s)`}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
        </div>
      ) : totalPendentes === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-2" />
            <p className="font-semibold">Tudo em dia!</p>
            <p className="text-sm text-muted-foreground">
              Todas as divisões entregaram o relatório deste período.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {divisoes.map((d) => {
            const mensagem =
              template && periodo
                ? renderTemplate(template.corpo, {
                    nome: d.diretor_nome ?? "diretor(a)",
                    divisao: removeAccents(d.divisao_nome),
                    periodo: periodo.textoMensagem,
                  })
                : "";
            const semDiretor = !d.diretor_nome;
            return (
              <Card
                key={d.divisao_id}
                className={d.ja_enviou ? "opacity-70" : ""}
              >
                <CardContent className="pt-4 pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold truncate">
                          {removeAccents(d.divisao_nome)}
                        </h3>
                        {d.ja_enviou && (
                          <Badge variant="secondary" className="text-xs">
                            Já notificado
                          </Badge>
                        )}
                      </div>
                      {d.diretor_nome ? (
                        <p className="text-sm text-muted-foreground mt-1">
                          Diretor:{" "}
                          <span className="text-foreground">
                            {removeAccents(d.diretor_nome)}
                          </span>
                        </p>
                      ) : (
                        <p className="text-sm text-amber-600 mt-1 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> Sem diretor cadastrado
                        </p>
                      )}
                      {d.diretor_telefone ? (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Phone className="h-3 w-3" /> {d.diretor_telefone}
                        </p>
                      ) : !semDiretor ? (
                        <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                          <AlertTriangle className="h-3 w-3" /> Telefone não cadastrado no perfil
                        </p>
                      ) : null}
                    </div>
                    <BotaoEnviarWhatsApp
                      telefone={d.diretor_telefone}
                      destinatarioNome={d.diretor_nome ?? d.divisao_nome}
                      destinatarioProfileId={d.diretor_profile_id}
                      mensagem={mensagem}
                      templateChave="relatorios_cobranca"
                      templateTitulo={template?.titulo ?? null}
                      moduloOrigem="relatorios-aba-cobranca"
                      regionalId={profile?.regional_id ?? null}
                      divisaoId={d.divisao_id}
                      payload={{
                        periodo_label: periodo?.label,
                        periodo_inicio: periodo?.inicio,
                        periodo_fim: periodo?.fim,
                        divisao_nome: d.divisao_nome,
                      }}
                      label={d.ja_enviou ? "Reenviar" : "Enviar WhatsApp"}
                      size="sm"
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CobrancaRelatoriosTab;
