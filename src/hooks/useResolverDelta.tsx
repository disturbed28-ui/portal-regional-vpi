import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useResolverDelta = () => {
  const resolverDelta = async (
    deltaId: string,
    observacao: string,
    userId: string,
    acaoResolucao?: string
  ) => {
    try {
      // Primeiro buscar dados_adicionais existentes para não sobrescrever
      const { data: deltaAtual } = await supabase
        .from('deltas_pendentes')
        .select('dados_adicionais')
        .eq('id', deltaId)
        .single();
      
      // Mesclar acao_resolucao com dados existentes
      const dadosAdicionais = {
        ...(deltaAtual?.dados_adicionais as object || {}),
        ...(acaoResolucao ? { acao_resolucao: acaoResolucao } : {})
      };

      const { error } = await supabase
        .from('deltas_pendentes')
        .update({
          status: 'RESOLVIDO',
          observacao_admin: observacao,
          resolvido_por: userId,
          resolvido_em: new Date().toISOString(),
          dados_adicionais: dadosAdicionais
        })
        .eq('id', deltaId);
      
      if (error) throw error;
      
      // Limpar cache de pendências (todas as versões)
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('pendencias_')) {
          console.log('[useResolverDelta] Limpando cache:', key);
          localStorage.removeItem(key);
        }
      });
      
      toast.success('Delta resolvido com sucesso');
      return true;
    } catch (error) {
      console.error('[useResolverDelta] Erro ao resolver delta:', error);
      toast.error('Erro ao resolver delta');
      return false;
    }
  };
  
  return { resolverDelta };
};
