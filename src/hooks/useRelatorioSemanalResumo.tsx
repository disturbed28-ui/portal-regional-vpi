import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DivisaoRelatorio, TotaisRelatorio } from './useRelatorioData';

interface RelatorioSemanalResumoData {
  divisoes: DivisaoRelatorio[];
  totais: TotaisRelatorio;
  dataCarga?: string;
}

export const useRelatorioSemanalResumo = (regionalId: string) => {
  return useQuery({
    queryKey: ['relatorio-semanal-resumo', regionalId],
    queryFn: async (): Promise<RelatorioSemanalResumoData> => {
      // 1. Buscar última carga histórica
      const { data: ultimaCarga } = await supabase
        .from('cargas_historico')
        .select('*')
        .order('data_carga', { ascending: false })
        .limit(1)
        .maybeSingle();

      // 2. Buscar última carga do MÊS ANTERIOR
      const hoje = new Date();
      const mesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
      const fimMesAnterior = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
      
      const { data: cargaMesAnterior } = await supabase
        .from('cargas_historico')
        .select('*')
        .eq('tipo_carga', 'integrantes')
        .gte('data_carga', mesAnterior.toISOString())
        .lte('data_carga', fimMesAnterior.toISOString())
        .order('data_carga', { ascending: false })
        .limit(1)
        .maybeSingle();

      // 3. Buscar integrantes atuais filtrados por regional_id
      const { data: integrantesAtuais = [] } = await supabase
        .from('integrantes_portal')
        .select('*')
        .eq('ativo', true)
        .eq('regional_id', regionalId);

      // 4. Buscar apenas mensalidades ATIVAS e NÃO LIQUIDADAS
      const { data: mensalidadesData = [] } = await supabase
        .from('mensalidades_atraso')
        .select('*')
        .eq('ativo', true)
        .eq('liquidado', false);

      // Processar dados
      const snapshotAnterior = cargaMesAnterior?.dados_snapshot as any;
      const integrantesAnteriores = (snapshotAnterior?.integrantes || []).filter(
        (i: any) => i.regional_id === regionalId
      );
      
      // Agrupar por divisão
      const divisoesMap = new Map<string, DivisaoRelatorio>();

      // Inicializar divisões com integrantes atuais
      integrantesAtuais.forEach((integrante) => {
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

      // Calcular totais anteriores e entradas/saídas
      const idsAtuais = new Set(integrantesAtuais.map((i) => i.registro_id));
      const idsAnteriores = new Set(integrantesAnteriores.map((i: any) => i.registro_id));

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
        divisaoData.total_anterior++;

        // Calcular saídas
        if (!idsAtuais.has(integrante.registro_id)) {
          divisaoData.saida++;
        }
      });

      // Calcular entradas
      integrantesAtuais.forEach((integrante) => {
        if (!idsAnteriores.has(integrante.registro_id)) {
          const divisaoData = divisoesMap.get(integrante.divisao_texto)!;
          divisaoData.entrada++;
        }
      });

      // Calcular devedores ÚNICOS por divisão
      const devedoresPorDivisao = new Map<string, Set<number>>();
      mensalidadesData.forEach((m) => {
        const integrante = integrantesAtuais.find(i => i.registro_id === m.registro_id);
        
        if (integrante) {
          const divisao = integrante.divisao_texto;
          if (!devedoresPorDivisao.has(divisao)) {
            devedoresPorDivisao.set(divisao, new Set());
          }
          devedoresPorDivisao.get(divisao)!.add(m.registro_id);
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
