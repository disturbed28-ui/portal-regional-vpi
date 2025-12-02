import { useMemo } from 'react';
import { useMensalidades } from './useMensalidades';
import { useProfile } from './useProfile';
import { useDivisoes } from './useDivisoes';
import { getNivelAcesso } from '@/lib/grauUtils';

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
      mapa[d.nome.toLowerCase()] = d.regional_id;
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
        const regionalId = mapaDivisaoRegional[d.divisao_texto?.toLowerCase() || ''];
        return regionalId === profile.regional_id;
      });
    }

    // Grau VI+: filtra pela divisão do usuário
    const divisaoNome = profile.divisao?.toLowerCase();
    return devedoresAtivos.filter(d => 
      d.divisao_texto?.toLowerCase() === divisaoNome
    );
  }, [devedoresAtivos, profile, nivelAcesso, mapaDivisaoRegional]);

  // Filtrar devedores crônicos (mesma lógica)
  const devedoresCronicosFiltrados = useMemo(() => {
    if (!profile || nivelAcesso === 'comando') {
      return devedoresCronicos;
    }

    if (nivelAcesso === 'regional') {
      return devedoresCronicos.filter(d => {
        const regionalId = mapaDivisaoRegional[d.divisao_texto?.toLowerCase() || ''];
        return regionalId === profile.regional_id;
      });
    }

    const divisaoNome = profile.divisao?.toLowerCase();
    return devedoresCronicos.filter(d => 
      d.divisao_texto?.toLowerCase() === divisaoNome
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
