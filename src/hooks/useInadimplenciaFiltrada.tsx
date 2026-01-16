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

  // Determinar nível de acesso baseado no grau
  const nivelAcesso = useMemo(() => {
    return getNivelAcesso(profile?.integrante?.grau || profile?.grau);
  }, [profile]);

  // Obter a divisão do usuário a partir do divisao_id (mais confiável que texto)
  const userDivisao = useMemo(() => {
    if (!profile?.divisao_id || !divisoes) return null;
    return divisoes.find(d => d.id === profile.divisao_id);
  }, [profile?.divisao_id, divisoes]);

  // Criar mapa de divisao_texto → regional_id
  const mapaDivisaoRegional = useMemo(() => {
    const mapa: Record<string, string> = {};
    divisoes?.forEach(d => {
      mapa[normalizeText(d.nome)] = d.regional_id;
    });
    return mapa;
  }, [divisoes]);

  // Filtrar devedores ativos baseado no nível de acesso
  const devedoresAtivosFiltrados = useMemo(() => {
    // Grau I-IV (comando): vê tudo sem filtro
    if (!profile || nivelAcesso === 'comando') {
      return devedoresAtivos;
    }

    // Grau V (regional): vê TODAS as divisões da sua regional
    if (nivelAcesso === 'regional') {
      return devedoresAtivos.filter(d => {
        const regionalId = mapaDivisaoRegional[normalizeText(d.divisao_texto || '')];
        return regionalId === profile.regional_id;
      });
    }

    // Grau VI (divisão): vê SOMENTE sua divisão
    // Usar divisao_id para encontrar o nome correto da divisão
    const divisaoNome = userDivisao?.nome || profile.divisao;
    if (!divisaoNome) {
      console.warn('useInadimplenciaFiltrada: Grau VI sem divisão definida');
      return [];
    }
    
    const divisaoNomeNormalizado = normalizeText(divisaoNome);
    return devedoresAtivos.filter(d => 
      normalizeText(d.divisao_texto || '') === divisaoNomeNormalizado
    );
  }, [devedoresAtivos, profile, nivelAcesso, mapaDivisaoRegional, userDivisao]);

  // Filtrar devedores crônicos (mesma lógica)
  const devedoresCronicosFiltrados = useMemo(() => {
    // Grau I-IV (comando): vê tudo sem filtro
    if (!profile || nivelAcesso === 'comando') {
      return devedoresCronicos;
    }

    // Grau V (regional): vê TODAS as divisões da sua regional
    if (nivelAcesso === 'regional') {
      return devedoresCronicos.filter(d => {
        const regionalId = mapaDivisaoRegional[normalizeText(d.divisao_texto || '')];
        return regionalId === profile.regional_id;
      });
    }

    // Grau VI (divisão): vê SOMENTE sua divisão
    const divisaoNome = userDivisao?.nome || profile.divisao;
    if (!divisaoNome) {
      return [];
    }
    
    const divisaoNomeNormalizado = normalizeText(divisaoNome);
    return devedoresCronicos.filter(d => 
      normalizeText(d.divisao_texto || '') === divisaoNomeNormalizado
    );
  }, [devedoresCronicos, profile, nivelAcesso, mapaDivisaoRegional, userDivisao]);

  return {
    ultimaCargaInfo,
    devedoresAtivos: devedoresAtivosFiltrados,
    devedoresCronicos: devedoresCronicosFiltrados,
    nivelAcesso,
    loading: !profile
  };
};
