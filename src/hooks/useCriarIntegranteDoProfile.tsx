import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DadosCriacaoIntegrante {
  profileId: string;
  registroId: number;
  nomeColete: string;
  comandoTexto: string;
  regionalTexto: string;
  divisaoTexto: string;
  cargoGrauTexto: string;
  cargoNome: string | null;
  grau: string;
  dataEntrada?: string | null;
  observacao: string;
  criadoPor: string;
  isAdmin: boolean;
}

export const useCriarIntegranteDoProfile = () => {
  const criarIntegrante = async (dados: DadosCriacaoIntegrante) => {
    try {
      // 1. Validar que registro_id não existe
      const { data: existe } = await supabase
        .from('integrantes_portal')
        .select('id')
        .eq('registro_id', dados.registroId)
        .maybeSingle();
      
      if (existe) {
        throw new Error('Registro ID já existe na base de integrantes');
      }

      // 2. Inserir em integrantes_portal
      const { data: novoIntegrante, error: insertError } = await supabase
        .from('integrantes_portal')
        .insert({
          registro_id: dados.registroId,
          nome_colete: dados.nomeColete,
          comando_texto: dados.comandoTexto,
          regional_texto: dados.regionalTexto,
          divisao_texto: dados.divisaoTexto,
          cargo_grau_texto: dados.cargoGrauTexto,
          cargo_nome: dados.cargoNome,
          grau: dados.grau,
          profile_id: dados.profileId,
          vinculado: true,
          data_vinculacao: new Date().toISOString(),
          ativo: true,
          data_entrada: dados.dataEntrada,
          observacoes: dados.observacao
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // 3. Registrar no histórico
      await supabase
        .from('integrantes_historico')
        .insert({
          integrante_id: novoIntegrante.id,
          acao: 'CADASTRO_MANUAL',
          dados_novos: novoIntegrante,
          observacao: dados.observacao,
          alterado_por: dados.criadoPor
        });

      // 4. Se NÃO for admin, criar pendência para ajuste de roles
      if (!dados.isAdmin) {
        await supabase
          .from('pendencias_ajuste_roles')
          .insert({
            alterado_por: dados.criadoPor,
            cargo_anterior: null,
            cargo_novo: dados.cargoNome || dados.cargoGrauTexto,
            grau_anterior: null,
            grau_novo: dados.grau,
            integrante_id: novoIntegrante.id,
            integrante_nome_colete: dados.nomeColete,
            integrante_divisao_texto: dados.divisaoTexto,
            integrante_registro_id: dados.registroId,
            justificativa: `Cadastro manual de integrante Grau ${dados.grau} - pendente configuração de roles`,
            status: 'pendente',
            tipo_pendencia: 'cadastro_manual',
            profile_id: dados.profileId,
            dados_adicionais: {
              comando_texto: dados.comandoTexto,
              regional_texto: dados.regionalTexto,
              data_entrada: dados.dataEntrada
            }
          });
        
        toast.success('Integrante criado! Pendência gerada para admin configurar permissões.');
      } else {
        toast.success('Integrante criado e vinculado com sucesso!');
      }

      return novoIntegrante;
    } catch (error: any) {
      console.error('[useCriarIntegranteDoProfile] Erro:', error);
      toast.error(error.message || 'Erro ao criar integrante');
      throw error;
    }
  };

  return { criarIntegrante };
};
