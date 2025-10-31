import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
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
  const { profile, loading: profileLoading } = useProfile(user?.uid);
  
  const [nivel, setNivel] = useState<Nivel>('regional');
  const [tipoLista, setTipoLista] = useState<TipoLista>(null);
  const [divisaoSelecionada, setDivisaoSelecionada] = useState<string | null>(null);

  const [regionalUsuario, setRegionalUsuario] = useState<string | null>(null);

  // Validar acesso e buscar regional do integrante
  useEffect(() => {
    if (!user?.uid) return;

    const validateAccess = async () => {
      const { data, error } = await supabase
        .from('integrantes_portal')
        .select('ativo, vinculado, regional_texto')
        .eq('profile_id', user.uid)
        .maybeSingle();
      
      if (error || !data || !data.ativo) {
        toast.error('Acesso negado: apenas integrantes ativos podem acessar');
        navigate('/');
        return;
      }
      
      setRegionalUsuario(data.regional_texto);
    };

    validateAccess();
  }, [user?.uid, navigate]);
  
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

  if (profileLoading || dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando organograma...</p>
        </div>
      </div>
    );
  }

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
        <div className="mb-4">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao Menu
          </Button>
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
