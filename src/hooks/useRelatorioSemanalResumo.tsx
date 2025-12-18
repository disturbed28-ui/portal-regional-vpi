import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DivisaoRelatorio, TotaisRelatorio } from './useRelatorioData';
import { normalizeText } from '@/lib/normalizeText';

interface RelatorioSemanalResumoData {
  divisoes: DivisaoRelatorio[];
  totais: TotaisRelatorio;
  dataCarga?: string;
}

export const useRelatorioSemanalResumo = (regionalId: string, ano?: number, mes?: number, semana?: number) => {
  return useQuery({
    queryKey: ['relatorio-semanal-resumo', regionalId, ano, mes, semana],
    queryFn: async (): Promise<RelatorioSemanalResumoData> => {
      // 1. Buscar última carga histórica
      const { data: ultimaCarga } = await supabase
        .from('cargas_historico')
        .select('*')
        .order('data_carga', { ascending: false })
        .limit(1)
        .maybeSingle();

      // 2. Buscar última carga do MÊS ANTERIOR (usar data_carga)
      const hoje = new Date();
      const primeiroDiaMesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
      const ultimoDiaMesAnterior = new Date(hoje.getFullYear(), hoje.getMonth(), 0, 23, 59, 59);
      
      const { data: cargaMesAnterior } = await supabase
        .from('cargas_historico')
        .select('*')
        .eq('tipo_carga', 'integrantes')
        .gte('data_carga', primeiroDiaMesAnterior.toISOString())
        .lte('data_carga', ultimoDiaMesAnterior.toISOString())
        .order('data_carga', { ascending: false })
        .limit(1)
        .maybeSingle();

      // 2.1. Buscar nomes e nomes_ascii das divisões da regional para filtrar snapshot
      const { data: divisoesRegional } = await supabase
        .from('divisoes')
        .select('nome, nome_ascii')
        .eq('regional_id', regionalId);

      // Criar mapa de todas as formas do nome -> nome canônico (para lookup normalizado)
      const mapNomesParaRegional = new Map<string, string>();
      divisoesRegional?.forEach(d => {
        // Adicionar nome original (uppercase)
        if (d.nome) {
          mapNomesParaRegional.set(d.nome.toUpperCase(), d.nome);
        }
        // Adicionar nome_ascii (uppercase)
        if (d.nome_ascii) {
          mapNomesParaRegional.set(d.nome_ascii.toUpperCase(), d.nome);
        }
        // Adicionar nome normalizado sem acentos (uppercase)
        if (d.nome) {
          mapNomesParaRegional.set(normalizeText(d.nome).toUpperCase(), d.nome);
        }
      });

      // 3. Buscar integrantes atuais filtrados por regional_id
      const { data: integrantesAtuais = [] } = await supabase
        .from('integrantes_portal')
        .select('*')
        .eq('ativo', true)
        .eq('regional_id', regionalId);

      // 4. Buscar relatórios semanais do período (para entradas/saídas)
      let relatoriosSemanais: any[] = [];
      if (ano && mes && semana) {
        const { data: relatoriosData = [] } = await supabase
          .from('relatorios_semanais_divisao')
          .select('divisao_relatorio_texto, entradas_json, saidas_json')
          .eq('regional_relatorio_id', regionalId)
          .eq('ano_referencia', ano)
          .eq('mes_referencia', mes)
          .eq('semana_no_mes', semana);
        relatoriosSemanais = relatoriosData;
      }

      // 5. Buscar apenas mensalidades ATIVAS e NÃO LIQUIDADAS
      const { data: mensalidadesData = [] } = await supabase
        .from('mensalidades_atraso')
        .select('*')
        .eq('ativo', true)
        .eq('liquidado', false);

      // Processar dados - usar divisoes do snapshot (para compatibilidade com cargas antigas)
      const snapshotAnterior = cargaMesAnterior?.dados_snapshot as any;
      const divisoesSnapshot = snapshotAnterior?.divisoes || [];
      
      // Mapear total anterior por divisão (usando chave MAIÚSCULA para match com divisao_texto)
      const totaisPorDivisao = new Map<string, number>();
      divisoesSnapshot.forEach((d: any) => {
        const nomeSnapshotUpper = d.divisao?.toUpperCase();
        const nomeSnapshotNormalizado = normalizeText(d.divisao)?.toUpperCase();
        
        // Verifica se pertence à regional usando TODAS as formas do nome
        if (mapNomesParaRegional.has(nomeSnapshotUpper) || mapNomesParaRegional.has(nomeSnapshotNormalizado)) {
          totaisPorDivisao.set(nomeSnapshotUpper, d.total || 0);
        }
      });

      // Fallback: tentar integrantes se divisoes não existir (cargas mais novas)
      const integrantesAnteriores = (snapshotAnterior?.integrantes || []).filter(
        (i: any) => i.regional_id === regionalId
      );
      
      // Agrupar por divisão
      const divisoesMap = new Map<string, DivisaoRelatorio>();

      // Filtrar integrantes de Grau V (que têm divisao_texto = nome da Regional) antes de agrupar
      const integrantesParaAgrupar = integrantesAtuais.filter(integrante => {
        const divisaoTexto = integrante.divisao_texto?.toUpperCase() || '';
        // Excluir integrantes cuja "divisão" é na verdade uma regional (Grau V)
        return !divisaoTexto.startsWith('REGIONAL');
      });

      // Inicializar divisões com integrantes atuais (normalizando divisao_texto para evitar duplicações)
      integrantesParaAgrupar.forEach((integrante) => {
        const divisaoTextoOriginal = integrante.divisao_texto;
        const divisaoNormalizada = divisaoTextoOriginal?.toUpperCase().trim() || 'SEM DIVISÃO';
        
        // Usar nome canônico se existir, senão usar versão normalizada
        const divisaoCanonica = mapNomesParaRegional.get(divisaoNormalizada) 
                             || mapNomesParaRegional.get(normalizeText(divisaoTextoOriginal)?.toUpperCase())
                             || divisaoTextoOriginal;
        
        if (!divisoesMap.has(divisaoCanonica)) {
          divisoesMap.set(divisaoCanonica, {
            nome: divisaoCanonica,
            entrada: 0,
            saida: 0,
            saldo: 0,
            total_anterior: 0,
            total_atual: 0,
            sem_veiculo: 0,
            com_moto: 0,
            com_carro: 0,
            sgt_armas: 0,
            combate_insano: 0,
            batedores: 0,
            caveiras: 0,
            caveiras_suplentes: 0,
            devedores: 0,
          });
        }

        const divisaoData = divisoesMap.get(divisaoCanonica)!;
        divisaoData.total_atual++;

        // Veículos (prioridade: moto > carro > sem veículo)
        if (integrante.tem_moto) {
          divisaoData.com_moto++;
        } else if (integrante.tem_carro) {
          divisaoData.com_carro++;
        } else {
          divisaoData.sem_veiculo++;
        }

        // Times especiais
        if (integrante.sgt_armas) divisaoData.sgt_armas++;
        if (integrante.combate_insano) divisaoData.combate_insano++;
        if (integrante.batedor) divisaoData.batedores++;
        if (integrante.caveira) divisaoData.caveiras++;
        if (integrante.caveira_suplente) divisaoData.caveiras_suplentes++;
      });

      // Mapear entradas/saídas dos relatórios semanais por divisão
      const entradasSaidasPorDivisao = new Map<string, { entradas: number; saidas: number }>();
      relatoriosSemanais.forEach((rel: any) => {
        const divisao = rel.divisao_relatorio_texto?.toUpperCase();
        if (divisao) {
          entradasSaidasPorDivisao.set(divisao, {
            entradas: (rel.entradas_json || []).length,
            saidas: (rel.saidas_json || []).length
          });
        }
      });

      // Calcular totais anteriores
      const idsAtuais = new Set(integrantesAtuais.map((i) => i.registro_id));
      const idsAnteriores = new Set(integrantesAnteriores.map((i: any) => i.registro_id));

      // Se temos totais do snapshot, usar diretamente
      if (totaisPorDivisao.size > 0) {
        divisoesMap.forEach((divisaoData, nomeDivisao) => {
          divisaoData.total_anterior = totaisPorDivisao.get(nomeDivisao) || 0;
        });
      }

      // Se temos integrantes anteriores, processar normalmente
      integrantesAnteriores.forEach((integrante: any) => {
        const divisao = integrante.divisao_texto;
        if (!divisoesMap.has(divisao)) {
          divisoesMap.set(divisao, {
            nome: divisao,
            entrada: 0,
            saida: 0,
            saldo: 0,
            total_anterior: 0,
            total_atual: 0,
            sem_veiculo: 0,
            com_moto: 0,
            com_carro: 0,
            sgt_armas: 0,
            combate_insano: 0,
            batedores: 0,
            caveiras: 0,
            caveiras_suplentes: 0,
            devedores: 0,
          });
        }

        const divisaoData = divisoesMap.get(divisao)!;
        
        // Se não temos totais do snapshot, contar manualmente
        if (totaisPorDivisao.size === 0) {
          divisaoData.total_anterior++;
        }
      });

      // Preencher entradas/saídas dos relatórios semanais (se existirem)
      divisoesMap.forEach((divisaoData, nomeDivisao) => {
        const dados = entradasSaidasPorDivisao.get(nomeDivisao);
        if (dados) {
          divisaoData.entrada = dados.entradas;
          divisaoData.saida = dados.saidas;
        }
      });

      // Calcular devedores ÚNICOS por divisão (usando normalização)
      const devedoresPorDivisao = new Map<string, Set<number>>();
      mensalidadesData.forEach((m) => {
        // Usar integrantesParaAgrupar (exclui Grau V)
        const integrante = integrantesParaAgrupar.find(i => i.registro_id === m.registro_id);
        
        if (integrante) {
          const divisaoTextoOriginal = integrante.divisao_texto;
          const divisaoNormalizada = divisaoTextoOriginal?.toUpperCase().trim() || 'SEM DIVISÃO';
          
          // Usar nome canônico se existir
          const divisaoCanonica = mapNomesParaRegional.get(divisaoNormalizada) 
                               || mapNomesParaRegional.get(normalizeText(divisaoTextoOriginal)?.toUpperCase())
                               || divisaoTextoOriginal;
          
          if (!devedoresPorDivisao.has(divisaoCanonica)) {
            devedoresPorDivisao.set(divisaoCanonica, new Set());
          }
          devedoresPorDivisao.get(divisaoCanonica)!.add(m.registro_id);
        }
      });

      // Atualizar contagem de devedores em cada divisão
      devedoresPorDivisao.forEach((devedoresSet, divisao) => {
        if (divisoesMap.has(divisao)) {
          divisoesMap.get(divisao)!.devedores = devedoresSet.size;
        }
      });

      // Calcular saldo
      divisoesMap.forEach((divisao) => {
        divisao.saldo = divisao.entrada - divisao.saida;
      });

      // Converter para array e calcular totais
      const divisoes = Array.from(divisoesMap.values()).sort((a, b) =>
        a.nome.localeCompare(b.nome)
      );

      const totais: TotaisRelatorio = divisoes.reduce(
        (acc, div) => ({
          entrada: acc.entrada + div.entrada,
          saida: acc.saida + div.saida,
          saldo: acc.saldo + div.saldo,
          total_anterior: acc.total_anterior + div.total_anterior,
          total_atual: acc.total_atual + div.total_atual,
          sem_veiculo: acc.sem_veiculo + div.sem_veiculo,
          com_moto: acc.com_moto + div.com_moto,
          com_carro: acc.com_carro + div.com_carro,
          sgt_armas: acc.sgt_armas + div.sgt_armas,
          combate_insano: acc.combate_insano + div.combate_insano,
          batedores: acc.batedores + div.batedores,
          caveiras: acc.caveiras + div.caveiras,
          caveiras_suplentes: acc.caveiras_suplentes + div.caveiras_suplentes,
          devedores: acc.devedores + div.devedores,
        }),
        {
          entrada: 0,
          saida: 0,
          saldo: 0,
          total_anterior: 0,
          total_atual: 0,
          sem_veiculo: 0,
          com_moto: 0,
          com_carro: 0,
          sgt_armas: 0,
          combate_insano: 0,
          batedores: 0,
          caveiras: 0,
          caveiras_suplentes: 0,
          devedores: 0,
        }
      );

      return {
        divisoes,
        totais,
        dataCarga: ultimaCarga?.data_carga,
      };
    },
    enabled: !!regionalId,
  });
};
