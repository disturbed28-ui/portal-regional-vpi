import { useMemo } from 'react';
import { useMensalidades } from './useMensalidades';
import { useProfile } from './useProfile';
import { useDivisoes } from './useDivisoes';
import { useUserRole } from './useUserRole';
import { getEscopoVisibilidade, temVisibilidadeTotal } from '@/lib/escopoVisibilidade';
import { normalizeText } from '@/lib/normalizeText';

export const useInadimplenciaFiltrada = (userId: string | undefined) => {
  const { profile } = useProfile(userId);
  const { roles } = useUserRole(userId);
  const { ultimaCargaInfo, devedoresAtivos, devedoresCronicos } = useMensalidades();
  const { divisoes } = useDivisoes();

  // Determinar escopo de visibilidade usando função centralizada
  const escopo = useMemo(() => {
    const isAdmin = roles.includes('admin');
    return getEscopoVisibilidade(profile, roles, isAdmin);
  }, [profile, roles]);

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

  // Filtrar devedores ativos baseado no escopo de visibilidade
  const devedoresAtivosFiltrados = useMemo(() => {
    // Comando (Grau I-IV, sem role admin): vê tudo sem filtro
    if (!profile || temVisibilidadeTotal(escopo)) {
      return devedoresAtivos;
    }

    // Admin ou Grau V (regional): vê TODAS as divisões da sua regional
    if (escopo.nivelAcesso === 'regional' && escopo.filtroObrigatorio) {
      console.log('[useInadimplenciaFiltrada] Filtrando por regional:', escopo.regionalTexto);
      return devedoresAtivos.filter(d => {
        const regionalId = mapaDivisaoRegional[normalizeText(d.divisao_texto || '')];
        return regionalId === escopo.regionalId;
      });
    }

    // Grau VI (divisão): vê SOMENTE sua divisão
    if (escopo.nivelAcesso === 'divisao' && escopo.filtroObrigatorio) {
      const divisaoNome = userDivisao?.nome || escopo.divisaoTexto || profile.divisao;
      if (!divisaoNome) {
        console.warn('useInadimplenciaFiltrada: Grau VI sem divisão definida');
        return [];
      }
      
      const divisaoNomeNormalizado = normalizeText(divisaoNome);
      return devedoresAtivos.filter(d => 
        normalizeText(d.divisao_texto || '') === divisaoNomeNormalizado
      );
    }

    return devedoresAtivos;
  }, [devedoresAtivos, profile, escopo, mapaDivisaoRegional, userDivisao]);

  // Filtrar devedores crônicos (mesma lógica)
  const devedoresCronicosFiltrados = useMemo(() => {
    // Comando (Grau I-IV, sem role admin): vê tudo sem filtro
    if (!profile || temVisibilidadeTotal(escopo)) {
      return devedoresCronicos;
    }

    // Admin ou Grau V (regional): vê TODAS as divisões da sua regional
    if (escopo.nivelAcesso === 'regional' && escopo.filtroObrigatorio) {
      return devedoresCronicos.filter(d => {
        const regionalId = mapaDivisaoRegional[normalizeText(d.divisao_texto || '')];
        return regionalId === escopo.regionalId;
      });
    }

    // Grau VI (divisão): vê SOMENTE sua divisão
    if (escopo.nivelAcesso === 'divisao' && escopo.filtroObrigatorio) {
      const divisaoNome = userDivisao?.nome || escopo.divisaoTexto || profile.divisao;
      if (!divisaoNome) {
        return [];
      }
      
      const divisaoNomeNormalizado = normalizeText(divisaoNome);
      return devedoresCronicos.filter(d => 
        normalizeText(d.divisao_texto || '') === divisaoNomeNormalizado
      );
    }

    return devedoresCronicos;
  }, [devedoresCronicos, profile, escopo, mapaDivisaoRegional, userDivisao]);

  return {
    ultimaCargaInfo,
    devedoresAtivos: devedoresAtivosFiltrados,
    devedoresCronicos: devedoresCronicosFiltrados,
    nivelAcesso: escopo.nivelAcesso,
    loading: !profile
  };
};
