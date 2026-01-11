import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DadosPromocaoGrau4 {
  novoCargoId: string;
  novoCargoNome: string;
  novaRegional: string;
  novaRegionalId?: string;
}

export const useResolverDelta = () => {
  const resolverDelta = async (
    deltaId: string,
    observacao: string,
    userId: string,
    acaoResolucao?: string,
    dadosPromocao?: DadosPromocaoGrau4,
    isAdmin: boolean = true
  ) => {
    try {
      // Primeiro buscar dados do delta
      const { data: deltaAtual } = await supabase
        .from('deltas_pendentes')
        .select('dados_adicionais, registro_id, nome_colete, divisao_texto')
        .eq('id', deltaId)
        .single();
      
      if (!deltaAtual) throw new Error('Delta não encontrado');

      // Se for promoção para Grau IV, atualizar o integrante
      if (acaoResolucao === 'promovido_grau4' && dadosPromocao) {
        // Buscar integrante pelo registro_id
        const { data: integrante } = await supabase
          .from('integrantes_portal')
          .select('id, cargo_grau_texto, grau, regional_texto, divisao_texto')
          .eq('registro_id', deltaAtual.registro_id)
          .single();

        if (integrante) {
          // Dados anteriores para histórico
          const dadosAnteriores = {
            cargo_grau_texto: integrante.cargo_grau_texto,
            grau: integrante.grau,
            regional_texto: integrante.regional_texto,
            divisao_texto: integrante.divisao_texto
          };

          // Atualizar integrante com promoção
          const { error: updateError } = await supabase
            .from('integrantes_portal')
            .update({
              grau: 'IV',
              cargo_nome: dadosPromocao.novoCargoNome,
              cargo_grau_texto: `${dadosPromocao.novoCargoNome} (Grau IV)`,
              regional_texto: dadosPromocao.novaRegional,
              regional_id: dadosPromocao.novaRegionalId || null,
              divisao_texto: 'COMANDO',
              divisao_id: null,
              updated_at: new Date().toISOString()
            })
            .eq('id', integrante.id);

          if (updateError) throw updateError;

          // Registrar no histórico
          await supabase
            .from('integrantes_historico')
            .insert({
              integrante_id: integrante.id,
              acao: 'PROMOCAO_GRAU4',
              dados_anteriores: dadosAnteriores,
              dados_novos: {
                cargo_grau_texto: `${dadosPromocao.novoCargoNome} (Grau IV)`,
                grau: 'IV',
                regional_texto: dadosPromocao.novaRegional,
                divisao_texto: 'COMANDO'
              },
              observacao: observacao,
              alterado_por: userId
            });

          // Se NÃO for admin, criar pendência para ajuste de roles
          if (!isAdmin) {
            await supabase
              .from('pendencias_ajuste_roles')
              .insert({
                alterado_por: userId,
                cargo_anterior: dadosAnteriores.cargo_grau_texto,
                cargo_novo: dadosPromocao.novoCargoNome,
                grau_anterior: dadosAnteriores.grau,
                grau_novo: 'IV',
                integrante_id: integrante.id,
                integrante_nome_colete: deltaAtual.nome_colete,
                integrante_divisao_texto: dadosPromocao.novaRegional,
                integrante_registro_id: deltaAtual.registro_id,
                justificativa: `Promoção para Grau IV (${dadosPromocao.novoCargoNome}) - pendente ajuste de roles`,
                status: 'pendente',
                tipo_pendencia: 'promocao_grau4',
                dados_adicionais: {
                  divisao_anterior: dadosAnteriores.divisao_texto,
                  regional_anterior: dadosAnteriores.regional_texto
                }
              });
          }
        }
      }
      
      // Mesclar acao_resolucao com dados existentes
      const dadosAdicionais = {
        ...(deltaAtual?.dados_adicionais as Record<string, unknown> || {}),
        ...(acaoResolucao ? { acao_resolucao: acaoResolucao } : {}),
        ...(dadosPromocao ? { promocao: JSON.parse(JSON.stringify(dadosPromocao)) } : {})
      } as Record<string, unknown>;

      const { error } = await supabase
        .from('deltas_pendentes')
        .update({
          status: 'RESOLVIDO',
          observacao_admin: observacao,
          resolvido_por: userId,
          resolvido_em: new Date().toISOString(),
          dados_adicionais: dadosAdicionais as { [key: string]: unknown }
        } as any)
        .eq('id', deltaId);
      
      if (error) throw error;
      
      // Limpar cache de pendências (todas as versões)
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('pendencias_')) {
          console.log('[useResolverDelta] Limpando cache:', key);
          localStorage.removeItem(key);
        }
      });
      
      if (acaoResolucao === 'promovido_grau4' && !isAdmin) {
        toast.success('Promoção registrada! Pendência gerada para admin ajustar permissões.');
      } else {
        toast.success('Delta resolvido com sucesso');
      }
      return true;
    } catch (error) {
      console.error('[useResolverDelta] Erro ao resolver delta:', error);
      toast.error('Erro ao resolver delta');
      return false;
    }
  };
  
  return { resolverDelta };
};
