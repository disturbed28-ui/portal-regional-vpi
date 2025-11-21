import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface DadosAcaoSocial {
  formulario_id: string | null;
  profile_id: string;
  integrante_portal_id: string;
  responsavel_nome_colete: string;
  responsavel_cargo_nome: string | null;
  responsavel_divisao_texto: string;
  responsavel_regional_texto: string;
  responsavel_comando_texto: string;
  regional_relatorio_id: string;
  regional_relatorio_texto: string;
  divisao_relatorio_id: string;
  divisao_relatorio_texto: string;
  data_acao: string; // YYYY-MM-DD
  escopo_acao: 'interna' | 'externa';
  tipo_acao_id: string;
  tipo_acao_nome_snapshot: string;
  descricao_acao: string | null;
}

export const useSubmitAcaoSocial = () => {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (dados: DadosAcaoSocial) => {
      // SEMPRE INSERT (nunca UPDATE)
      const { data, error } = await supabase
        .from('acoes_sociais_registros')
        .insert([dados])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ 
        title: "Ação Social registrada com sucesso!",
        description: "Obrigado por registrar esta ação."
      });
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao registrar ação social", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });
};
