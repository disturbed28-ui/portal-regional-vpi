import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface IntegranteComFoto {
  id: string;
  nome_colete: string;
  cargo_nome: string | null;
  grau: string | null;
  divisao_texto: string;
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

export const useOrganogramaData = (regionalUsuario: string | null) => {
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
    if (!regionalUsuario) {
      setLoading(false);
      return;
    }

    const fetchOrganograma = async () => {
      try {
        setLoading(true);

        // 1. Buscar integrantes ativos da regional
        const { data: integrantes, error: integrantesError } = await supabase
          .from('integrantes_portal')
          .select('*')
          .or(`regional_texto.ilike.%${regionalUsuario}%,regional_texto.ilike.%regional ${regionalUsuario}%`)
          .eq('ativo', true);

        if (integrantesError) throw integrantesError;

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

        // 4. Ordenar integrantes
        const ordenarIntegrantes = (a: IntegranteComFoto, b: IntegranteComFoto) => {
        // Por cargo
        const ordemCargos: Record<string, number> = {
          'Diretor Divisão': 1,
          'Sub Diretor Divisão': 2,
          'Social Divisão': 3,
          'Adm. Divisão': 4,
          'Sgt.Armas Divisão': 5,
          'Sgt Armas Full': 6,
          'Sgt Armas PP': 7
        };
          const cargoA = ordemCargos[a.cargo_nome || ''] || 99;
          const cargoB = ordemCargos[b.cargo_nome || ''] || 99;
          if (cargoA !== cargoB) return cargoA - cargoB;
          
          // Por grau
          const grauA = a.grau ? parseInt(a.grau) : 99;
          const grauB = b.grau ? parseInt(b.grau) : 99;
          if (grauA !== grauB) return grauA - grauB;
          
          // Por data de entrada (mais antigo primeiro)
          const dataA = a.data_entrada ? new Date(a.data_entrada).getTime() : 0;
          const dataB = b.data_entrada ? new Date(b.data_entrada).getTime() : 0;
          return dataA - dataB;
        };

        // 5. Separar por hierarquia
        const hierarquia: HierarquiaRegional = {
          diretor_regional: integrantesComFoto.find(i => i.cargo_nome === 'Diretor Regional') || null,
          operacional_regional: integrantesComFoto.find(i => i.cargo_nome === 'Operacional Regional') || null,
          social_regional: integrantesComFoto.find(i => i.cargo_nome === 'Social Regional') || null,
          adm_regional: integrantesComFoto.find(i => i.cargo_nome === 'Adm. Regional') || null,
          comunicacao_regional: integrantesComFoto.find(i => i.cargo_nome === 'Comunicação') || null,
        };

        const diretores = integrantesComFoto
          .filter(i => i.cargo_nome === 'Diretor Divisão')
          .sort(ordenarIntegrantes);

        const subs = integrantesComFoto
          .filter(i => i.cargo_nome === 'Sub Diretor Divisão')
          .sort(ordenarIntegrantes);

        const sociais = integrantesComFoto
          .filter(i => i.cargo_nome === 'Social Divisão')
          .sort(ordenarIntegrantes);

        const adms = integrantesComFoto
          .filter(i => i.cargo_nome === 'Adm. Divisão')
          .sort(ordenarIntegrantes);

        // 6. Agrupar integrantes por divisão
        const divisoesMap = new Map<string, IntegranteComFoto[]>();
        integrantesComFoto.forEach(integrante => {
          if (!divisoesMap.has(integrante.divisao_texto)) {
            divisoesMap.set(integrante.divisao_texto, []);
          }
          divisoesMap.get(integrante.divisao_texto)?.push(integrante);
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
  }, [regionalUsuario]);

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
