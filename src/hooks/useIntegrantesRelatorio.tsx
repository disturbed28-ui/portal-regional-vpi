import { useState, useEffect, useMemo } from 'react';
import { useIntegrantes } from './useIntegrantes';
import { useDivisoes } from './useDivisoes';
import { useRegionais } from './useRegionais';
import { useProfile } from './useProfile';
import { getNivelAcesso, romanToNumber, type NivelAcesso } from '@/lib/grauUtils';
import { normalizeSearchTerm } from '@/lib/utils';

export interface OpcaoFiltro {
  value: string;
  label: string;
  tipo: 'todos' | 'regional' | 'divisao';
}

export interface IntegranteAgrupado {
  tipo: 'regional' | 'divisao';
  id: string;
  nome: string;
  integrantes: any[];
}

export interface UseIntegrantesRelatorioResult {
  integrantes: any[];
  integrantesAgrupados: IntegranteAgrupado[];
  opcoesFiltragem: OpcaoFiltro[];
  filtroAtivo: string;
  setFiltro: (filtro: string) => void;
  loading: boolean;
  nivelAcesso: NivelAcesso;
  comboDesabilitado: boolean;
}

export const useIntegrantesRelatorio = (userId: string | undefined): UseIntegrantesRelatorioResult => {
  const { profile } = useProfile(userId);
  const { integrantes: todosIntegrantes, loading: loadingIntegrantes } = useIntegrantes();
  const { divisoes, loading: loadingDivisoes } = useDivisoes();
  const { regionais, loading: loadingRegionais } = useRegionais();
  
  const [filtroAtivo, setFiltroAtivo] = useState<string>('todos');

  // Determinar nível de acesso baseado no grau
  const nivelAcesso = useMemo(() => {
    return getNivelAcesso(profile?.grau);
  }, [profile?.grau]);

  // Determinar se combo deve estar desabilitado (Grau VI+)
  const comboDesabilitado = nivelAcesso === 'divisao';

  // Filtrar integrantes baseado no nível de acesso
  const integrantesFiltrados = useMemo(() => {
    if (!profile || !todosIntegrantes) return [];

    let filtrados = todosIntegrantes;

    // Aplicar filtro por hierarquia (grau)
    if (nivelAcesso === 'regional') {
      // Grau V: apenas regional do usuário
      filtrados = filtrados.filter(
        i => i.regional_id === profile.regional_id
      );
    } else if (nivelAcesso === 'divisao') {
      // Grau VI+: apenas divisão do usuário
      filtrados = filtrados.filter(
        i => i.divisao_id === profile.divisao_id
      );
    }

    // Ordenar por grau (IV → V → VI → ...) e depois por nome
    return filtrados.sort((a, b) => {
      const grauA = romanToNumber(a.grau);
      const grauB = romanToNumber(b.grau);
      
      if (grauA !== grauB) {
        return grauA - grauB;
      }
      
      return (a.nome_colete || '').localeCompare(b.nome_colete || '');
    });
  }, [todosIntegrantes, profile, nivelAcesso]);

  // Gerar opções de filtragem baseado no nível de acesso
  const opcoesFiltragem = useMemo((): OpcaoFiltro[] => {
    if (!profile || !divisoes || !regionais) return [];

    const opcoes: OpcaoFiltro[] = [];

    if (nivelAcesso === 'comando') {
      // Grau I-IV: vê tudo
      opcoes.push({ value: 'todos', label: 'Todos', tipo: 'todos' });
      
      // Adicionar regionais
      regionais.forEach(regional => {
        opcoes.push({
          value: `regional_${regional.id}`,
          label: regional.nome,
          tipo: 'regional'
        });
      });

      // Adicionar divisões agrupadas por regional
      regionais.forEach(regional => {
        const divisoesRegional = divisoes.filter(d => d.regional_id === regional.id);
        divisoesRegional.forEach(divisao => {
          opcoes.push({
            value: `divisao_${divisao.id}`,
            label: `${divisao.nome}`,
            tipo: 'divisao'
          });
        });
      });

    } else if (nivelAcesso === 'regional') {
      // Grau V: sua regional + divisões
      opcoes.push({
        value: `regional_${profile.regional_id}`,
        label: 'Regional',
        tipo: 'regional'
      });

      const divisoesRegional = divisoes.filter(
        d => d.regional_id === profile.regional_id
      );
      divisoesRegional.forEach(divisao => {
        opcoes.push({
          value: `divisao_${divisao.id}`,
          label: divisao.nome,
          tipo: 'divisao'
        });
      });

    } else {
      // Grau VI+: apenas sua divisão
      if (profile.divisao_id) {
        opcoes.push({
          value: `divisao_${profile.divisao_id}`,
          label: profile.divisao || 'Minha Divisão',
          tipo: 'divisao'
        });
      }
    }

    return opcoes;
  }, [profile, divisoes, regionais, nivelAcesso]);

  // Setar filtro inicial baseado no nível de acesso
  useEffect(() => {
    if (opcoesFiltragem.length > 0 && !filtroAtivo) {
      setFiltroAtivo(opcoesFiltragem[0].value);
    }
  }, [opcoesFiltragem, filtroAtivo]);

  // Aplicar filtro selecionado
  const integrantesFiltradosPorSelecao = useMemo(() => {
    if (!filtroAtivo || filtroAtivo === 'todos') {
      return integrantesFiltrados;
    }

    const [tipo, id] = filtroAtivo.split('_');

    if (tipo === 'regional') {
      return integrantesFiltrados.filter(
        i => i.regional_id === id
      );
    }

    if (tipo === 'divisao') {
      return integrantesFiltrados.filter(
        i => i.divisao_id === id
      );
    }

    return integrantesFiltrados;
  }, [integrantesFiltrados, filtroAtivo, regionais, divisoes]);

  // Agrupar integrantes
  const integrantesAgrupados = useMemo((): IntegranteAgrupado[] => {
    if (!regionais || !divisoes) return [];

    if (filtroAtivo === 'todos') {
      // Agrupar por regional e depois por divisão
      const grupos: IntegranteAgrupado[] = [];

      regionais.forEach(regional => {
        const integrantesRegional = integrantesFiltradosPorSelecao.filter(
          i => i.regional_id === regional.id && 
               i.divisao_texto === i.regional_texto
        );

        if (integrantesRegional.length > 0) {
          grupos.push({
            tipo: 'regional',
            id: regional.id,
            nome: regional.nome,
            integrantes: integrantesRegional
          });
        }

        // Divisões dessa regional
        const divisoesRegional = divisoes.filter(d => d.regional_id === regional.id);
        divisoesRegional.forEach(divisao => {
          const integrantesDivisao = integrantesFiltradosPorSelecao.filter(
            i => i.divisao_id === divisao.id
          );

          if (integrantesDivisao.length > 0) {
            grupos.push({
              tipo: 'divisao',
              id: divisao.id,
              nome: divisao.nome,
              integrantes: integrantesDivisao
            });
          }
        });
      });

      return grupos;
    }

    const [tipo, id] = filtroAtivo.split('_');

    if (tipo === 'regional') {
      const regional = regionais.find(r => r.id === id);
      if (!regional) return [];

      return [{
        tipo: 'regional',
        id: regional.id,
        nome: regional.nome,
        integrantes: integrantesFiltradosPorSelecao
      }];
    }

    if (tipo === 'divisao') {
      const divisao = divisoes.find(d => d.id === id);
      if (!divisao) return [];

      return [{
        tipo: 'divisao',
        id: divisao.id,
        nome: divisao.nome,
        integrantes: integrantesFiltradosPorSelecao
      }];
    }

    return [];
  }, [integrantesFiltradosPorSelecao, filtroAtivo, regionais, divisoes]);

  const loading = loadingIntegrantes || loadingDivisoes || loadingRegionais;

  return {
    integrantes: integrantesFiltradosPorSelecao,
    integrantesAgrupados,
    opcoesFiltragem,
    filtroAtivo,
    setFiltro: setFiltroAtivo,
    loading,
    nivelAcesso,
    comboDesabilitado
  };
};
