import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { IntegrantePortal } from "@/hooks/useIntegrantes";

interface DadosEdicao {
  nome_colete?: string;
  regional_id?: string;
  regional_texto?: string;
  divisao_id?: string;
  divisao_texto?: string;
  cargo_nome?: string;
  cargo_grau_texto?: string;
  grau?: string;
  cargo_estagio?: string;
  data_entrada?: string;
  tem_moto?: boolean;
  tem_carro?: boolean;
  sgt_armas?: boolean;
  caveira?: boolean;
  caveira_suplente?: boolean;
  batedor?: boolean;
  ursinho?: boolean;
  lobo?: boolean;
  combate_insano?: boolean;
}

interface UseGerenciarIntegranteReturn {
  editarIntegrante: (
    integrante: IntegrantePortal,
    dadosNovos: DadosEdicao,
    observacao: string,
    userId: string
  ) => Promise<boolean>;
  inativarIntegrante: (
    integrante: IntegrantePortal,
    motivo: string,
    justificativa: string,
    userId: string
  ) => Promise<boolean>;
  operando: boolean;
}

export const useGerenciarIntegrante = (): UseGerenciarIntegranteReturn => {
  const [operando, setOperando] = useState(false);

  const editarIntegrante = async (
    integrante: IntegrantePortal,
    dadosNovos: DadosEdicao,
    observacao: string,
    userId: string
  ): Promise<boolean> => {
    if (!observacao || observacao.trim().length < 10) {
      toast({
        title: "Observação obrigatória",
        description: "A observação deve ter no mínimo 10 caracteres.",
        variant: "destructive",
      });
      return false;
    }

    setOperando(true);

    try {
      // Snapshot dos dados anteriores
      const dadosAnteriores: Record<string, any> = {
        nome_colete: integrante.nome_colete,
        regional_id: integrante.regional_id,
        regional_texto: integrante.regional_texto,
        divisao_id: integrante.divisao_id,
        divisao_texto: integrante.divisao_texto,
        cargo_nome: integrante.cargo_nome,
        cargo_grau_texto: integrante.cargo_grau_texto,
        grau: integrante.grau,
        cargo_estagio: integrante.cargo_estagio,
        data_entrada: integrante.data_entrada,
        tem_moto: integrante.tem_moto,
        tem_carro: integrante.tem_carro,
        sgt_armas: integrante.sgt_armas,
        caveira: integrante.caveira,
        caveira_suplente: integrante.caveira_suplente,
        batedor: integrante.batedor,
        ursinho: integrante.ursinho,
        lobo: integrante.lobo,
        combate_insano: integrante.combate_insano,
      };

      // Atualizar integrante
      const { error: updateError } = await supabase
        .from('integrantes_portal')
        .update({
          ...dadosNovos,
          updated_at: new Date().toISOString(),
        })
        .eq('id', integrante.id);

      if (updateError) {
        throw updateError;
      }

      // Registrar histórico
      const { error: historicoError } = await supabase
        .from('integrantes_historico')
        .insert([{
          integrante_id: integrante.id,
          profile_id: integrante.profile_id,
          acao: 'update_profile',
          dados_anteriores: dadosAnteriores as any,
          dados_novos: dadosNovos as any,
          alterado_por: userId,
          observacao: observacao.trim(),
        }]);

      if (historicoError) {
        console.error('Erro ao registrar histórico:', historicoError);
        toast({
          title: "Aviso",
          description: "Alteração salva, mas o histórico não foi registrado. Contate um administrador.",
        });
      }

      // Se cargo foi alterado, criar pendência para ajuste de roles
      if (dadosNovos.cargo_nome && dadosNovos.cargo_nome !== integrante.cargo_nome) {
        const { error: pendenciaError } = await supabase
          .from('pendencias_ajuste_roles')
          .insert([{
            integrante_id: integrante.id,
            integrante_nome_colete: integrante.nome_colete,
            integrante_divisao_texto: integrante.divisao_texto,
            integrante_registro_id: integrante.registro_id,
            cargo_anterior: integrante.cargo_nome,
            cargo_novo: dadosNovos.cargo_nome,
            grau_anterior: integrante.grau,
            grau_novo: dadosNovos.grau,
            alterado_por: userId,
            justificativa: observacao.trim(),
          }]);

        if (pendenciaError) {
          console.error('Erro ao criar pendência de ajuste de roles:', pendenciaError);
          // Não falhar a operação principal por erro na pendência
        } else {
          toast({
            title: "Pendência de permissões criada",
            description: "Um administrador precisará ajustar as permissões do integrante.",
          });
        }
      }

      toast({
        title: "Integrante atualizado",
        description: `${integrante.nome_colete} foi atualizado com sucesso.`,
      });

      return true;
    } catch (error) {
      console.error('Erro ao editar integrante:', error);
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível atualizar o integrante. Tente novamente.",
        variant: "destructive",
      });
      return false;
    } finally {
      setOperando(false);
    }
  };

  const inativarIntegrante = async (
    integrante: IntegrantePortal,
    motivo: string,
    justificativa: string,
    userId: string
  ): Promise<boolean> => {
    if (!justificativa || justificativa.trim().length < 30) {
      toast({
        title: "Justificativa obrigatória",
        description: "A justificativa deve ter no mínimo 30 caracteres.",
        variant: "destructive",
      });
      return false;
    }

    if (!motivo) {
      toast({
        title: "Motivo obrigatório",
        description: "Selecione o motivo da inativação.",
        variant: "destructive",
      });
      return false;
    }

    setOperando(true);

    try {
      // Snapshot dos dados anteriores
      const dadosAnteriores: Record<string, any> = {
        ativo: integrante.ativo,
        nome_colete: integrante.nome_colete,
        regional_texto: integrante.regional_texto,
        divisao_texto: integrante.divisao_texto,
        cargo_grau_texto: integrante.cargo_grau_texto,
      };

      // Inativar integrante
      const { error: updateError } = await supabase
        .from('integrantes_portal')
        .update({
          ativo: false,
          motivo_inativacao: motivo as any,
          data_inativacao: new Date().toISOString().split('T')[0],
          updated_at: new Date().toISOString(),
        })
        .eq('id', integrante.id);

      if (updateError) {
        throw updateError;
      }

      // Registrar histórico
      const { error: historicoError } = await supabase
        .from('integrantes_historico')
        .insert([{
          integrante_id: integrante.id,
          profile_id: integrante.profile_id,
          acao: 'inativacao',
          dados_anteriores: dadosAnteriores as any,
          dados_novos: {
            ativo: false,
            motivo_inativacao: motivo,
          data_inativacao: new Date().toISOString().split('T')[0],
          } as any,
          alterado_por: userId,
          observacao: `Motivo: ${motivo}. ${justificativa.trim()}`,
        }]);

      if (historicoError) {
        console.error('Erro ao registrar histórico:', historicoError);
        toast({
          title: "Aviso",
          description: "Inativação realizada, mas o histórico não foi registrado. Contate um administrador.",
        });
      }

      toast({
        title: "Integrante inativado",
        description: `${integrante.nome_colete} foi inativado com sucesso.`,
      });

      return true;
    } catch (error) {
      console.error('Erro ao inativar integrante:', error);
      toast({
        title: "Erro ao inativar",
        description: "Não foi possível inativar o integrante. Tente novamente.",
        variant: "destructive",
      });
      return false;
    } finally {
      setOperando(false);
    }
  };

  return {
    editarIntegrante,
    inativarIntegrante,
    operando,
  };
};
