import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// T1: Interface com estatisticas_divisao_json (nome correto)
export interface DadosRelatorioSemanal {
  formulario_id: string;
  profile_id: string;
  integrante_portal_id?: string;
  responsavel_nome_colete: string;
  responsavel_cargo_nome?: string;
  responsavel_divisao_texto: string;
  responsavel_regional_texto: string;
  responsavel_comando_texto: string;
  divisao_relatorio_id?: string;
  divisao_relatorio_texto: string;
  regional_relatorio_id?: string;
  regional_relatorio_texto: string;
  semana_inicio: string; // YYYY-MM-DD
  semana_fim: string; // YYYY-MM-DD
  entradas_json: any[];
  saidas_json: any[];
  inadimplencias_json: any[];
  conflitos_json: any[];
  acoes_sociais_json: any[];
  estatisticas_divisao_json: any; // T1: Nome correto
}

export const useSubmitRelatorioSemanal = () => {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (dados: DadosRelatorioSemanal) => {
      const { data, error } = await supabase
        .from('relatorios_semanais_divisao')
        .insert([dados])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ 
        title: "Relatório enviado com sucesso!",
        description: "Obrigado por preencher o relatório semanal."
      });
    },
    onError: (error) => {
      toast({ 
        title: "Erro ao enviar relatório", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });
};
