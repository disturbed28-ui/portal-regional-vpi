import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useResolverDelta = () => {
  const resolverDelta = async (
    deltaId: string,
    observacao: string,
    userId: string
  ) => {
    try {
      const { error } = await supabase
        .from('deltas_pendentes')
        .update({
          status: 'RESOLVIDO',
          observacao_admin: observacao,
          resolvido_por: userId,
          resolvido_em: new Date().toISOString()
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
