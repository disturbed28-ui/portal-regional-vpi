/**
 * Protocolo de Viagem — regras de destinatário e montagem da mensagem WhatsApp.
 */
import { supabase } from "@/integrations/supabase/client";

export type TipoDestinatario =
  | "sub_diretor"
  | "diretor_divisao"
  | "operacional_regional"
  | "diretor_regional";

export const LABEL_DESTINATARIO: Record<TipoDestinatario, string> = {
  sub_diretor: "Subdiretor",
  diretor_divisao: "Diretor de Divisão",
  operacional_regional: "Operacional Regional",
  diretor_regional: "Diretor Regional",
};

/**
 * Ordem de tentativa de destinatários conforme o cargo/grau de quem viaja.
 * - Grau V (Regional): Operacional Regional → Diretor Regional
 * - Operacional Regional: Diretor Regional
 * - Integrante de divisão (inclui Diretor e Subdiretor): Subdiretor → Diretor de Divisão
 * - Integrante da Regional sem grau detectado: Operacional Regional → Diretor Regional
 */
export function ordemDestinatarios(
  cargo: string | null | undefined,
  temDivisao: boolean,
  grau?: string | null,
): TipoDestinatario[] {
  const c = (cargo || "").toLowerCase();
  if (c.includes("operacional") && c.includes("regional")) return ["diretor_regional"];
  // Grau V é sempre nível regional, independente de ter divisão vinculada
  if (grau && romanToNumber(grau) === 5) return ["operacional_regional", "diretor_regional"];
  if (!temDivisao) return ["operacional_regional", "diretor_regional"];
  if (c.includes("sub") && c.includes("diretor")) return ["diretor_divisao", "operacional_regional"];
  return ["sub_diretor", "diretor_divisao"];
}

function casaTipo(cargo: string, tipo: TipoDestinatario): boolean {
  const c = cargo.toLowerCase();
  switch (tipo) {
    case "sub_diretor":
      return c.includes("sub") && c.includes("diretor") && c.includes("divis");
    case "diretor_divisao":
      return c.includes("diretor") && c.includes("divis") && !c.includes("sub");
    case "operacional_regional":
      return c.includes("operacional") && c.includes("regional") && !c.includes("cmd");
    case "diretor_regional":
      return c.includes("diretor") && c.includes("regional") && !c.includes("sub");
  }
}

export interface Destinatario {
  tipo: TipoDestinatario;
  nome: string;
  telefone: string | null;
  profileId: string | null;
  fallback: boolean;
  tipoPreferido: TipoDestinatario;
}

export async function resolverDestinatario(params: {
  cargo: string | null;
  divisaoId: string | null;
  regionalId: string | null;
  integranteId: string | null;
  grau?: string | null;
}): Promise<Destinatario | null> {
  const ordem = ordemDestinatarios(params.cargo, !!params.divisaoId, params.grau);

  for (let i = 0; i < ordem.length; i++) {
    const tipo = ordem[i];
    const nivelDivisao = tipo === "sub_diretor" || tipo === "diretor_divisao";
    let q = supabase
      .from("integrantes_portal")
      .select("id, nome_colete, cargo_grau_texto, profile_id")
      .eq("ativo", true);
    if (nivelDivisao) {
      if (!params.divisaoId) continue;
      q = q.eq("divisao_id", params.divisaoId);
    } else {
      if (!params.regionalId) continue;
      q = q.eq("regional_id", params.regionalId).ilike("cargo_grau_texto", "%regional%");
    }
    const { data } = await q;
    const candidatos = (data ?? []).filter(
      (r) => r.id !== params.integranteId && casaTipo(String(r.cargo_grau_texto || ""), tipo),
    );
    if (candidatos.length === 0) continue;

    const ids = candidatos.map((c) => c.profile_id).filter((x): x is string => !!x);
    const tel = new Map<string, string | null>();
    if (ids.length) {
      const { data: perfis } = await supabase.from("profiles").select("id, telefone").in("id", ids);
      (perfis ?? []).forEach((p) => tel.set(p.id, p.telefone ?? null));
    }
    const comTel = candidatos.find((c) => c.profile_id && tel.get(c.profile_id));
    if (!comTel) continue; // sem telefone, tenta o próximo nível
    return {
      tipo,
      nome: comTel.nome_colete,
      telefone: tel.get(comTel.profile_id!) ?? null,
      profileId: comTel.profile_id,
      fallback: i > 0,
      tipoPreferido: ordem[0],
    };
  }
  return null;
}

export type MeioTransporte = "moto" | "carro" | "outros";

export interface DadosProtocolo {
  nome_colete: string;
  grau_texto: string;
  divisao_texto: string;
  regional_texto: string;
  cidade_origem: string;
  cidade_destino: string;
  paradas: string[];
  data_saida: string; // yyyy-mm-dd
  hora_saida: string;
  data_retorno: string;
  hora_retorno: string;
  meio_transporte: MeioTransporte;
  meio_transporte_outro?: string | null;
  acompanhado: boolean;
  com_cores: boolean;
  telefone: string;
}

export function formatarDataBR(d: string): string {
  const [a, m, dia] = (d || "").slice(0, 10).split("-");
  return a && m && dia ? `${dia}/${m}/${a}` : "-";
}

export function formatarTelefoneBR(t: string): string {
  let d = (t || "").replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return t;
}

const ORDINAL = (n: number) => `${n}ª`;

export function montarMensagemProtocolo(p: DadosProtocolo): string {
  const paradas = p.paradas.map((s) => s.trim()).filter(Boolean);
  const linhasParadas =
    paradas.length === 0
      ? ["*1ª parada:* ❌"]
      : paradas.map((s, i) => `*${ORDINAL(i + 1)} parada:* ${s}`);
  const x = (v: MeioTransporte) => (p.meio_transporte === v ? "(x)" : "( )");
  const outros =
    p.meio_transporte === "outros" && p.meio_transporte_outro?.trim()
      ? ` — ${p.meio_transporte_outro.trim()}`
      : "";

  return [
    "🏍️ *PROTOCOLO DE VIAGEM*",
    "",
    `*Nome de Colete:* ${p.nome_colete}`,
    `*Grau:* ${p.grau_texto || "-"}`,
    `*Divisão:* ${p.divisao_texto || "-"}`,
    `*Regional:* ${p.regional_texto || "-"}`,
    "",
    "📍 *ROTA*",
    `*Origem:* ${p.cidade_origem}`,
    `*Destino:* ${p.cidade_destino}`,
    ...linhasParadas,
    "",
    "📅 *VIAGEM*",
    `*Saída:* ${formatarDataBR(p.data_saida)} às ${p.hora_saida}h`,
    `*Retorno previsto:* ${formatarDataBR(p.data_retorno)} às ${p.hora_retorno}h`,
    "",
    "🚗 *DESLOCAMENTO*",
    `${x("moto")} Moto`,
    `${x("carro")} Carro`,
    `${x("outros")} Outros${outros}`,
    `*Acompanhado:* ${p.acompanhado ? "Sim" : "Não"}`,
    `*Com as Cores:* ${p.com_cores ? "Sim" : "Não"}`,
    "",
    `📞 *Contato:* ${formatarTelefoneBR(p.telefone)}`,
  ].join("\n");
}
