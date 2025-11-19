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

export interface SubmitRelatorioParams {
  dados: DadosRelatorioSemanal;
  existingReportId?: string | null;
  limiteRespostas?: 'unica' | 'multipla';
}

export const useSubmitRelatorioSemanal = () => {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: SubmitRelatorioParams) => {
      const { dados, existingReportId, limiteRespostas } = params;

      // CASO 1: Não existe relatório → INSERT
      if (!existingReportId) {
        const { data, error } = await supabase
          .from('relatorios_semanais_divisao')
          .insert([dados])
          .select()
          .single();
        
        if (error) throw error;
        return data;
      }

      // CASO 2: Existe relatório com limite 'unica' → ERRO
      if (limiteRespostas === 'unica') {
        throw new Error('Você já respondeu este formulário nesta semana. Apenas uma resposta é permitida.');
      }

      // CASO 3: Existe relatório com limite 'multipla' → UPDATE
      const { data, error } = await supabase
        .from('relatorios_semanais_divisao')
        .update(dados)
        .eq('id', existingReportId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      const isUpdate = !!variables.existingReportId;
      toast({ 
        title: isUpdate ? "Relatório atualizado com sucesso!" : "Relatório enviado com sucesso!",
        description: isUpdate ? "Suas alterações foram salvas." : "Obrigado por preencher o relatório semanal."
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
