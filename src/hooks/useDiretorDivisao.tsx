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
 * O telefone é resolvido em `profiles` via `profile_id` (não há FK para embedding).
 */
export const useDiretorDivisao = (divisaoId: string | null | undefined) => {
  return useQuery({
    queryKey: ["diretor-divisao", divisaoId],
    queryFn: async (): Promise<DiretorDivisao | null> => {
      if (!divisaoId) return null;

      const { data, error } = await supabase
        .from("integrantes_portal")
        .select("nome_colete, cargo_grau_texto, profile_id")
        .eq("divisao_id", divisaoId)
        .eq("ativo", true)
        .ilike("cargo_grau_texto", "%diretor%divis%");
      if (error) throw error;

      // Excluir Sub Diretor — só o diretor titular recebe a ficha
      const titulares = (data ?? []).filter((r: any) => {
        const cargo = String(r.cargo_grau_texto || "").toLowerCase();
        return !cargo.includes("sub");
      });

      if (titulares.length === 0) return null;

      // Resolver telefones via profiles
      const profileIds = titulares
        .map((r: any) => r.profile_id)
        .filter((id: string | null): id is string => !!id);

      const telefones = new Map<string, string | null>();
      if (profileIds.length > 0) {
        const { data: perfis } = await supabase
          .from("profiles")
          .select("id, telefone")
          .in("id", profileIds);
        (perfis ?? []).forEach((p: any) => telefones.set(p.id, p.telefone ?? null));
      }

      const comTelefone = titulares.find(
        (r: any) => r.profile_id && telefones.get(r.profile_id),
      );
      const escolhido = comTelefone || titulares[0];

      return {
        nome: escolhido.nome_colete ?? null,
        telefone: escolhido.profile_id ? telefones.get(escolhido.profile_id) ?? null : null,
      };
    },
    enabled: !!divisaoId,
  });
};
