import { useMemo } from 'react';
import { useMensalidades } from './useMensalidades';
import { useProfile } from './useProfile';
import { useDivisoes } from './useDivisoes';
import { getNivelAcesso } from '@/lib/grauUtils';
import { normalizeText } from '@/lib/normalizeText';

export const useInadimplenciaFiltrada = (userId: string | undefined) => {
  const { profile } = useProfile(userId);
  const { ultimaCargaInfo, devedoresAtivos, devedoresCronicos } = useMensalidades();
  const { divisoes } = useDivisoes();

  // Determinar nível de acesso
  const nivelAcesso = useMemo(() => {
    return getNivelAcesso(profile?.integrante?.grau || profile?.grau);
  }, [profile]);

  // Criar mapa de divisao_texto → regional_id
  const mapaDivisaoRegional = useMemo(() => {
    const mapa: Record<string, string> = {};
    divisoes?.forEach(d => {
      mapa[normalizeText(d.nome)] = d.regional_id;
    });
    return mapa;
  }, [divisoes]);

  // Filtrar devedores ativos
  const devedoresAtivosFiltrados = useMemo(() => {
    if (!profile || nivelAcesso === 'comando') {
      return devedoresAtivos; // Comando vê tudo
    }

    if (nivelAcesso === 'regional') {
      // Grau V: filtra pela regional do usuário
      return devedoresAtivos.filter(d => {
        const regionalId = mapaDivisaoRegional[normalizeText(d.divisao_texto || '')];
        return regionalId === profile.regional_id;
      });
    }

    // Grau VI+: filtra pela divisão do usuário
    const divisaoNomeNormalizado = normalizeText(profile.divisao || '');
    return devedoresAtivos.filter(d => 
      normalizeText(d.divisao_texto || '') === divisaoNomeNormalizado
    );
  }, [devedoresAtivos, profile, nivelAcesso, mapaDivisaoRegional]);

  // Filtrar devedores crônicos (mesma lógica)
  const devedoresCronicosFiltrados = useMemo(() => {
    if (!profile || nivelAcesso === 'comando') {
      return devedoresCronicos;
    }

    if (nivelAcesso === 'regional') {
      return devedoresCronicos.filter(d => {
        const regionalId = mapaDivisaoRegional[normalizeText(d.divisao_texto || '')];
        return regionalId === profile.regional_id;
      });
    }

    const divisaoNomeNormalizado = normalizeText(profile.divisao || '');
    return devedoresCronicos.filter(d => 
      normalizeText(d.divisao_texto || '') === divisaoNomeNormalizado
    );
  }, [devedoresCronicos, profile, nivelAcesso, mapaDivisaoRegional]);

  return {
    ultimaCargaInfo,
    devedoresAtivos: devedoresAtivosFiltrados,
    devedoresCronicos: devedoresCronicosFiltrados,
    nivelAcesso,
    loading: !profile
  };
};
