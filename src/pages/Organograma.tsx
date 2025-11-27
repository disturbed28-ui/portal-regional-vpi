import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useUserRole } from '@/hooks/useUserRole';
import { useScreenAccess } from '@/hooks/useScreenAccess';
import { useOrganogramaData } from '@/hooks/useOrganogramaData';
import { HierarchyCard } from '@/components/organograma/HierarchyCard';
import { IntegranteListItem } from '@/components/organograma/IntegranteListItem';
import { BreadcrumbOrganograma } from '@/components/organograma/BreadcrumbOrganograma';
import { DivisaoGrid } from '@/components/organograma/DivisaoGrid';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { IntegranteComFoto } from '@/hooks/useOrganogramaData';

type Nivel = 'regional' | 'lista' | 'divisao';
type TipoLista = 'diretores' | 'subdiretores' | 'sociais' | 'adms' | null;

const getBadges = (integrante: IntegranteComFoto | null) => {
  if (!integrante) return [];
  const badges: ('sgt_armas' | 'caveira' | 'caveira_suplente' | 'batedor' | 'combate_insano')[] = [];
  if (integrante.sgt_armas) badges.push('sgt_armas');
  if (integrante.caveira) badges.push('caveira');
  if (integrante.caveira_suplente) badges.push('caveira_suplente');
  if (integrante.batedor) badges.push('batedor');
  if (integrante.combate_insano) badges.push('combate_insano');
  return badges;
};

const Organograma = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile(user?.id);
  const { hasRole, loading: roleLoading } = useUserRole(user?.id);
  const { hasAccess, loading: loadingAccess } = useScreenAccess("/organograma", user?.id);
  
  const [nivel, setNivel] = useState<Nivel>('regional');
  const [tipoLista, setTipoLista] = useState<TipoLista>(null);
  const [divisaoSelecionada, setDivisaoSelecionada] = useState<string | null>(null);

  const [regionalUsuario, setRegionalUsuario] = useState<string | null>(null);

  // Redirecionamento em caso de acesso negado
  useEffect(() => {
    if (!loadingAccess && !hasAccess) {
      toast.error("Acesso negado", {
        description: "Você não tem permissão para acessar esta página.",
      });
      navigate("/");
    }
  }, [loadingAccess, hasAccess, navigate]);

  // Redirecionar para perfil se usuário não tiver nome_colete
  useEffect(() => {
    if (user && !profileLoading && profile && !profile.nome_colete) {
      toast.error("Complete seu cadastro", {
        description: "Por favor, adicione seu nome de colete para continuar.",
      });
      navigate("/perfil");
    }
  }, [user, profileLoading, profile, navigate]);

  // Validar acesso e buscar regional do integrante
  useEffect(() => {
    // Aguardar todos os loadings completarem e dados necessários estarem disponíveis
    if (!user?.id || roleLoading || profileLoading) return;
    
    // Para admin, aguardar profile estar disponível
    const isAdmin = hasRole('admin');
    if (isAdmin && !profile) return;

    const validateAccess = async () => {
      // Se for admin, usar dados do profile
      if (isAdmin) {
        if (!profile?.regional_id) {
          toast.error('Admin sem regional definida no perfil');
          navigate('/');
          return;
        }
        
        // Buscar nome da regional pelo ID
        const { data: regionalData, error: regionalError } = await supabase
          .from('regionais')
          .select('nome')
          .eq('id', profile.regional_id)
          .maybeSingle();
        
        if (regionalError || !regionalData) {
          toast.error('Erro ao buscar regional do admin');
          navigate('/');
          return;
        }
        
        setRegionalUsuario(regionalData.nome);
        return;
      }

      // Se não for admin, validar integrantes_portal (lógica atual)
      const { data, error } = await supabase
        .from('integrantes_portal')
        .select('ativo, vinculado, regional_texto')
        .eq('profile_id', user.id)
        .maybeSingle();
      
      if (error || !data || !data.ativo) {
        toast.error('Acesso negado: apenas integrantes ativos podem acessar');
        navigate('/');
        return;
      }
      
      setRegionalUsuario(data.regional_texto);
    };

    validateAccess();
  }, [user?.id, navigate, hasRole, roleLoading, profile, profileLoading]);
  
  const {
    hierarquiaRegional,
    diretoresDivisao,
    subdiretores,
    sociaisDivisao,
    admsDivisao,
    integrantesPorDivisao,
    loading: dataLoading
  } = useOrganogramaData(regionalUsuario);

  const navegarParaLista = (tipo: TipoLista) => {
    if (tipo === 'adms' && admsDivisao.length === 0) {
      toast.info('Não há ADMs de divisão cadastrados');
      return;
    }
    setTipoLista(tipo);
    setNivel('lista');
  };

  const navegarParaDivisao = (divisao: string) => {
    setDivisaoSelecionada(divisao);
    setNivel('divisao');
  };

  const voltarParaRegional = () => {
    setNivel('regional');
    setTipoLista(null);
    setDivisaoSelecionada(null);
  };

  const voltarParaLista = () => {
    setNivel('lista');
    setDivisaoSelecionada(null);
  };

  if (loadingAccess || profileLoading || dataLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">
            {loadingAccess ? "Verificando permissões..." : "Carregando organograma..."}
          </p>
        </div>
      </div>
    );
  }

  if (!hasAccess) return null;

  if (!regionalUsuario) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-muted-foreground">Regional não encontrada</p>
        </div>
      </div>
    );
  }

  const getTituloLista = () => {
    switch (tipoLista) {
      case 'diretores': return 'Diretores de Divisão';
      case 'subdiretores': return 'Subdiretores';
      case 'sociais': return 'Sociais de Divisão';
      case 'adms': return 'ADMs de Divisão';
      default: return '';
    }
  };

  const getListaAtual = () => {
    switch (tipoLista) {
      case 'diretores': return diretoresDivisao;
      case 'subdiretores': return subdiretores;
      case 'sociais': return sociaisDivisao;
      case 'adms': return admsDivisao;
      default: return [];
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center gap-3 mb-4">
          <Button 
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
            className="flex-shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Organograma</h1>
        </div>

        <BreadcrumbOrganograma
          nivel={nivel}
          regionalNome={regionalUsuario}
          cargoAtual={nivel !== 'regional' ? getTituloLista() : undefined}
          divisaoAtual={divisaoSelecionada || undefined}
          onVoltar={nivel === 'divisao' ? voltarParaLista : voltarParaRegional}
        />

        {/* Nível 1: Hierarquia Regional */}
        {nivel === 'regional' && (
          <div className="space-y-6">
            <HierarchyCard
              cargo="Diretor Regional"
              nome={hierarquiaRegional.diretor_regional?.nome_colete}
              foto={hierarquiaRegional.diretor_regional?.foto}
              badges={getBadges(hierarquiaRegional.diretor_regional)}
              onClick={() => navegarParaLista('diretores')}
              destaque
            />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <HierarchyCard
                cargo="Operacional Regional"
                nome={hierarquiaRegional.operacional_regional?.nome_colete}
                foto={hierarquiaRegional.operacional_regional?.foto}
                badges={getBadges(hierarquiaRegional.operacional_regional)}
                onClick={() => navegarParaLista('subdiretores')}
              />
              <HierarchyCard
                cargo="Social Regional"
                nome={hierarquiaRegional.social_regional?.nome_colete}
                foto={hierarquiaRegional.social_regional?.foto}
                badges={getBadges(hierarquiaRegional.social_regional)}
                onClick={() => navegarParaLista('sociais')}
              />
              <HierarchyCard
                cargo="ADM Regional"
                nome={hierarquiaRegional.adm_regional?.nome_colete}
                foto={hierarquiaRegional.adm_regional?.foto}
                badges={getBadges(hierarquiaRegional.adm_regional)}
                onClick={() => navegarParaLista('adms')}
              />
              <HierarchyCard
                cargo="Comunicação Regional"
                nome={hierarquiaRegional.comunicacao_regional?.nome_colete}
                foto={hierarquiaRegional.comunicacao_regional?.foto}
                badges={getBadges(hierarquiaRegional.comunicacao_regional)}
              />
            </div>
          </div>
        )}

        {/* Nível 2: Lista por Cargo */}
        {nivel === 'lista' && (
          <div className="space-y-4">
            {getListaAtual().length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum integrante encontrado
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {getListaAtual().map((integrante) => (
            <IntegranteListItem
              key={integrante.id}
              nome={integrante.nome_colete}
              cargo={integrante.cargo_nome || 'Sem cargo'}
              grau={integrante.grau || undefined}
              divisao={integrante.divisao_texto}
              foto={integrante.foto}
              badges={getBadges(integrante)}
              onClick={() => navegarParaDivisao(integrante.divisao_texto)}
            />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Nível 3: Integrantes da Divisão */}
        {nivel === 'divisao' && divisaoSelecionada && (
          <DivisaoGrid
            integrantes={integrantesPorDivisao.get(divisaoSelecionada) || []}
          />
        )}
      </div>
    </div>
  );
};

export default Organograma;
