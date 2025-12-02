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
  const { integrantes: todosIntegrantes, loading: loadingIntegrantes } = useIntegrantes({ ativo: true });
  const { divisoes, loading: loadingDivisoes } = useDivisoes();
  const { regionais, loading: loadingRegionais } = useRegionais();
  
  const [filtroAtivo, setFiltroAtivo] = useState<string>('');

  // Determinar nível de acesso baseado no grau
  const nivelAcesso = useMemo(() => {
    return getNivelAcesso(profile?.grau);
  }, [profile?.grau]);

  // Determinar se combo deve estar desabilitado (Grau VI+)
  const comboDesabilitado = nivelAcesso === 'divisao';

  // Função de ordenação hierárquica (mesma lógica do organograma)
  const ordenarIntegrantes = (a: any, b: any) => {
    // 1. Por cargo
    const ordemCargos: Record<string, number> = {
      // Regional (Grau V)
      'Diretor Regional': 1,
      'Operacional Regional': 2,
      'Social Regional': 3,
      'Adm. Regional': 4,
      'Comunicação': 5,
      // Divisão (Grau VI)
      'Diretor Divisão': 10,
      'Sub Diretor Divisão': 11,
      'Social Divisão': 12,
      'Adm. Divisão': 13,
      'Sgt.Armas Divisão': 14,
      'Sgt Armas Full': 15,
      'Sgt Armas PP': 16,
    };
    const cargoA = ordemCargos[a.cargo_nome || ''] || 99;
    const cargoB = ordemCargos[b.cargo_nome || ''] || 99;
    if (cargoA !== cargoB) return cargoA - cargoB;
    
    // 2. Por grau
    const grauA = romanToNumber(a.grau);
    const grauB = romanToNumber(b.grau);
    if (grauA !== grauB) return grauA - grauB;
    
    // 3. Por data de entrada (mais antigo primeiro)
    const dataA = a.data_entrada ? new Date(a.data_entrada).getTime() : Infinity;
    const dataB = b.data_entrada ? new Date(b.data_entrada).getTime() : Infinity;
    if (dataA !== dataB) return dataA - dataB;
    
    // 4. Por nome (desempate final)
    return (a.nome_colete || '').localeCompare(b.nome_colete || '');
  };

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

    // Aplicar ordenação hierárquica
    return filtrados.sort(ordenarIntegrantes);
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
      opcoes.push({ value: 'todos', label: 'Todos', tipo: 'todos' });
      
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

  // Não setar filtro inicial automaticamente - deixar vazio para placeholder

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

    if (!filtroAtivo || filtroAtivo === 'todos') {
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
            integrantes: integrantesRegional.sort(ordenarIntegrantes)
          });
        }

        // Divisões dessa regional
        const divisoesRegional = divisoes.filter(d => d.regional_id === regional.id);
        divisoesRegional.forEach(divisao => {
          const integrantesDivisao = integrantesFiltradosPorSelecao.filter(
            i => i.divisao_id === divisao.id && i.divisao_texto !== i.regional_texto
          );

          if (integrantesDivisao.length > 0) {
            grupos.push({
              tipo: 'divisao',
              id: divisao.id,
              nome: divisao.nome,
              integrantes: integrantesDivisao.sort(ordenarIntegrantes)
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

      const grupos: IntegranteAgrupado[] = [];
      
      // 1. Bloco da Regional (quem está diretamente nela)
      const integrantesRegional = integrantesFiltradosPorSelecao.filter(
        i => i.divisao_texto === i.regional_texto
      );
      
      if (integrantesRegional.length > 0) {
        grupos.push({
          tipo: 'regional',
          id: regional.id,
          nome: regional.nome,
          integrantes: integrantesRegional.sort(ordenarIntegrantes)
        });
      }
      
      // 2. Blocos das Divisões dessa Regional
      const divisoesRegional = divisoes.filter(d => d.regional_id === id);
      divisoesRegional.forEach(divisao => {
        const integrantesDivisao = integrantesFiltradosPorSelecao.filter(
          i => i.divisao_id === divisao.id && i.divisao_texto !== i.regional_texto
        );
        
        if (integrantesDivisao.length > 0) {
          grupos.push({
            tipo: 'divisao',
            id: divisao.id,
            nome: divisao.nome,
            integrantes: integrantesDivisao.sort(ordenarIntegrantes)
          });
        }
      });
      
      return grupos;
    }

    if (tipo === 'divisao') {
      const divisao = divisoes.find(d => d.id === id);
      if (!divisao) return [];

      return [{
        tipo: 'divisao',
        id: divisao.id,
        nome: divisao.nome,
        integrantes: integrantesFiltradosPorSelecao.sort(ordenarIntegrantes)
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
