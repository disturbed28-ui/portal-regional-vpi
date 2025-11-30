import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DivisaoRelatorio {
  nome: string;
  entrada: number;
  saida: number;
  saldo: number;
  total_anterior: number;
  total_atual: number;
  sem_veiculo: number;
  com_moto: number;
  com_carro: number;
  sgt_armas: number;
  combate_insano: number;
  batedores: number;
  caveiras: number;
  caveiras_suplentes: number;
  devedores: number;
}

export interface TotaisRelatorio {
  entrada: number;
  saida: number;
  saldo: number;
  total_anterior: number;
  total_atual: number;
  sem_veiculo: number;
  com_moto: number;
  com_carro: number;
  sgt_armas: number;
  combate_insano: number;
  batedores: number;
  caveiras: number;
  caveiras_suplentes: number;
  devedores: number;
}

export interface RelatorioData {
  divisoes: DivisaoRelatorio[];
  totais: TotaisRelatorio;
  dataCarga?: string;
}

export const useRelatorioData = (regionalTexto?: string) => {
  return useQuery({
    queryKey: ['relatorio-data', regionalTexto],
    queryFn: async (): Promise<RelatorioData> => {
      // 1. Buscar última carga histórica
      const { data: ultimaCarga, error: erroUltimaCarga } = await supabase
        .from('cargas_historico')
        .select('*')
        .order('data_carga', { ascending: false })
        .limit(1)
        .maybeSingle();

      // 2. Buscar última carga do MÊS ANTERIOR (usar data_carga)
      const hoje = new Date();
      const primeiroDiaMesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
      const ultimoDiaMesAnterior = new Date(hoje.getFullYear(), hoje.getMonth(), 0, 23, 59, 59);
      
      const { data: penultimaCarga } = await supabase
        .from('cargas_historico')
        .select('*')
        .eq('tipo_carga', 'integrantes')
        .gte('data_carga', primeiroDiaMesAnterior.toISOString())
        .lte('data_carga', ultimoDiaMesAnterior.toISOString())
        .order('data_carga', { ascending: false })
        .limit(1)
        .maybeSingle();

      // 3. Buscar integrantes atuais
      let queryAtual = supabase
        .from('integrantes_portal')
        .select('*')
        .eq('ativo', true);

      if (regionalTexto) {
        queryAtual = queryAtual.eq('regional_texto', regionalTexto);
      }

      const { data: integrantesAtuais = [] } = await queryAtual;

      // 4. Buscar apenas mensalidades ATIVAS e NÃO LIQUIDADAS
      const { data: mensalidadesData = [] } = await supabase
        .from('mensalidades_atraso')
        .select('*')
        .eq('ativo', true)
        .eq('liquidado', false);

      // Processar dados - usar divisoes do snapshot (para compatibilidade com cargas antigas)
      const snapshotAnterior = penultimaCarga?.dados_snapshot as any;
      const divisoesSnapshot = snapshotAnterior?.divisoes || [];
      
      // Mapear total anterior por divisão
      const totaisPorDivisao = new Map<string, number>();
      divisoesSnapshot.forEach((d: any) => {
        totaisPorDivisao.set(d.divisao, d.total || 0);
      });

      // Fallback: tentar integrantes se divisoes não existir
      const integrantesAnteriores = snapshotAnterior?.integrantes || [];
      
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

      // Calcular devedores ÚNICOS por divisão usando registro_id do integrante atual
      const devedoresPorDivisao = new Map<string, Set<number>>();
      mensalidadesData.forEach((m) => {
        // Buscar integrante atual pelo registro_id
        const integrante = integrantesAtuais.find(i => i.registro_id === m.registro_id);
        
        if (integrante) {
          const divisao = integrante.divisao_texto; // Usar divisão do integrante atual
          if (!devedoresPorDivisao.has(divisao)) {
            devedoresPorDivisao.set(divisao, new Set());
          }
          // Usar Set para garantir unicidade por registro_id
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
    enabled: true,
  });
};
