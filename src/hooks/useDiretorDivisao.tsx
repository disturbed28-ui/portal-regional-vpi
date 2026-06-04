import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DiretorDivisao {
  nome: string | null;
  telefone: string | null;
}

/**
 * Busca o Diretor de Divisão TITULAR vinculado a uma divisão (exclui Sub Diretor),
 * priorizando quem possui telefone cadastrado. Usado para notificar via WhatsApp.
 *
 * A identificação usa o cargo real em `integrantes_portal.cargo_grau_texto`
 * (ex.: "Diretor Divisão (Grau VI)") e descarta qualquer cargo que contenha "Sub".
 */
export const useDiretorDivisao = (divisaoId: string | null | undefined) => {
  return useQuery({
    queryKey: ["diretor-divisao", divisaoId],
    queryFn: async (): Promise<DiretorDivisao | null> => {
      if (!divisaoId) return null;
      const { data, error } = await supabase
        .from("integrantes_portal")
        .select("nome_colete, cargo_grau_texto, profile_id, profiles:profile_id(telefone)")
        .eq("divisao_id", divisaoId)
        .eq("ativo", true)
        .ilike("cargo_grau_texto", "%diretor%divis%");
      if (error) throw error;

      // Excluir Sub Diretor — só o diretor titular recebe a ficha
      const titulares = (data ?? []).filter((r: any) => {
        const cargo = String(r.cargo_grau_texto || "").toLowerCase();
        return !cargo.includes("sub");
      });

      const getTelefone = (r: any): string | null =>
        (r?.profiles?.telefone as string) ?? null;

      const comTelefone = titulares.find((r: any) => getTelefone(r));
      const escolhido = comTelefone || titulares[0];
      if (!escolhido) return null;

      return {
        nome: escolhido.nome_colete ?? null,
        telefone: getTelefone(escolhido),
      };
    },
    enabled: !!divisaoId,
  });
};
