import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import type { TreinamentoHistorico } from "@/hooks/useHistoricoTreinamento";
import type { EstagioHistorico } from "@/hooks/useHistoricoEstagio";

function dataExcel(valor?: string) {
  if (!valor) return "";
  const data = new Date(valor.includes("T") ? valor : `${valor}T12:00:00`);
  return Number.isNaN(data.getTime()) ? valor : data.toLocaleDateString("pt-BR");
}

export function linhasHistoricoFormacao(registros: (TreinamentoHistorico | EstagioHistorico)[], grausAtuais: Record<string, string | null> = {}) {
  return registros.map((r) => ({
    "Nome de colete": r.integrante_nome_colete,
    "Divisão": r.divisao_nome,
    "Grau atual": grausAtuais[r.integrante_id] || "",
    "Cargo": "cargo_estagio_nome" in r ? r.cargo_estagio_nome : r.cargo_treinamento_nome,
    "Grau do estágio": "grau_estagio" in r ? r.grau_estagio : "",
    "Status": r.status,
    "Data de início": dataExcel(r.data_inicio),
    "Término previsto": dataExcel(r.data_termino_previsto),
    "Data de encerramento": dataExcel(r.data_encerramento),
    "Tipo de encerramento": r.tipo_encerramento || "",
    "Solicitante": r.solicitante_nome_colete,
    "Observações": r.observacoes || "",
  }));
}

async function buscarGrausAtuais(ids: string[]) {
  const unicos = [...new Set(ids.filter(Boolean))];
  const graus: Record<string, string | null> = {};
  for (let i = 0; i < unicos.length; i += 200) {
    const { data, error } = await supabase.from("integrantes_portal").select("id, grau").in("id", unicos.slice(i, i + 200));
    if (error) throw error;
    for (const row of data || []) graus[row.id] = row.grau;
  }
  return graus;
}

export async function exportarHistoricoFormacao(registros: (TreinamentoHistorico | EstagioHistorico)[], tipo: "Treinamento" | "Estágio") {
  const graus = await buscarGrausAtuais(registros.map((r) => r.integrante_id));
  const planilha = XLSX.utils.json_to_sheet(linhasHistoricoFormacao(registros, graus));
  planilha["!cols"] = [28, 38, 14, 32, 18, 20, 18, 18, 22, 28, 28, 60].map((wch) => ({ wch }));
  const livro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(livro, planilha, "Histórico");
  const bytes = XLSX.write(livro, { bookType: "xlsx", type: "array" });
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `historico-${tipo === "Estágio" ? "estagio" : "treinamento"}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}