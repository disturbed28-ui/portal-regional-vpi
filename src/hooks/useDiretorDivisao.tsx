import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DiretorDivisao {
  nome: string | null;
  telefone: string | null;
}

/**
 * Busca o Diretor de Divisão (role `diretor_divisao`) vinculado a uma divisão,
 * priorizando quem possui telefone cadastrado. Usado para notificar via WhatsApp.
 */
export const useDiretorDivisao = (divisaoId: string | null | undefined) => {
  return useQuery({
    queryKey: ["diretor-divisao", divisaoId],
    queryFn: async (): Promise<DiretorDivisao | null> => {
      if (!divisaoId) return null;
      const { data, error } = await supabase
        .from("user_roles")
        .select("role, profiles:user_id(nome_colete, telefone, divisao_id)")
        .eq("role", "diretor_divisao");
      if (error) throw error;

      const candidatos = (data ?? [])
        .map((r: any) => r.profiles)
        .filter((p: any) => p && p.divisao_id === divisaoId);

      const comTelefone = candidatos.find((p: any) => p.telefone);
      const escolhido = comTelefone || candidatos[0];
      if (!escolhido) return null;
      return { nome: escolhido.nome_colete ?? null, telefone: escolhido.telefone ?? null };
    },
    enabled: !!divisaoId,
  });
};
