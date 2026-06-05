import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useDivisoesPorRegional } from "@/hooks/useDivisoesPorRegional";
import { useExpansaoCandidatos, STATUS_META, type ExpansaoCandidato, type ExpansaoStatus } from "@/hooks/useExpansao";
import { useDiretorDivisao } from "@/hooks/useDiretorDivisao";
import { useWhatsAppTemplates } from "@/hooks/useWhatsAppTemplates";
import { renderTemplate } from "@/lib/whatsapp";
import { BotaoEnviarWhatsApp } from "@/components/whatsapp/BotaoEnviarWhatsApp";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { BaixaDialog, type BaixaPayload } from "@/components/expansao/BaixaDialog";
import { ChevronDown, Send, Phone, IdCard } from "lucide-react";
import { toast } from "sonner";

const notify = (m: string, e = false) =>
  (e ? toast.error : toast.success)(m, { duration: 6000, dismissible: false });

const fmtDataHora = (v: string | null): string | null => {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const fmtData = (v: string | null): string | null => {
  if (!v) return null;
  // datas puras (YYYY-MM-DD) — evitar shift de fuso
  const apenas = String(v).split("T")[0];
  const partes = apenas.split("-");
  if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
  return v;
};

/* ---------- Linha do tempo (histórico detalhado) ---------- */
function LinhaDoTempo({ c }: { c: ExpansaoCandidato }) {
  const baixaLabel = STATUS_META[c.status]?.label || c.status;
  const etapas: { label: string; valor: string | null }[] = [
    ["Divisão de destino", c.divisoes?.nome || null],
    ["Recebimento da ficha", fmtData(c.data_recebimento)],
    ["Enviada ao Diretor de Divisão", fmtDataHora(c.enviado_em)],
    ["Diretor que recebeu", c.enviado_para_nome],
    ["Telefone do diretor", c.enviado_para_telefone],
    ["Data de contato com o candidato", fmtData(c.contato_em)],
    [`Baixa (${baixaLabel})`, fmtDataHora(c.baixa_em)],
    ["Observação da baixa", c.baixa_observacao],
    ["Reportado à Expansão", fmtDataHora(c.reportado_em)],
  ].map(([label, valor]) => ({ label, valor }));

  return (
    <div className="mt-2 border-l-2 border-muted pl-3 space-y-1.5">
      {etapas.map(({ label, valor }) => (
        <div key={label} className="text-xs">
          <span className="font-medium text-muted-foreground">{label}:</span>{" "}
          <span>{valor || "—"}</span>
        </div>
      ))}
    </div>
  );
}

const toneClass: Record<string, string> = {
  red: "border-l-4 border-l-destructive",
  green: "border-l-4 border-l-green-600",
  blue: "border-l-4 border-l-blue-600",
  gray: "border-l-4 border-l-muted-foreground",
};

function FichaDetalhe({ c }: { c: ExpansaoCandidato }) {
  const rows: [string, string | null][] = [
    ["Nome completo", c.nome_completo],
    ["Telefone", c.telefone],
    ["Nascimento", c.nascimento],
    ["CPF", c.cpf],
    ["Profissão", c.profissao],
    ["Email", c.email],
    ["Endereço", [c.endereco_rua, c.endereco_bairro, c.endereco_cidade, c.endereco_estado, c.endereco_cep].filter(Boolean).join(", ") || null],
    ["Camiseta", c.tamanho_camiseta],
    ["Colete", [c.colete_tipo, c.tamanho_colete].filter(Boolean).join(" - ") || null],
    ["Comando resp.", c.comando_responsavel],
    ["DR resp.", c.diretor_regional_responsavel],
    ["Recebido de", [c.expansao_nome, c.expansao_telefone].filter(Boolean).join(" - ") || null],
    ["Data recebimento", c.data_recebimento],
    ["Data contato", c.contato_em],
    ["Observação", c.baixa_observacao],
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs mt-2 bg-muted/40 p-2 rounded">
      {rows.map(([k, v]) => (
        <div key={k}><span className="font-medium">{k}:</span> {v || "—"}</div>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: ExpansaoStatus }) {
  const m = STATUS_META[status];
  return <Badge variant="outline" className="text-[10px]">{m.label}</Badge>;
}

function useExpansaoCtx() {
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const regionalId = profile?.regional_id || null;
  const data = useExpansaoCandidatos(regionalId);
  return { user, profile, regionalId, ...data };
}

/* ---------- Enviar ficha ao DD (com WhatsApp) ---------- */
function EnviarFichaDD({ c, divisaoId, divisaoNome, profile, userId, update }: {
  c: ExpansaoCandidato; divisaoId: string | null; divisaoNome: string;
  profile: any; userId: string | null; update: any;
}) {
  const { data: dd } = useDiretorDivisao(divisaoId);
  const { data: templates } = useWhatsAppTemplates();
  const tpl = (templates || []).find((t: any) => t.chave === "expansao_envio_dd");

  const marcarEnviado = async () => {
    await update.mutateAsync({
      id: c.id, divisao_id: divisaoId, status: "enviado",
      enviado_em: new Date().toISOString(), enviado_por: userId,
      enviado_para_nome: dd?.nome || null,
      enviado_para_telefone: dd?.telefone || null,
    });
    notify("Ficha enviada ao Diretor de Divisão.");
  };

  if (!divisaoId) {
    return (
      <Button disabled className="gap-2 w-full">
        <Send className="h-4 w-4" />Selecione a divisão
      </Button>
    );
  }

  const payload = {
    diretor_divisao: dd?.nome || "Diretor",
    candidato_nome: c.nome_completo || "",
    candidato_colete: c.nome_colete || "",
    candidato_telefone: c.telefone || "",
    divisao: divisaoNome,
    regional: profile?.regional || "",
    diretor_regional: profile?.nome_colete || "",
  };
  const corpo = tpl
    ? renderTemplate(tpl.corpo, payload)
    : `Caro Diretor ${dd?.nome || ""}, você recebeu uma nova ficha de candidato: ${c.nome_colete || c.nome_completo}.`;

  if (!dd?.telefone) {
    return (
      <div className="flex flex-col gap-1">
        <p className="text-[11px] text-muted-foreground">
          Diretor de Divisão sem telefone cadastrado — registre o envio e avise manualmente.
        </p>
        <Button onClick={marcarEnviado} className="gap-2 w-full">
          <Send className="h-4 w-4" />Marcar como enviada ao DD
        </Button>
      </div>
    );
  }

  return (
    <BotaoEnviarWhatsApp
      telefone={dd.telefone}
      destinatarioNome={dd.nome || "Diretor de Divisão"}
      mensagem={corpo}
      templateChave="expansao_envio_dd"
      templateTitulo={tpl?.titulo}
      moduloOrigem="expansao"
      divisaoId={divisaoId}
      label="Enviar ao DD (WhatsApp)"
      payload={payload}
      fullWidth
      onClickExtra={marcarEnviado}
    />
  );
}

/* ---------- Candidatos ---------- */

export function CandidatosList() {
  const { user, profile, regionalId, data, isLoading, update } = useExpansaoCtx() as any;
  const { divisoes } = useDivisoesPorRegional(regionalId);
  const [divSel, setDivSel] = useState<Record<string, string>>({});

  const candidatos: ExpansaoCandidato[] = (data || []).filter((c: ExpansaoCandidato) =>
    ["pendente", "enviado"].includes(c.status));

  const baixa = async (c: ExpansaoCandidato, status: ExpansaoStatus, payload: BaixaPayload) => {
    await update.mutateAsync({
      id: c.id, status,
      baixa_em: new Date().toISOString(), baixa_por: user?.id || null,
      contato_em: payload.contato_em, baixa_observacao: payload.observacao,
    });
    notify("Status atualizado.");
  };

  if (isLoading) return <p className="text-sm text-muted-foreground p-4">Carregando...</p>;
  if (candidatos.length === 0) return <p className="text-sm text-muted-foreground p-4">Nenhum candidato em aberto.</p>;

  return (
    <div className="space-y-3">
      {candidatos.map((c) => (
        <Card key={c.id} className={toneClass[STATUS_META[c.status].tone]}>
          <CardContent className="p-3">
            <Collapsible>
              <div className="flex items-center justify-between gap-2">
                <CollapsibleTrigger className="flex items-center gap-2 text-left flex-1">
                  <ChevronDown className="h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-semibold text-sm">{c.nome_colete || c.nome_completo}</p>
                    <StatusBadge status={c.status} />
                  </div>
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent><FichaDetalhe c={c} /></CollapsibleContent>
            </Collapsible>

            {c.status === "pendente" && (
              <div className="flex flex-col gap-2 mt-3">
                <Select value={divSel[c.id] || c.divisao_id || ""} onValueChange={(v) => setDivSel((p) => ({ ...p, [c.id]: v }))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Selecionar divisão" /></SelectTrigger>
                  <SelectContent>
                    {divisoes.map((d) => <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
                <EnviarFichaDD
                  c={c}
                  divisaoId={divSel[c.id] || c.divisao_id || null}
                  divisaoNome={divisoes.find((d) => d.id === (divSel[c.id] || c.divisao_id))?.nome || ""}
                  profile={profile}
                  userId={user?.id || null}
                  update={update}
                />
              </div>
            )}

            <div className="flex flex-wrap gap-2 mt-2">
              {(["efetivado", "desistente", "cancelado"] as ExpansaoStatus[]).map((s) => (
                <BaixaDialog
                  key={s}
                  candidatoNome={c.nome_colete || c.nome_completo || ""}
                  statusLabel={STATUS_META[s].label}
                  triggerLabel={STATUS_META[s].label}
                  requireContato={s !== "cancelado"}
                  onConfirm={(payload) => baixa(c, s, payload)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ---------- Report WhatsApp (reutilizável) ---------- */
function ReportarBotao({ c, statusReportado, templateChave, label }: {
  c: ExpansaoCandidato; statusReportado: ExpansaoStatus; templateChave: string; label: string;
}) {
  const { user, profile, update } = useExpansaoCtx() as any;
  const { data: templates } = useWhatsAppTemplates();
  const tpl = (templates || []).find((t: any) => t.chave === templateChave);

  const payload = {
    candidato_nome: c.nome_completo || "",
    candidato_colete: c.nome_colete || "",
    candidato_telefone: c.telefone || "",
    regional: profile?.regional || "",
    divisao: c.divisoes?.nome || "",
    diretor_regional: profile?.nome_colete || "",
    status: STATUS_META[c.status].label,
  };
  const corpo = tpl
    ? renderTemplate(tpl.corpo, payload)
    : `Olá ${c.expansao_nome || ""}, o candidato ${c.nome_colete} (${c.nome_completo}) está com status: ${STATUS_META[c.status].label}.`;

  return (
    <BotaoEnviarWhatsApp
      telefone={c.expansao_telefone}
      destinatarioNome={c.expansao_nome || "Expansão"}
      mensagem={corpo}
      templateChave={templateChave}
      templateTitulo={tpl?.titulo}
      moduloOrigem="expansao"
      label={label}
      size="sm"
      payload={payload}
      onClickExtra={async () => {
        await update.mutateAsync({ id: c.id, status: statusReportado, reportado_em: new Date().toISOString(), reportado_por: user?.id || null });
      }}
    />
  );
}

/* ---------- Efetivados ---------- */
export function EfetivadosList() {
  const { data, isLoading } = useExpansaoCtx() as any;
  const lista: ExpansaoCandidato[] = (data || []).filter((c: ExpansaoCandidato) =>
    ["efetivado", "efetivado_reportado"].includes(c.status));
  if (isLoading) return <p className="text-sm text-muted-foreground p-4">Carregando...</p>;
  if (lista.length === 0) return <p className="text-sm text-muted-foreground p-4">Nenhum efetivado.</p>;
  return (
    <div className="space-y-3">
      {lista.map((c) => (
        <Card key={c.id} className={toneClass[STATUS_META[c.status].tone]}>
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-sm">{c.nome_colete || c.nome_completo}</p>
              <StatusBadge status={c.status} />
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <IdCard className="h-3 w-3" />{c.divisoes?.nome || "—"}
            </p>
            <FichaDetalhe c={c} />
            {(c.status === "efetivado" || c.status === "efetivado_reportado") && (
              <ReportarBotao
                c={c}
                statusReportado="efetivado_reportado"
                templateChave="expansao_efetivado"
                label={c.status === "efetivado_reportado" ? "Reenviar à Expansão" : "Reportar à Expansão"}
              />
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ---------- Histórico ---------- */
export function HistoricoList() {
  const { data, isLoading } = useExpansaoCtx() as any;
  const lista: ExpansaoCandidato[] = data || [];
  if (isLoading) return <p className="text-sm text-muted-foreground p-4">Carregando...</p>;
  if (lista.length === 0) return <p className="text-sm text-muted-foreground p-4">Nenhum registro.</p>;
  return (
    <div className="space-y-3">
      {lista.map((c) => (
        <Card key={c.id} className={toneClass[STATUS_META[c.status].tone]}>
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-sm">{c.nome_colete || c.nome_completo}</p>
              <StatusBadge status={c.status} />
            </div>
            <LinhaDoTempo c={c} />
            <Collapsible>
              <div className="flex items-center justify-between gap-2">
                <CollapsibleTrigger className="flex items-center gap-2 text-left flex-1 text-xs text-muted-foreground">
                  <ChevronDown className="h-4 w-4 shrink-0" />
                  Ver dados completos da ficha
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent><FichaDetalhe c={c} /></CollapsibleContent>
            </Collapsible>
            {c.status === "desistente" && (
              <ReportarBotao c={c} statusReportado="desistente_reportado" templateChave="expansao_desistente" label="Reportar desistência" />
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
