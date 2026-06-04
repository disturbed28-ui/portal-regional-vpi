import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ExpansaoStatus =
  | "pendente"
  | "enviado"
  | "efetivado"
  | "efetivado_reportado"
  | "desistente"
  | "desistente_reportado"
  | "cancelado";

export interface ExpansaoCandidato {
  id: string;
  status: ExpansaoStatus;
  ficha_raw: string | null;
  dados_extraidos: Record<string, unknown> | null;
  anexo_path: string | null;
  nome_completo: string | null;
  nome_colete: string | null;
  telefone: string | null;
  cpf: string | null;
  rg: string | null;
  nascimento: string | null;
  profissao: string | null;
  email: string | null;
  endereco_rua: string | null;
  endereco_bairro: string | null;
  endereco_cidade: string | null;
  endereco_estado: string | null;
  endereco_cep: string | null;
  tamanho_camiseta: string | null;
  colete_tipo: string | null;
  tamanho_colete: string | null;
  forma_pagamento: string | null;
  contato_emergencia: string | null;
  comando_responsavel: string | null;
  diretor_regional_responsavel: string | null;
  expansao_nome: string | null;
  expansao_telefone: string | null;
  data_recebimento: string | null;
  regional_id: string | null;
  divisao_id: string | null;
  cadastrado_por: string | null;
  cadastrado_por_nome: string | null;
  enviado_em: string | null;
  enviado_por: string | null;
  baixa_em: string | null;
  baixa_por: string | null;
  baixa_observacao: string | null;
  contato_em: string | null;
  reportado_em: string | null;
  reportado_por: string | null;
  created_at: string;
  updated_at: string;
  divisoes?: { id: string; nome: string } | null;
}

export type NovoCandidato = Partial<ExpansaoCandidato>;

const db = () => supabase as unknown as {
  from: (t: string) => any;
};

export const useExpansaoCandidatos = (regionalId: string | null | undefined) => {
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["expansao-candidatos", regionalId],
    queryFn: async (): Promise<ExpansaoCandidato[]> => {
      let query = db()
        .from("expansao_candidatos")
        .select("*, divisoes:divisao_id(id, nome)")
        .order("created_at", { ascending: false });
      if (regionalId) query = query.eq("regional_id", regionalId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as ExpansaoCandidato[];
    },
    enabled: !!regionalId,
  });

  const create = useMutation({
    mutationFn: async (c: NovoCandidato) => {
      const { error } = await db().from("expansao_candidatos").insert(c);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Candidato cadastrado", { duration: 6000, dismissible: false });
      qc.invalidateQueries({ queryKey: ["expansao-candidatos"] });
    },
    onError: (e: Error) =>
      toast.error("Erro ao cadastrar: " + e.message, { duration: 6000, dismissible: false }),
  });

  const update = useMutation({
    mutationFn: async (payload: Partial<ExpansaoCandidato> & { id: string }) => {
      const { id, divisoes, ...rest } = payload;
      const { error } = await db().from("expansao_candidatos").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expansao-candidatos"] });
    },
    onError: (e: Error) =>
      toast.error("Erro ao atualizar: " + e.message, { duration: 6000, dismissible: false }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db().from("expansao_candidatos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Candidato removido", { duration: 6000, dismissible: false });
      qc.invalidateQueries({ queryKey: ["expansao-candidatos"] });
    },
    onError: (e: Error) =>
      toast.error("Erro ao remover: " + e.message, { duration: 6000, dismissible: false }),
  });

  return { ...list, create, update, remove };
};

export const STATUS_META: Record<ExpansaoStatus, { label: string; tone: "red" | "green" | "blue" | "gray" }> = {
  pendente: { label: "Pendente de envio", tone: "red" },
  enviado: { label: "Enviado ao DD", tone: "green" },
  efetivado: { label: "Efetivado", tone: "blue" },
  efetivado_reportado: { label: "Efetivado (reportado)", tone: "green" },
  desistente: { label: "Desistente", tone: "red" },
  desistente_reportado: { label: "Desistente (reportado)", tone: "green" },
  cancelado: { label: "Cancelado", tone: "gray" },
};
