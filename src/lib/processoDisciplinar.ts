/**
 * PD – Processo Disciplinar: regras puras (numeração, status, permissões de ação, mensagens).
 */

export type PdStatus =
  | "rascunho"
  | "emitido"
  | "em_analise"
  | "versao_regional"
  | "aguardando_cmd"
  | "concluido"
  | "cancelado";

export const PD_ROTA = "/formularios/processo-disciplinar";
export const PD_ROTA_REGIONAL = "/formularios/processo-disciplinar/regional";

export const STATUS_LABEL: Record<PdStatus, string> = {
  rascunho: "Rascunho",
  emitido: "Emitido / Enviado ao Diretor Regional",
  em_analise: "Em análise Regional",
  versao_regional: "Versão Regional em elaboração",
  aguardando_cmd: "Aguardando devolutiva do CMD Regional",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export const STATUS_EM_ANDAMENTO: PdStatus[] = ["emitido", "em_analise", "versao_regional", "aguardando_cmd"];
export const STATUS_HISTORICO: PdStatus[] = ["concluido", "cancelado"];

export interface Envolvido {
  integrante_id: string | null;
  id_clube: number | string | null;
  nome_colete: string;
}

/** "PD 001/2026" — contador anual, 3 dígitos. Sem número = rascunho. */
export function formatarNumeroPD(numero: number | null | undefined, ano: number | null | undefined): string {
  if (!numero || !ano) return "Rascunho";
  return `PD ${String(numero).padStart(3, "0")}/${ano}`;
}

/** Rascunho: só o autor descarta. Emitido e não encerrado: só quem trata (Regional/Comando) cancela. */
export function podeCancelar(status: PdStatus, podeTratar: boolean): boolean {
  if (status === "rascunho" || status === "concluido" || status === "cancelado") return false;
  return podeTratar;
}

export function podeDescartarRascunho(status: PdStatus, ehAutor: boolean): boolean {
  return status === "rascunho" && ehAutor;
}

export function formatarDataBR(iso: string | null | undefined): string {
  if (!iso) return "-";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

export function formatarDataHoraBR(ts: string | null | undefined): string {
  if (!ts) return "-";
  return new Date(ts).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
}

interface ConteudoPD {
  titulo: string;
  envolvidos: Envolvido[];
  local: string;
  data_ocorrencia: string;
  hora_ocorrencia: string | null;
  descricao: string;
  houve_conciliacao: boolean;
  conciliacao_descricao: string | null;
}

function blocoConteudo(c: ConteudoPD): string {
  const env = c.envolvidos.map((e) => `• ${e.nome_colete}${e.id_clube ? ` (ID ${e.id_clube})` : ""}`).join("\n");
  return [
    `*Ocorrência:* ${c.titulo}`,
    `*Envolvidos:*\n${env || "-"}`,
    `*Local:* ${c.local}`,
    `*Data/Hora:* ${formatarDataBR(c.data_ocorrencia)}${c.hora_ocorrencia ? ` às ${c.hora_ocorrencia}` : ""}`,
    `*Descrição:*\n${c.descricao}`,
    `*Tentativa de conciliação:* ${c.houve_conciliacao ? "Sim" : "Não"}${
      c.houve_conciliacao && c.conciliacao_descricao ? `\n${c.conciliacao_descricao}` : ""
    }`,
  ].join("\n\n");
}

export function mensagemEmissao(numero: string, autor: string, divisao: string, c: ConteudoPD): string {
  return `⚖️ *${numero} – PROCESSO DISCIPLINAR*\n_Emitido por ${autor} – ${divisao}_\n\n${blocoConteudo(c)}`;
}

export function assinaturaRegional(nome: string | null | undefined): string {
  return nome?.trim() ? `Responsável pela versão Regional: ${nome.trim()}` : "";
}

export function parecerAssinado(parecer: string | null, nome: string | null | undefined): string {
  return [parecer?.trim(), assinaturaRegional(nome)].filter(Boolean).join("\n\n");
}

export function mensagemEncaminhamento(numero: string, divisao: string, c: ConteudoPD, parecer: string | null, responsavel?: string | null): string {
  const textoParecer = parecerAssinado(parecer, responsavel);
  return `⚖️ *${numero} – VERSÃO REGIONAL*\n_Divisão de origem: ${divisao}_\n\n${blocoConteudo(c)}${
    textoParecer ? `\n\n*Parecer Regional:*\n${textoParecer}` : ""
  }`;
}

export function mensagemConclusao(numero: string, titulo: string, decisao: string, acao: string, obs: string | null): string {
  return `✅ *${numero} – CONCLUÍDO*\n*Ocorrência:* ${titulo}\n\n*Decisão do CMD Regional:*\n${decisao}\n\n*Ação a ser tomada:*\n${acao}${
    obs ? `\n\n*Observações:*\n${obs}` : ""
  }\n\nO fluxo completo está disponível no portal, em Formulários › PD.`;
}
