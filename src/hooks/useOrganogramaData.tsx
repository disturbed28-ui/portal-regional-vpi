import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ordenarIntegrantes } from '@/lib/integranteOrdering';

export interface IntegranteComFoto {
  id: string;
  nome_colete: string;
  cargo_nome: string | null;
  grau: string | null;
  divisao_texto: string;
  divisao_id: string | null;
  regional_texto: string;
  data_entrada: string | null;
  vinculado: boolean;
  profile_id: string | null;
  foto: string | null;
  sgt_armas: boolean;
  caveira: boolean;
  caveira_suplente: boolean;
  batedor: boolean;
  combate_insano: boolean;
}

interface HierarquiaRegional {
  diretor_regional: IntegranteComFoto | null;
  operacional_regional: IntegranteComFoto | null;
  social_regional: IntegranteComFoto | null;
  adm_regional: IntegranteComFoto | null;
  comunicacao_regional: IntegranteComFoto | null;
}

export const useOrganogramaData = (regionalId: string | null) => {
  const [hierarquiaRegional, setHierarquiaRegional] = useState<HierarquiaRegional>({
    diretor_regional: null,
    operacional_regional: null,
    social_regional: null,
    adm_regional: null,
    comunicacao_regional: null,
  });
  const [diretoresDivisao, setDiretoresDivisao] = useState<IntegranteComFoto[]>([]);
  const [subdiretores, setSubdiretores] = useState<IntegranteComFoto[]>([]);
  const [sociaisDivisao, setSociaisDivisao] = useState<IntegranteComFoto[]>([]);
  const [admsDivisao, setAdmsDivisao] = useState<IntegranteComFoto[]>([]);
  const [integrantesPorDivisao, setIntegrantesPorDivisao] = useState<Map<string, IntegranteComFoto[]>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!regionalId) {
      setLoading(false);
      return;
    }

    const fetchOrganograma = async () => {
      try {
        setLoading(true);

        console.log('[useOrganogramaData] Buscando integrantes da regional:', regionalId);

        // 1. Buscar integrantes ativos da regional usando regional_id (UUID)
        const { data: integrantes, error: integrantesError } = await supabase
          .from('integrantes_portal')
          .select('*')
          .eq('regional_id', regionalId)
          .eq('ativo', true);

        if (integrantesError) throw integrantesError;

        console.log('[useOrganogramaData] Integrantes encontrados:', integrantes?.length);

        // 2. Buscar fotos dos vinculados
        const vinculadosIds = integrantes
          ?.filter(i => i.vinculado && i.profile_id)
          .map(i => i.profile_id) || [];

        let profiles: any[] = [];
        if (vinculadosIds.length > 0) {
          const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('id, photo_url')
            .in('id', vinculadosIds);

          if (profilesError) throw profilesError;
          profiles = profilesData || [];
        }

        // 3. Merge foto + integrante
        const integrantesComFoto: IntegranteComFoto[] = (integrantes || []).map(i => ({
          id: i.id,
          nome_colete: i.nome_colete,
          cargo_nome: i.cargo_nome,
          grau: i.grau,
          divisao_texto: i.divisao_texto,
          divisao_id: i.divisao_id,
          regional_texto: i.regional_texto,
          data_entrada: i.data_entrada,
          vinculado: i.vinculado,
          profile_id: i.profile_id,
          foto: profiles.find(p => p.id === i.profile_id)?.photo_url || null,
          sgt_armas: i.sgt_armas || false,
          caveira: i.caveira || false,
          caveira_suplente: i.caveira_suplente || false,
          batedor: i.batedor || false,
          combate_insano: i.combate_insano || false,
        }));

        // 4. Funções auxiliares para comparação flexível de cargos
        const normalizar = (texto: string) => 
          texto?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() || '';

        const cargoMatch = (cargoNome: string | null, padrao: string) => {
          if (!cargoNome) return false;
          const cargoNorm = normalizar(cargoNome);
          const padraoNorm = normalizar(padrao);
          return cargoNorm.startsWith(padraoNorm);
        };

        // 5. Separar por hierarquia usando comparação flexível
        const hierarquia: HierarquiaRegional = {
          diretor_regional: integrantesComFoto.find(i => cargoMatch(i.cargo_nome, 'Diretor Regional')) || null,
          operacional_regional: integrantesComFoto.find(i => cargoMatch(i.cargo_nome, 'Operacional Regional')) || null,
          social_regional: integrantesComFoto.find(i => cargoMatch(i.cargo_nome, 'Social Regional')) || null,
          adm_regional: integrantesComFoto.find(i => cargoMatch(i.cargo_nome, 'Adm. Regional')) || null,
          comunicacao_regional: integrantesComFoto.find(i => cargoMatch(i.cargo_nome, 'Comunicacao')) || null,
        };

        console.log('[useOrganogramaData] Hierarquia encontrada:', {
          diretor: hierarquia.diretor_regional?.nome_colete,
          operacional: hierarquia.operacional_regional?.nome_colete,
          social: hierarquia.social_regional?.nome_colete,
          adm: hierarquia.adm_regional?.nome_colete,
          comunicacao: hierarquia.comunicacao_regional?.nome_colete,
        });

        const diretores = integrantesComFoto
          .filter(i => cargoMatch(i.cargo_nome, 'Diretor Divisao'))
          .sort(ordenarIntegrantes);

        const subs = integrantesComFoto
          .filter(i => cargoMatch(i.cargo_nome, 'Sub Diretor Divisao'))
          .sort(ordenarIntegrantes);

        const sociais = integrantesComFoto
          .filter(i => cargoMatch(i.cargo_nome, 'Social Divisao'))
          .sort(ordenarIntegrantes);

        const adms = integrantesComFoto
          .filter(i => cargoMatch(i.cargo_nome, 'Adm. Divisao'))
          .sort(ordenarIntegrantes);

        // 6. Agrupar integrantes por divisão usando divisao_id como chave primária
        // Isso evita problemas de case/acentos no divisao_texto
        const divisoesMap = new Map<string, IntegranteComFoto[]>();
        integrantesComFoto.forEach(integrante => {
          // Usar divisao_id como chave primária para evitar problemas de normalização
          // Se não tiver divisao_id, usar divisao_texto como fallback
          const chave = integrante.divisao_id || integrante.divisao_texto;
          if (!divisoesMap.has(chave)) {
            divisoesMap.set(chave, []);
          }
          divisoesMap.get(chave)?.push(integrante);
        });

        // Ordenar integrantes de cada divisão
        divisoesMap.forEach((integrantes, divisao) => {
          divisoesMap.set(divisao, integrantes.sort(ordenarIntegrantes));
        });

        setHierarquiaRegional(hierarquia);
        setDiretoresDivisao(diretores);
        setSubdiretores(subs);
        setSociaisDivisao(sociais);
        setAdmsDivisao(adms);
        setIntegrantesPorDivisao(divisoesMap);
      } catch (error) {
        console.error('Erro ao buscar dados do organograma:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrganograma();
  }, [regionalId]);

  return {
    hierarquiaRegional,
    diretoresDivisao,
    subdiretores,
    sociaisDivisao,
    admsDivisao,
    integrantesPorDivisao,
    loading
  };
};
