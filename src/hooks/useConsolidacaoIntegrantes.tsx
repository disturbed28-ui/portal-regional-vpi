import { useState, useCallback } from 'react';
import { consolidarArquivos, validarArquivos, ConsolidacaoResult, RegistroConsolidado } from '@/lib/consolidarArquivos';
import { processDelta, ProcessDeltaResult, ExcelIntegrante } from '@/lib/excelParser';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

/**
 * Interface para o estado do lote de processamento
 */
export interface LoteProcessamento {
  id: string;
  timestamp: Date;
  arquivoA: { nome: string; registros: number } | null;
  arquivoB: { nome: string; registros: number } | null;
  consolidacao: ConsolidacaoResult | null;
  delta: ProcessDeltaResult | null;
  selecao: {
    novos: Set<number>;      // registro_ids selecionados
    atualizados: Set<string>; // integrante ids selecionados
    removidos: Set<string>;   // integrante ids selecionados
  };
  modoSimulacao: boolean;
  etapa: 'inicial' | 'arquivos_carregados' | 'consolidado' | 'delta_gerado' | 'conferencia' | 'concluido';
}

/**
 * Interface para motivo de inativação
 */
export interface MotivoRemovido {
  integrante_id: string;
  registro_id: number;
  nome_colete: string;
  motivo_inativacao: 'transferido' | 'falecido' | 'desligado' | 'expulso' | 'afastado' | 'promovido' | 'outro';
  observacao_inativacao?: string;
}

/**
 * Hook para gerenciar o fluxo de consolidação e importação de integrantes
 */
export function useConsolidacaoIntegrantes(userId?: string) {
  const [loading, setLoading] = useState(false);
  const [lote, setLote] = useState<LoteProcessamento>({
    id: '',
    timestamp: new Date(),
    arquivoA: null,
    arquivoB: null,
    consolidacao: null,
    delta: null,
    selecao: {
      novos: new Set(),
      atualizados: new Set(),
      removidos: new Set()
    },
    modoSimulacao: true,
    etapa: 'inicial'
  });
  
  const [motivosRemovidos, setMotivosRemovidos] = useState<Map<string, MotivoRemovido>>(new Map());

  /**
   * Reset do estado
   */
  const resetar = useCallback(() => {
    setLote({
      id: '',
      timestamp: new Date(),
      arquivoA: null,
      arquivoB: null,
      consolidacao: null,
      delta: null,
      selecao: {
        novos: new Set(),
        atualizados: new Set(),
        removidos: new Set()
      },
      modoSimulacao: true,
      etapa: 'inicial'
    });
    setMotivosRemovidos(new Map());
  }, []);

  /**
   * Toggle modo simulação
   */
  const toggleModoSimulacao = useCallback(() => {
    setLote(prev => ({ ...prev, modoSimulacao: !prev.modoSimulacao }));
  }, []);

  /**
   * Processar arquivos (consolidação + delta)
   */
  const processarArquivos = useCallback(async (arquivoA: File, arquivoB: File) => {
    setLoading(true);
    
    try {
      // 1. Validar arquivos
      const validacao = validarArquivos(arquivoA, arquivoB);
      if (!validacao.valido) {
        toast({
          title: "Arquivos inválidos",
          description: validacao.erros.join('. '),
          variant: "destructive"
        });
        return false;
      }
      
      // 2. Consolidar arquivos (A + B)
      console.log('[useConsolidacaoIntegrantes] Iniciando consolidação...');
      const consolidacao = await consolidarArquivos(arquivoA, arquivoB);
      
      // 3. Buscar integrantes atuais do banco
      const { data: integrantesDB, error: dbError } = await supabase
        .from('integrantes_portal')
        .select('*')
        .eq('ativo', true);
      
      if (dbError) {
        throw new Error('Erro ao buscar integrantes: ' + dbError.message);
      }
      
      // 4. Converter registros consolidados para formato do Delta
      const registrosParaDelta: ExcelIntegrante[] = consolidacao.registros
        .filter(r => r.id_integrante > 0) // Apenas os encontrados
        .map(r => ({
          comando: r.comando,
          regional: r.regional,
          divisao: r.divisao,
          id_integrante: r.id_integrante,
          nome_colete: r.nome_colete,
          cargo_grau: r.cargo_grau,
          cargo_estagio: r.cargo_estagio,
          sgt_armas: r.sgt_armas,
          caveira: r.caveira,
          caveira_suplente: r.caveira_suplente,
          batedor: r.batedor,
          ursinho: r.ursinho,
          lobo: r.lobo,
          tem_moto: r.tem_moto,
          tem_carro: r.tem_carro,
          data_entrada: r.data_entrada
        }));
      
      // 5. Executar Delta
      console.log('[useConsolidacaoIntegrantes] Executando delta...');
      const delta = processDelta(registrosParaDelta, integrantesDB || [], integrantesDB || []);
      
      // 6. Inicializar seleções (todos marcados por padrão)
      const novosSelecionados = new Set(delta.novos.map(n => n.id_integrante));
      const atualizadosSelecionados = new Set(delta.atualizados.map(a => a.antigo.id));
      const removidosSelecionados = new Set(delta.removidos.map(r => r.id));
      
      // 7. Atualizar estado
      setLote({
        id: consolidacao.loteId,
        timestamp: consolidacao.timestamp,
        arquivoA: { nome: arquivoA.name, registros: consolidacao.estatisticas.totalArquivoA },
        arquivoB: { nome: arquivoB.name, registros: consolidacao.estatisticas.totalArquivoB },
        consolidacao,
        delta,
        selecao: {
          novos: novosSelecionados,
          atualizados: atualizadosSelecionados,
          removidos: removidosSelecionados
        },
        modoSimulacao: true,
        etapa: 'conferencia'
      });
      
      toast({
        title: "Processamento concluído",
        description: `${delta.novos.length} novos, ${delta.atualizados.length} alterados, ${delta.removidos.length} removidos`
      });
      
      return true;
      
    } catch (error) {
      console.error('[useConsolidacaoIntegrantes] Erro:', error);
      toast({
        title: "Erro no processamento",
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: "destructive"
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Toggle seleção de um item
   */
  const toggleSelecao = useCallback((tipo: 'novos' | 'atualizados' | 'removidos', id: number | string) => {
    setLote(prev => {
      const novaSelecao = { ...prev.selecao };
      
      if (tipo === 'novos') {
        const set = new Set(novaSelecao.novos);
        const numId = id as number;
        if (set.has(numId)) {
          set.delete(numId);
        } else {
          set.add(numId);
        }
        novaSelecao.novos = set;
      } else if (tipo === 'atualizados') {
        const set = new Set(novaSelecao.atualizados);
        const strId = id as string;
        if (set.has(strId)) {
          set.delete(strId);
        } else {
          set.add(strId);
        }
        novaSelecao.atualizados = set;
      } else {
        const set = new Set(novaSelecao.removidos);
        const strId = id as string;
        if (set.has(strId)) {
          set.delete(strId);
        } else {
          set.add(strId);
        }
        novaSelecao.removidos = set;
      }
      
      return { ...prev, selecao: novaSelecao };
    });
  }, []);

  /**
   * Marcar/desmarcar todos de um tipo
   */
  const toggleTodos = useCallback((tipo: 'novos' | 'atualizados' | 'removidos', marcar: boolean) => {
    setLote(prev => {
      if (!prev.delta) return prev;
      
      const novaSelecao = { ...prev.selecao };
      
      if (tipo === 'novos') {
        novaSelecao.novos = marcar 
          ? new Set(prev.delta.novos.map(n => n.id_integrante))
          : new Set();
      } else if (tipo === 'atualizados') {
        novaSelecao.atualizados = marcar
          ? new Set(prev.delta.atualizados.map(a => a.antigo.id))
          : new Set();
      } else {
        novaSelecao.removidos = marcar
          ? new Set(prev.delta.removidos.map(r => r.id))
          : new Set();
      }
      
      return { ...prev, selecao: novaSelecao };
    });
  }, []);

  /**
   * Definir motivo para um removido
   */
  const definirMotivoRemovido = useCallback((motivo: MotivoRemovido) => {
    setMotivosRemovidos(prev => {
      const novo = new Map(prev);
      novo.set(motivo.integrante_id, motivo);
      return novo;
    });
  }, []);

  /**
   * Executar importação
   */
  const executarImportacao = useCallback(async () => {
    if (!lote.delta || !userId) {
      toast({
        title: "Erro",
        description: "Dados insuficientes para importação",
        variant: "destructive"
      });
      return false;
    }
    
    if (lote.modoSimulacao) {
      toast({
        title: "Modo Simulação",
        description: "Nenhum dado foi gravado. Desative o modo simulação para importar.",
      });
      return true;
    }
    
    setLoading(true);
    
    try {
      // Filtrar apenas itens selecionados
      const novosParaImportar = lote.delta.novos.filter(n => lote.selecao.novos.has(n.id_integrante));
      const atualizadosParaImportar = lote.delta.atualizados.filter(a => lote.selecao.atualizados.has(a.antigo.id));
      const removidosParaImportar = lote.delta.removidos
        .filter(r => lote.selecao.removidos.has(r.id))
        .map(r => {
          const motivo = motivosRemovidos.get(r.id);
          return {
            integrante_id: r.id,
            registro_id: r.registro_id,
            nome_colete: r.nome_colete,
            motivo_inativacao: motivo?.motivo_inativacao || 'outro',
            observacao_inativacao: motivo?.observacao_inativacao || `Lote ${lote.id}`
          };
        });
      
      // Verificar se todos os removidos têm motivo
      const removidosSemMotivo = removidosParaImportar.filter(r => !motivosRemovidos.has(r.integrante_id));
      if (removidosSemMotivo.length > 0) {
        toast({
          title: "Motivos pendentes",
          description: `${removidosSemMotivo.length} integrante(s) a remover sem motivo definido`,
          variant: "destructive"
        });
        return false;
      }
      
      // Formatar atualizados para a edge function
      const atualizadosFormatados = atualizadosParaImportar.map(a => ({
        id: a.antigo.id,
        registro_id: a.novo.id_integrante,
        nome_colete: a.novo.nome_colete,
        comando_texto: a.novo.comando,
        regional_texto: a.novo.regional,
        divisao_texto: a.novo.divisao,
        cargo_grau_texto: a.novo.cargo_grau,
        cargo_estagio: a.novo.cargo_estagio || null,
        sgt_armas: a.novo.sgt_armas || false,
        caveira: a.novo.caveira || false,
        caveira_suplente: a.novo.caveira_suplente || false,
        batedor: a.novo.batedor || false,
        ursinho: a.novo.ursinho || false,
        lobo: a.novo.lobo || false,
        tem_moto: a.novo.tem_moto || false,
        tem_carro: a.novo.tem_carro || false,
        data_entrada: a.novo.data_entrada || null
      }));
      
      // Formatar novos para a edge function
      const novosFormatados = novosParaImportar.map(n => ({
        registro_id: n.id_integrante,
        nome_colete: n.nome_colete,
        comando_texto: n.comando,
        regional_texto: n.regional,
        divisao_texto: n.divisao,
        cargo_grau_texto: n.cargo_grau,
        cargo_estagio: n.cargo_estagio || null,
        sgt_armas: n.sgt_armas || false,
        caveira: n.caveira || false,
        caveira_suplente: n.caveira_suplente || false,
        batedor: n.batedor || false,
        ursinho: n.ursinho || false,
        lobo: n.lobo || false,
        tem_moto: n.tem_moto || false,
        tem_carro: n.tem_carro || false,
        data_entrada: n.data_entrada || null,
        ativo: true
      }));
      
      console.log('[useConsolidacaoIntegrantes] Enviando para edge function:', {
        novos: novosFormatados.length,
        atualizados: atualizadosFormatados.length,
        removidos: removidosParaImportar.length,
        loteId: lote.id
      });
      
      // Chamar edge function
      const { data, error } = await supabase.functions.invoke('admin-import-integrantes', {
        body: {
          admin_user_id: userId,
          novos: novosFormatados,
          atualizados: atualizadosFormatados,
          removidos: removidosParaImportar,
          lote_id: lote.id
        }
      });
      
      if (error) {
        throw new Error(error.message);
      }
      
      setLote(prev => ({ ...prev, etapa: 'concluido' }));
      
      toast({
        title: "Importação concluída",
        description: `${data.insertedCount} novos, ${data.updatedCount} atualizados. Lote: ${lote.id}`
      });
      
      return true;
      
    } catch (error) {
      console.error('[useConsolidacaoIntegrantes] Erro na importação:', error);
      toast({
        title: "Erro na importação",
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: "destructive"
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, [lote, userId, motivosRemovidos]);

  /**
   * Obter dados para exportação
   */
  const obterDadosExportacao = useCallback(() => {
    if (!lote.delta || !lote.consolidacao) return [];
    
    const dados: any[] = [];
    
    // Novos selecionados
    lote.delta.novos
      .filter(n => lote.selecao.novos.has(n.id_integrante))
      .forEach(n => {
        dados.push({
          acao: 'NOVO',
          id_integrante: n.id_integrante,
          nome_colete: n.nome_colete,
          comando: n.comando,
          regional: n.regional,
          divisao: n.divisao,
          cargo_grau: n.cargo_grau,
          cargo_estagio: n.cargo_estagio || '',
          sgt_armas: n.sgt_armas ? 'S' : 'N',
          caveira: n.caveira ? 'S' : 'N',
          batedor: n.batedor ? 'S' : 'N',
          lobo: n.lobo ? 'S' : 'N',
          data_entrada: n.data_entrada || ''
        });
      });
    
    // Atualizados selecionados
    lote.delta.atualizados
      .filter(a => lote.selecao.atualizados.has(a.antigo.id))
      .forEach(a => {
        dados.push({
          acao: 'ATUALIZADO',
          id_integrante: a.novo.id_integrante,
          nome_colete: a.novo.nome_colete,
          comando: a.novo.comando,
          regional: a.novo.regional,
          divisao: a.novo.divisao,
          cargo_grau: a.novo.cargo_grau,
          cargo_estagio: a.novo.cargo_estagio || '',
          sgt_armas: a.novo.sgt_armas ? 'S' : 'N',
          caveira: a.novo.caveira ? 'S' : 'N',
          batedor: a.novo.batedor ? 'S' : 'N',
          lobo: a.novo.lobo ? 'S' : 'N',
          data_entrada: a.novo.data_entrada || ''
        });
      });
    
    // Removidos selecionados
    lote.delta.removidos
      .filter(r => lote.selecao.removidos.has(r.id))
      .forEach(r => {
        const motivo = motivosRemovidos.get(r.id);
        dados.push({
          acao: 'REMOVIDO',
          id_integrante: r.registro_id,
          nome_colete: r.nome_colete,
          comando: r.comando_texto,
          regional: r.regional_texto,
          divisao: r.divisao_texto,
          cargo_grau: r.cargo_grau_texto,
          cargo_estagio: '',
          motivo: motivo?.motivo_inativacao || 'pendente',
          observacao: motivo?.observacao_inativacao || ''
        });
      });
    
    return dados;
  }, [lote, motivosRemovidos]);

  return {
    lote,
    loading,
    motivosRemovidos,
    processarArquivos,
    toggleSelecao,
    toggleTodos,
    toggleModoSimulacao,
    definirMotivoRemovido,
    executarImportacao,
    obterDadosExportacao,
    resetar
  };
}
