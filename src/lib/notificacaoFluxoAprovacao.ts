/**
 * Resolve o destinatário da próxima notificação WhatsApp no fluxo de aprovações
 * de Treinamento e Estágio.
 *
 * Regra:
 * - Se ainda existe aprovação pendente -> notifica o aprovador dessa etapa.
 * - Se todas as etapas foram aprovadas -> notifica o Diretor de Divisão do
 *   integrante com o aviso de conclusão.
 */
import { supabase } from "@/integrations/supabase/client";

export type TipoFluxo = "treinamento" | "estagio";

export interface NotificacaoFluxo {
  concluido: boolean;
  templateChave: string;
  destinatarioNome: string;
  destinatarioTelefone: string | null;
  destinatarioProfileId: string | null;
  destinatarioCargo: string | null;
  payload: Record<string, unknown>;
  divisaoId: string | null;
  regionalId: string | null;
  moduloOrigem: string;
}

function formatarData(data: string | null | undefined): string {
  if (!data) return "-";
  const [ano, mes, dia] = data.slice(0, 10).split("-");
  if (!ano || !mes || !dia) return "-";
  return `${dia}/${mes}/${ano}`;
}

const LABEL_TIPO_APROVADOR: Record<string, string> = {
  diretor_divisao: "Diretor de Divisão",
  responsavel_regional: "Responsável Regional",
  diretor_regional: "Diretor Regional",
};

async function buscarContatoIntegrante(integranteId: string | null) {
  if (!integranteId) return { nome: null as string | null, telefone: null as string | null, profileId: null as string | null };

  const { data } = await supabase
    .from("integrantes_portal")
    .select("nome_colete, profile_id")
    .eq("id", integranteId)
    .maybeSingle();

  let telefone: string | null = null;
  if (data?.profile_id) {
    const { data: perfil } = await supabase
      .from("profiles")
      .select("telefone")
      .eq("id", data.profile_id)
      .maybeSingle();
    telefone = perfil?.telefone ?? null;
  }

  return {
    nome: data?.nome_colete ?? null,
    telefone,
    profileId: data?.profile_id ?? null,
  };
}

async function buscarDiretorDivisao(divisaoId: string | null) {
  if (!divisaoId) return { nome: null as string | null, telefone: null as string | null, profileId: null as string | null };

  const { data } = await supabase
    .from("integrantes_portal")
    .select("nome_colete, cargo_grau_texto, profile_id")
    .eq("divisao_id", divisaoId)
    .eq("ativo", true)
    .ilike("cargo_grau_texto", "%diretor%divis%");

  const titulares = (data ?? []).filter(
    (r) => !String(r.cargo_grau_texto || "").toLowerCase().includes("sub"),
  );
  if (titulares.length === 0) return { nome: null, telefone: null, profileId: null };

  const profileIds = titulares
    .map((r) => r.profile_id)
    .filter((id): id is string => !!id);

  const telefones = new Map<string, string | null>();
  if (profileIds.length > 0) {
    const { data: perfis } = await supabase
      .from("profiles")
      .select("id, telefone")
      .in("id", profileIds);
    (perfis ?? []).forEach((p) => telefones.set(p.id, p.telefone ?? null));
  }

  const escolhido =
    titulares.find((r) => r.profile_id && telefones.get(r.profile_id)) || titulares[0];

  return {
    nome: escolhido.nome_colete ?? null,
    telefone: escolhido.profile_id ? telefones.get(escolhido.profile_id) ?? null : null,
    profileId: escolhido.profile_id ?? null,
  };
}

export async function resolverNotificacaoFluxo(
  tipo: TipoFluxo,
  solicitacaoId: string,
  remetenteNome?: string | null,
): Promise<NotificacaoFluxo | null> {
  const isTreinamento = tipo === "treinamento";
  const tabelaSol = isTreinamento ? "solicitacoes_treinamento" : "solicitacoes_estagio";
  const tabelaApr = isTreinamento ? "aprovacoes_treinamento" : "aprovacoes_estagio";
  const cargoFk = isTreinamento
    ? "cargo_treinamento:cargos!solicitacoes_treinamento_cargo_treinamento_id_fkey(nome)"
    : "cargo_estagio:cargos!solicitacoes_estagio_cargo_estagio_id_fkey(nome)";
  const integranteFk = isTreinamento
    ? "integrante:integrantes_portal!solicitacoes_treinamento_integrante_id_fkey(nome_colete, divisao_texto, divisao_id, regional_id, cargo_grau_texto)"
    : "integrante:integrantes_portal!solicitacoes_estagio_integrante_id_fkey(nome_colete, divisao_texto, divisao_id, regional_id, cargo_grau_texto)";
  const campoInicio = isTreinamento ? "data_inicio_treinamento" : "data_inicio_estagio";
  const divisaoDestinoFk = isTreinamento
    ? ""
    : ", divisao_estagio:divisoes!solicitacoes_estagio_divisao_id_fkey(nome)";

  const { data: sol, error } = await supabase
    .from(tabelaSol as "solicitacoes_treinamento")
    .select(
      `id, integrante_id, solicitante_nome_colete, data_termino_previsto, ${campoInicio}${isTreinamento ? "" : ", grau_estagio"}, ${integranteFk}, ${cargoFk}${divisaoDestinoFk}`,
    )
    .eq("id", solicitacaoId)
    .maybeSingle();

  if (error || !sol) {
    console.error("[notificacaoFluxo] solicitação não encontrada", error);
    return null;
  }

  const s = sol as Record<string, any>;
  const integrante = s.integrante as
    | {
        nome_colete: string;
        divisao_texto: string;
        divisao_id: string | null;
        regional_id: string | null;
        cargo_grau_texto: string;
      }
    | null;
  const cargoDestino = (isTreinamento ? s.cargo_treinamento : s.cargo_estagio) as
    | { nome: string }
    | null;

  const { data: aprovacoes } = await supabase
    .from(tabelaApr as "aprovacoes_treinamento")
    .select("id, nivel, tipo_aprovador, status, aprovador_integrante_id, aprovador_nome_colete, aprovador_cargo")
    .eq("solicitacao_id", solicitacaoId)
    .order("nivel", { ascending: true });

  const lista = aprovacoes ?? [];
  const pendente = lista.find((a) => a.status === "pendente");
  const algumReprovado = lista.some((a) => a.status === "reprovado");
  if (algumReprovado) return null;

  const divisaoOrigem = integrante?.divisao_texto ?? "-";
  const divisaoDestino = (s.divisao_estagio as { nome: string } | null)?.nome ?? null;
  const divisaoTexto =
    !isTreinamento && divisaoDestino && divisaoDestino !== divisaoOrigem
      ? `${divisaoDestino} (integrante da ${divisaoOrigem})`
      : divisaoOrigem;

  const base = {
    integrante: integrante?.nome_colete ?? "-",
    divisao: divisaoTexto,
    cargo_atual: integrante?.cargo_grau_texto ?? "-",
    data_inicio: formatarData(s[campoInicio]),
    data_termino: formatarData(s.data_termino_previsto),
    solicitante: s.solicitante_nome_colete ?? "-",
    remetente: remetenteNome ?? "",
  };
  const cargoKey = isTreinamento ? "cargo_treinamento" : "cargo_estagio";

  if (pendente) {
    const contato = await buscarContatoIntegrante(pendente.aprovador_integrante_id);
    return {
      concluido: false,
      templateChave: isTreinamento
        ? "treinamento_aprovacao_pendente"
        : "estagio_aprovacao_pendente",
      destinatarioNome: contato.nome || pendente.aprovador_nome_colete || "Aprovador",
      destinatarioTelefone: contato.telefone,
      destinatarioProfileId: contato.profileId,
      destinatarioCargo: pendente.aprovador_cargo ?? null,
      payload: {
        ...base,
        [cargoKey]: cargoDestino?.nome ?? "-",
        ...(isTreinamento ? {} : { grau_estagio: s.grau_estagio ?? "-" }),
        aprovador: contato.nome || pendente.aprovador_nome_colete || "",
        etapa: pendente.nivel,
        total_etapas: lista.length,
        tipo_aprovador:
          LABEL_TIPO_APROVADOR[pendente.tipo_aprovador] ?? pendente.tipo_aprovador,
      },
      divisaoId: integrante?.divisao_id ?? null,
      regionalId: integrante?.regional_id ?? null,
      moduloOrigem: isTreinamento ? "gestao_adm_treinamento" : "gestao_adm_estagio",
    };
  }

  // Fluxo concluído -> avisar Diretor de Divisão do integrante
  const diretor = await buscarDiretorDivisao(integrante?.divisao_id ?? null);
  return {
    concluido: true,
    templateChave: isTreinamento ? "treinamento_aprovado_dd" : "estagio_aprovado_dd",
    destinatarioNome: diretor.nome || "Diretor de Divisão",
    destinatarioTelefone: diretor.telefone,
    destinatarioProfileId: diretor.profileId,
    destinatarioCargo: "Diretor de Divisão",
    payload: {
      ...base,
      [cargoKey]: cargoDestino?.nome ?? "-",
      ...(isTreinamento ? {} : { grau_estagio: s.grau_estagio ?? "-" }),
      diretor: diretor.nome || "",
    },
    divisaoId: integrante?.divisao_id ?? null,
    regionalId: integrante?.regional_id ?? null,
    moduloOrigem: isTreinamento ? "gestao_adm_treinamento" : "gestao_adm_estagio",
  };
}
