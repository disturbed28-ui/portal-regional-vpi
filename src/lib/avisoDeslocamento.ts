export type TipoAviso = "protocolo_viagem" | "dentro_regional" | "entre_regionais";
export type Acompanhante = "nenhum" | "esposa" | "filho" | "esposa_filho";
export const TIPOS_AVISO: Record<TipoAviso, string> = {
  dentro_regional: "Deslocamento dentro da regional",
  entre_regionais: "Deslocamento entre regionais",
  protocolo_viagem: "Protocolo de viagem",
};
export const ACOMPANHANTES: Record<Acompanhante, string> = {
  nenhum: "Sem acompanhante", esposa: "🐆 Esposa", filho: "👶 Filho(a)", esposa_filho: "🐆 👶 Esposa e filho(a)",
};
export interface AvisoSimplificado {
  tipo_aviso: "dentro_regional" | "entre_regionais";
  nome_colete: string; divisao_texto: string;
  cidade_origem: string; cidade_destino: string;
  meio_transporte: "moto" | "carro" | "outros";
  meio_transporte_outro?: string | null;
  acompanhante_tipo: Acompanhante | null;
  contato_regional: boolean | null;
  observacoes?: string | null;
}
export function validarAviso(p: AvisoSimplificado): string[] {
  const erros: string[] = [];
  if (!p.nome_colete.trim()) erros.push("Nome de colete");
  if (!p.cidade_origem.trim()) erros.push("Origem");
  if (!p.cidade_destino.trim()) erros.push("Destino");
  if (p.meio_transporte === "outros" && !p.meio_transporte_outro?.trim()) erros.push("Meio de transporte");
  if (p.tipo_aviso === "entre_regionais") {
    if (p.acompanhante_tipo === null) erros.push("Acompanhante");
    if (p.contato_regional === null) erros.push("Necessário contato regional");
  }
  return erros;
}
export function montarMensagemAviso(p: AvisoSimplificado): string {
  const veiculo = p.meio_transporte === "moto" ? "🛵 Moto" : p.meio_transporte === "carro" ? "🚗 Carro" : p.meio_transporte_outro?.trim() || "Outros";
  return [
    `*AVISO DE DESLOCAMENTO — ${p.tipo_aviso === "dentro_regional" ? "DENTRO DA REGIONAL" : "ENTRE REGIONAIS"}*`, "",
    `*Integrante:* ${p.nome_colete}`, `*Divisão:* ${p.divisao_texto || "-"}`, `*Veículo:* ${veiculo}`,
    ...(p.tipo_aviso === "entre_regionais" ? [`*Acompanhante:* ${ACOMPANHANTES[p.acompanhante_tipo ?? "nenhum"]}`] : []), "",
    `*Origem:* ${p.cidade_origem.trim()}`, `*Destino:* ${p.cidade_destino.trim()}`,
    ...(p.tipo_aviso === "entre_regionais" ? ["", `*Necessário contato regional:* ${p.contato_regional ? "✅ Sim" : "❌ Não"}`] : []),
    ...(p.observacoes?.trim() ? ["", `*Observações:* ${p.observacoes.trim()}`] : []),
  ].join("\n");
}
export function intervaloHistorico(de: string, ate: string) {
  const inicio = de ? new Date(de) : null;
  const fim = ate ? new Date(ate) : null;
  inicio?.setUTCHours(3, 0, 0, 0);
  fim?.setUTCHours(26, 59, 59, 999);
  return {
    inicio: inicio?.toISOString() ?? null,
    fim: fim?.toISOString() ?? null,
  };
}