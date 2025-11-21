import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useUserRole } from "@/hooks/useUserRole";

export const useAcoesSociaisLista = () => {
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const { roles } = useUserRole(user?.id);

  const fetchAcoes = async () => {
    if (!user?.id || !profile) {
      console.log('[useAcoesSociaisLista] Aguardando autenticação e profile');
      return [];
    }

    // Determinar filtro baseado em roles
    const isRegional = roles.includes('regional') || roles.includes('diretor_regional');
    const isDiretor = roles.includes('diretor_divisao');
    const isModerator = roles.includes('moderator');

    console.log('[useAcoesSociaisLista] Debug:', { 
      roles, 
      isRegional, 
      isDiretor, 
      isModerator,
      profileRegional: profile.regional,
      profileDivisao: profile.divisao 
    });

    let query = supabase
      .from('acoes_sociais_registros')
      .select('*')
      .order('data_acao', { ascending: false });

    if (isRegional) {
      // Regional vê todas da sua regional
      const regionalTexto = profile.regional;
      console.log('[useAcoesSociaisLista] Filtrando por regional:', regionalTexto);
      query = query.ilike('regional_relatorio_texto', regionalTexto);
    } else if (isDiretor || isModerator) {
      // Diretor/Moderador vê apenas da própria divisão
      const divisaoTexto = profile.divisao;
      console.log('[useAcoesSociaisLista] Filtrando por divisão:', divisaoTexto);
      query = query.ilike('divisao_relatorio_texto', divisaoTexto);
    } else {
      // Sem permissão
      console.log('[useAcoesSociaisLista] Usuário sem permissão para ver ações sociais');
      return [];
    }

    const { data, error } = await query;

    if (error) {
      console.error('[useAcoesSociaisLista] Erro ao buscar ações:', error);
      throw error;
    }

    console.log(`[useAcoesSociaisLista] ${data?.length || 0} ações encontradas`);
    return data || [];
  };

  const { data: registros, isLoading, error, refetch } = useQuery({
    queryKey: ['acoes-sociais-lista', user?.id, profile?.id, roles],
    queryFn: fetchAcoes,
    enabled: !!user?.id && !!profile,
  });

  return { 
    registros: registros || [], 
    loading: isLoading, 
    error, 
    refetch 
  };
};
