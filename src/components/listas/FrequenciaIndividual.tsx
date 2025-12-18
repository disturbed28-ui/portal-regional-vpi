import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar as CalendarIcon, ChevronDown, Download, Users } from "lucide-react";
import { format, subMonths, startOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useFrequenciaPonderada, IntegranteFrequencia } from "@/hooks/useFrequenciaPonderada";
import { useDivisoes } from "@/hooks/useDivisoes";
import { useDivisoesPorRegional } from "@/hooks/useDivisoesPorRegional";
import { useRegionais } from "@/hooks/useRegionais";
import { getNivelAcesso, romanToNumber } from "@/lib/grauUtils";
import { cn } from "@/lib/utils";
import * as XLSX from 'xlsx';

interface FrequenciaIndividualProps {
  grau?: string | null;
  regionalId?: string | null;
  divisaoId?: string | null;
  isAdmin?: boolean;
}

type PeriodoPreset = 'ultimo_mes' | 'ultimos_3_meses' | 'ano_atual' | 'personalizado';

interface GrupoFrequencia {
  tipo: 'regional' | 'divisao';
  id: string;
  nome: string;
  integrantes: IntegranteFrequencia[];
}

export const FrequenciaIndividual = ({ grau, regionalId, divisaoId, isAdmin = false }: FrequenciaIndividualProps) => {
  const hoje = new Date();
  const [periodoPreset, setPeriodoPreset] = useState<PeriodoPreset>('ultimo_mes');
  const [dataInicio, setDataInicio] = useState<Date>(subMonths(hoje, 1));
  const [dataFim, setDataFim] = useState<Date>(hoje);
  const [divisaoSelecionada, setDivisaoSelecionada] = useState<string>('todas');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Determinar nível de acesso
  const nivelAcesso = getNivelAcesso(grau);

  // Buscar todas as divisões (para admin ou CMD)
  const { divisoes: todasDivisoes } = useDivisoes();
  
  // Buscar regionais
  const { regionais } = useRegionais();
  
  // Buscar divisões da regional (para graus V)
  const { divisoes: divisoesDaRegional, divisaoIds: divisaoIdsDaRegional } = useDivisoesPorRegional(
    nivelAcesso === 'regional' ? regionalId : null
  );

  // Determinar quais IDs de divisão usar para filtrar EVENTOS
  // IMPORTANTE: Quando uma divisão é selecionada no filtro, NÃO filtrar eventos por ela
  // O filtro será feito por INTEGRANTES da divisão (integrantesDivisaoId)
  const divisaoIdsParaFiltro = useMemo(() => {
    // Se uma divisão específica foi selecionada, NÃO usar para filtrar eventos
    // Os integrantes podem ter participado de eventos de outras divisões
    if (divisaoSelecionada && divisaoSelecionada !== 'todas') {
      // Admin/CMD: buscar todos eventos
      if (isAdmin || nivelAcesso === 'comando') {
        return undefined;
      }
      // Regional: buscar eventos da regional toda
      if (nivelAcesso === 'regional' && divisaoIdsDaRegional.length > 0) {
        return divisaoIdsDaRegional;
      }
      // Fallback: não filtrar eventos
      return undefined;
    }
    
    // Admin ou CMD: sem filtro (undefined = todos)
    if (isAdmin || nivelAcesso === 'comando') {
      return undefined;
    }
    
    // Grau VI (divisao): NÃO filtrar eventos por divisão
    // Os integrantes podem ter participado de eventos de outras divisões
    // O filtro será feito por integrantesDivisaoId
    if (nivelAcesso === 'divisao') {
      return undefined;
    }
    
    // Grau V (regional): todas as divisões da regional
    if (nivelAcesso === 'regional' && divisaoIdsDaRegional.length > 0) {
      return divisaoIdsDaRegional;
    }
    
    // Fallback
    return divisaoId ? [divisaoId] : undefined;
  }, [divisaoSelecionada, isAdmin, nivelAcesso, divisaoId, divisaoIdsDaRegional]);

  // Filtrar por INTEGRANTES da divisão (não por eventos da divisão)
  // Prioridade: divisão selecionada no filtro > divisão do usuário (Grau VI)
  const integrantesDivisaoIdParaFiltro = useMemo(() => {
    // Se uma divisão específica foi selecionada no filtro, usar ela
    if (divisaoSelecionada && divisaoSelecionada !== 'todas') {
      return divisaoSelecionada;
    }
    // Grau VI: filtrar por integrantes da sua divisão automaticamente
    if (nivelAcesso === 'divisao' && divisaoId) {
      return divisaoId;
    }
    return null;
  }, [divisaoSelecionada, nivelAcesso, divisaoId]);

  // Determinar quais divisões mostrar no seletor
  // IMPORTANTE: Priorizar nivelAcesso sobre isAdmin para que Grau V veja apenas divisões da sua regional
  const divisoesParaSelecao = useMemo(() => {
    // Grau VI: não mostrar seletor (apenas sua divisão)
    if (nivelAcesso === 'divisao') {
      return [];
    }
    
    // Grau V (Regional): apenas divisões da sua regional (independente de role admin)
    if (nivelAcesso === 'regional') {
      return divisoesDaRegional;
    }
    
    // CMD (Graus I-IV) ou Admin sem grau definido: todas as divisões
    if (isAdmin || nivelAcesso === 'comando') {
      return todasDivisoes || [];
    }
    
    return [];
  }, [nivelAcesso, isAdmin, todasDivisoes, divisoesDaRegional]);

  // Determinar se deve filtrar por regional (para usuários não admin/comando)
  const regionalIdParaFiltro = useMemo(() => {
    if (isAdmin || nivelAcesso === 'comando') {
      return null; // Admin/CMD vê tudo
    }
    return regionalId || null;
  }, [isAdmin, nivelAcesso, regionalId]);

  const { data: dadosFrequencia, isLoading } = useFrequenciaPonderada({
    dataInicio,
    dataFim,
    divisaoIds: divisaoIdsParaFiltro,
    regionalId: regionalIdParaFiltro,
    integrantesDivisaoId: integrantesDivisaoIdParaFiltro,
  });

  // Agrupar dados conforme nível de acesso (mesmo padrão do IntegrantesTab/useIntegrantesRelatorio)
  const dadosAgrupados = useMemo((): GrupoFrequencia[] => {
    if (!dadosFrequencia || !regionais || !todasDivisoes) return [];

    const grupos: GrupoFrequencia[] = [];

    // CMD (Graus I-IV) ou Admin: agrupar por Regional/Divisão
    if (isAdmin || nivelAcesso === 'comando') {
      regionais.forEach(regional => {
        // Integrantes que estão na Regional (divisao_texto === regional_texto)
        const integrantesRegional = dadosFrequencia.filter(
          i => i.regional_id === regional.id && i.divisao === i.regional_texto
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
        const divisoesRegional = todasDivisoes.filter(d => d.regional_id === regional.id);
        divisoesRegional.forEach(divisao => {
          const integrantesDivisao = dadosFrequencia.filter(
            i => i.divisao_id === divisao.id && i.divisao !== i.regional_texto
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

    // Grau V (Regional): agrupar por divisão dentro da regional
    if (nivelAcesso === 'regional') {
      // Primeiro bloco: integrantes diretos da Regional
      const integrantesRegional = dadosFrequencia.filter(
        i => i.divisao === i.regional_texto
      );

      if (integrantesRegional.length > 0) {
        const regionalNome = integrantesRegional[0]?.regional_texto || 'Regional';
        grupos.push({
          tipo: 'regional',
          id: regionalId || 'regional',
          nome: regionalNome,
          integrantes: integrantesRegional
        });
      }

      // Agrupar por divisão
      const gruposPorDivisao = new Map<string, IntegranteFrequencia[]>();
      
      dadosFrequencia.forEach(integrante => {
        if (integrante.divisao === integrante.regional_texto) return; // Já está no bloco da regional
        
        const divisaoNome = integrante.divisao || 'Sem Divisão';
        const divisaoIdKey = integrante.divisao_id || divisaoNome;
        
        if (!gruposPorDivisao.has(divisaoIdKey)) {
          gruposPorDivisao.set(divisaoIdKey, []);
        }
        gruposPorDivisao.get(divisaoIdKey)!.push(integrante);
      });

      gruposPorDivisao.forEach((integrantes, divisaoIdKey) => {
        const divisaoNome = integrantes[0]?.divisao || 'Sem Divisão';
        grupos.push({
          tipo: 'divisao',
          id: divisaoIdKey,
          nome: divisaoNome,
          integrantes
        });
      });

      // Ordenar divisões por nome
      grupos.sort((a, b) => {
        if (a.tipo === 'regional') return -1;
        if (b.tipo === 'regional') return 1;
        return a.nome.localeCompare(b.nome, 'pt-BR');
      });

      return grupos;
    }

    // Grau VI (Divisão): agrupar pela divisão (normalmente será apenas uma)
    if (nivelAcesso === 'divisao') {
      const gruposPorDivisao = new Map<string, IntegranteFrequencia[]>();
      
      dadosFrequencia.forEach(integrante => {
        const divisaoNome = integrante.divisao || 'Sem Divisão';
        const divisaoIdKey = integrante.divisao_id || divisaoNome;
        
        if (!gruposPorDivisao.has(divisaoIdKey)) {
          gruposPorDivisao.set(divisaoIdKey, []);
        }
        gruposPorDivisao.get(divisaoIdKey)!.push(integrante);
      });

      gruposPorDivisao.forEach((integrantes, divisaoIdKey) => {
        const divisaoNome = integrantes[0]?.divisao || 'Sem Divisão';
        grupos.push({
          tipo: 'divisao',
          id: divisaoIdKey,
          nome: divisaoNome,
          integrantes
        });
      });

      return grupos;
    }

    return [{ tipo: 'divisao', id: 'geral', nome: 'Geral', integrantes: dadosFrequencia }];
  }, [dadosFrequencia, isAdmin, nivelAcesso, regionais, todasDivisoes, regionalId]);

  const handlePeriodoChange = (preset: PeriodoPreset) => {
    setPeriodoPreset(preset);
    const hoje = new Date();
    hoje.setHours(23, 59, 59, 999);
    
    switch (preset) {
      case 'ultimo_mes':
        setDataInicio(subMonths(hoje, 1));
        setDataFim(hoje);
        break;
      case 'ultimos_3_meses':
        setDataInicio(subMonths(hoje, 3));
        setDataFim(hoje);
        break;
      case 'ano_atual':
        setDataInicio(startOfYear(hoje));
        setDataFim(hoje);
        break;
    }
  };

  const getVariantAproveitamento = (percentual: number) => {
    if (percentual >= 85) return 'default' as const;
    if (percentual >= 50) return 'secondary' as const;
    return 'destructive' as const;
  };

  const toggleRow = (integranteId: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(integranteId)) {
        next.delete(integranteId);
      } else {
        next.add(integranteId);
      }
      return next;
    });
  };

  // Constantes para ordenação hierárquica do organograma
  const CARGO_ORDER: Record<string, number> = {
    'Diretor Regional': 1,
    'Operacional Regional': 2,
    'Social Regional': 3,
    'Adm. Regional': 4,
    'Comunicação': 5,
    'Diretor Divisão': 10,
    'Sub Diretor Divisão': 11,
    'Social Divisão': 12,
    'Adm. Divisão': 13,
    'Sgt.Armas Divisão': 14,
    'Sgt Armas Full': 15,
    'Sgt Armas PP': 16,
  };

  const getCargoOrder = (cargo: string | null): number => CARGO_ORDER[cargo || ''] || 99;

  const getDivOrder = (divisao: string, regional: string): number =>
    divisao === regional ? 0 : 1; // Regional = 0, Divisões = 1

  const getTipoGrauOrder = (cargo: string | null): number => {
    if (!cargo) return 3;
    const upper = cargo.toUpperCase();
    if (upper.includes('PP')) return 1;
    if (upper.includes('FULL')) return 2;
    return 3;
  };

  const handleExportExcel = () => {
    if (!dadosFrequencia || dadosFrequencia.length === 0) return;

    // Interfaces locais para tipagem
    interface DadosResumo {
      regional: string;
      divisao: string;
      divOrder: number;
      nome: string;
      cargo: string;
      cargoOrder: number;
      grau: string;
      grauNum: number;
      tipoGrau: number;
      eventos: number;
      presencas: number;
      ausencias: number;
      justificados: number;
      pontosObtidos: number;
      pontosMaximos: number;
      aproveitamento: number;
    }

    interface DadosDetalhado {
      regional: string;
      divisao: string;
      divOrder: number;
      nome: string;
      cargo: string;
      cargoOrder: number;
      grau: string;
      grauNum: number;
      tipoGrau: number;
      status: string;
      justificativa: string;
      dataHora: Date;
      dataOriginal: string;
      evento: string;
      pesoEvento: number;
      pesoPresenca: number;
      pontos: number;
    }

    // Função de ordenação hierárquica
    const sortHierarquico = <T extends { 
      regional: string; 
      divOrder: number; 
      divisao: string; 
      cargoOrder: number; 
      grauNum: number; 
      tipoGrau: number; 
      nome: string 
    }>(a: T, b: T): number => {
      if (a.regional !== b.regional) return a.regional.localeCompare(b.regional, 'pt-BR');
      if (a.divOrder !== b.divOrder) return a.divOrder - b.divOrder;
      if (a.divisao !== b.divisao) return a.divisao.localeCompare(b.divisao, 'pt-BR');
      if (a.cargoOrder !== b.cargoOrder) return a.cargoOrder - b.cargoOrder;
      if (a.grauNum !== b.grauNum) return a.grauNum - b.grauNum;
      if (a.tipoGrau !== b.tipoGrau) return a.tipoGrau - b.tipoGrau;
      return a.nome.localeCompare(b.nome, 'pt-BR');
    };

    // 1. Processar dados para aba "Resumo_Integrantes"
    const dadosResumo: DadosResumo[] = dadosFrequencia.map(integrante => {
      const eventos = integrante.eventos;
      const cargoNome = eventos[0]?.cargo_nome || '-';
      const grauTexto = eventos[0]?.grau || '-';
      const regionalTexto = integrante.regional_texto || '';

      return {
        regional: regionalTexto,
        divisao: integrante.divisao,
        divOrder: getDivOrder(integrante.divisao, regionalTexto),
        nome: integrante.nome_colete,
        cargo: cargoNome,
        cargoOrder: getCargoOrder(cargoNome),
        grau: grauTexto,
        grauNum: romanToNumber(grauTexto),
        tipoGrau: getTipoGrauOrder(cargoNome),
        eventos: integrante.totalEventos,
        presencas: eventos.filter(e => e.status === 'presente').length,
        ausencias: eventos.filter(e => e.status === 'ausente').length,
        justificados: eventos.filter(e => e.justificativa && e.justificativa !== '-' && e.justificativa !== 'Não justificou').length,
        pontosObtidos: integrante.pontosObtidos,
        pontosMaximos: integrante.pontosMaximos,
        aproveitamento: integrante.percentual,
      };
    });

    // Ordenar resumo pela hierarquia
    dadosResumo.sort(sortHierarquico);

    // 2. Processar dados para aba "Base_Detalhada"
    const dadosDetalhado: DadosDetalhado[] = [];
    
    dadosFrequencia.forEach(integrante => {
      const regionalTexto = integrante.regional_texto || '';
      
      integrante.eventos.forEach(evento => {
        const cargoNome = evento.cargo_nome || '-';
        const grauTexto = evento.grau || '-';
        const dataEvento = new Date(evento.data);

        dadosDetalhado.push({
          regional: regionalTexto,
          divisao: integrante.divisao,
          divOrder: getDivOrder(integrante.divisao, regionalTexto),
          nome: integrante.nome_colete,
          cargo: cargoNome,
          cargoOrder: getCargoOrder(cargoNome),
          grau: grauTexto,
          grauNum: romanToNumber(grauTexto),
          tipoGrau: getTipoGrauOrder(cargoNome),
          status: evento.status,
          justificativa: evento.justificativa || '-',
          dataHora: dataEvento,
          dataOriginal: format(dataEvento, 'dd/MM/yyyy HH:mm', { locale: ptBR }),
          evento: evento.titulo,
          pesoEvento: evento.pesoEvento,
          pesoPresenca: evento.pesoPresenca,
          pontos: evento.pontos,
        });
      });
    });

    // Ordenar detalhado pela hierarquia + dataHora
    dadosDetalhado.sort((a, b) => {
      const hierarquico = sortHierarquico(a, b);
      if (hierarquico !== 0) return hierarquico;
      return a.dataHora.getTime() - b.dataHora.getTime();
    });

    // 3. Preparar dados para Excel - Aba Resumo
    const sheetResumoData = dadosResumo.map(d => ({
      'Regional': d.regional,
      'Divisão': d.divisao,
      'Nome': d.nome,
      'Cargo': d.cargo,
      'Grau': d.grau,
      'Eventos': d.eventos,
      'Presencas': d.presencas,
      'Ausencias': d.ausencias,
      'Justificados': d.justificados,
      'PontosObtidos': Number(d.pontosObtidos.toFixed(2)),
      'PontosMaximos': Number(d.pontosMaximos.toFixed(2)),
      'Aproveitamento (%)': Number(d.aproveitamento.toFixed(2)),
    }));

    // 4. Preparar dados para Excel - Aba Detalhada
    const sheetDetalhadoData = dadosDetalhado.map(d => ({
      'Regional': d.regional,
      'Divisão': d.divisao,
      'Nome': d.nome,
      'Cargo': d.cargo,
      'Grau': d.grau,
      'Status': d.status,
      'Justificativa': d.justificativa,
      'DataHora': d.dataHora,
      'Data': d.dataOriginal,
      'Evento': d.evento,
      'Peso Evento': d.pesoEvento,
      'Peso Presença': d.pesoPresenca,
      'Pontos': d.pontos,
    }));

    // 5. Criar workbook com duas abas
    const wb = XLSX.utils.book_new();

    // Aba 1: Resumo_Integrantes
    const wsResumo = XLSX.utils.json_to_sheet(sheetResumoData);
    wsResumo['!cols'] = [
      { wch: 35 }, // Regional
      { wch: 40 }, // Divisão
      { wch: 25 }, // Nome
      { wch: 22 }, // Cargo
      { wch: 8 },  // Grau
      { wch: 10 }, // Eventos
      { wch: 10 }, // Presencas
      { wch: 10 }, // Ausencias
      { wch: 12 }, // Justificados
      { wch: 14 }, // PontosObtidos
      { wch: 14 }, // PontosMaximos
      { wch: 18 }, // Aproveitamento
    ];
    XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo_Integrantes');

    // Aba 2: Base_Detalhada
    const wsDetalhado = XLSX.utils.json_to_sheet(sheetDetalhadoData, { 
      cellDates: true,
      dateNF: 'dd/mm/yyyy hh:mm' 
    });
    wsDetalhado['!cols'] = [
      { wch: 35 }, // Regional
      { wch: 40 }, // Divisão
      { wch: 25 }, // Nome
      { wch: 22 }, // Cargo
      { wch: 8 },  // Grau
      { wch: 12 }, // Status
      { wch: 20 }, // Justificativa
      { wch: 18 }, // DataHora
      { wch: 18 }, // Data
      { wch: 45 }, // Evento
      { wch: 12 }, // Peso Evento
      { wch: 13 }, // Peso Presença
      { wch: 10 }, // Pontos
    ];
    XLSX.utils.book_append_sheet(wb, wsDetalhado, 'Base_Detalhada');

    // 6. Baixar arquivo
    XLSX.writeFile(wb, `frequencia_individual_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  if (isLoading) {
    return <div className="flex justify-center p-8">Carregando...</div>;
  }

  const totalGeral = dadosFrequencia?.length || 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Período</label>
              <Select value={periodoPreset} onValueChange={(v) => handlePeriodoChange(v as PeriodoPreset)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ultimo_mes">Último Mês</SelectItem>
                  <SelectItem value="ultimos_3_meses">Últimos 3 Meses</SelectItem>
                  <SelectItem value="ano_atual">Ano Atual</SelectItem>
                  <SelectItem value="personalizado">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {periodoPreset === 'personalizado' && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Data Início</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(dataInicio, 'dd/MM/yyyy', { locale: ptBR })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={dataInicio}
                        onSelect={(date) => date && setDataInicio(date)}
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Data Fim</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(dataFim, 'dd/MM/yyyy', { locale: ptBR })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={dataFim}
                        onSelect={(date) => {
                          if (date) {
                            const hoje = new Date();
                            hoje.setHours(23, 59, 59, 999);
                            setDataFim(date > hoje ? hoje : date);
                          }
                        }}
                        locale={ptBR}
                        disabled={(date) => date > new Date()}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </>
            )}

            {/* Mostrar seletor de divisão apenas se houver opções */}
            {divisoesParaSelecao.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Divisão</label>
                <Select value={divisaoSelecionada} onValueChange={setDivisaoSelecionada}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas</SelectItem>
                    {divisoesParaSelecao.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button onClick={handleExportExcel} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Exportar Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Exibir dados agrupados - Padrão IntegrantesTab */}
      {dadosAgrupados.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">
              Nenhum dado encontrado para o período selecionado
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {dadosAgrupados.map((grupo) => (
            <div key={grupo.id} className="space-y-2">
              {/* Cabeçalho do Grupo - estilo IntegrantesTab */}
              <div className="flex items-center gap-2 px-1">
                {grupo.tipo === 'regional' && <div className="flex-1 h-px bg-border" />}
                <h3 className={`text-xs sm:text-sm font-semibold ${
                  grupo.tipo === 'regional' 
                    ? 'text-primary' 
                    : 'text-muted-foreground'
                }`}>
                  {grupo.tipo === 'regional' ? '═══ ' : '── '}
                  {grupo.nome}
                  {grupo.tipo === 'regional' ? ' ═══' : ' ──'}
                </h3>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Tabela de integrantes */}
              {grupo.integrantes.length === 0 ? (
                <p className="text-center text-muted-foreground py-4 text-sm">
                  Nenhum dado encontrado
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[100px]">Nome</TableHead>
                        <TableHead className="hidden md:table-cell">Divisão</TableHead>
                        <TableHead className="text-center">Eventos</TableHead>
                        <TableHead className="hidden sm:table-cell text-right">Pontos</TableHead>
                        <TableHead className="hidden sm:table-cell text-right">Máximo</TableHead>
                        <TableHead className="min-w-[140px]">Aproveitamento</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {grupo.integrantes.map((integrante) => (
                        <>
                          <TableRow key={integrante.integrante_id}>
                            <TableCell className="font-medium text-sm">{integrante.nome_colete}</TableCell>
                            <TableCell className="hidden md:table-cell">{integrante.divisao}</TableCell>
                            <TableCell className="text-center">{integrante.totalEventos}</TableCell>
                            <TableCell className="hidden sm:table-cell text-right">{integrante.pontosObtidos.toFixed(2)}</TableCell>
                            <TableCell className="hidden sm:table-cell text-right">{integrante.pontosMaximos.toFixed(2)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Progress 
                                  value={integrante.percentual} 
                                  className="flex-1 min-w-[60px]"
                                />
                                <Badge variant={getVariantAproveitamento(integrante.percentual)} className="text-xs">
                                  {integrante.percentual.toFixed(1)}%
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => toggleRow(integrante.integrante_id)}
                              >
                                <ChevronDown
                                  className={cn(
                                    "h-4 w-4 transition-transform",
                                    expandedRows.has(integrante.integrante_id) && "rotate-180"
                                  )}
                                />
                              </Button>
                            </TableCell>
                          </TableRow>
                          
                          {expandedRows.has(integrante.integrante_id) && (
                            <TableRow>
                              <TableCell colSpan={7} className="bg-muted/50 p-0">
                                <div className="p-3 md:p-4 space-y-2">
                                  <h4 className="font-medium text-sm mb-3 text-muted-foreground">Detalhamento de Eventos</h4>
                                  <div className="space-y-2">
                                    {integrante.eventos.map((evento, idx) => (
                                      <div key={idx} className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-sm p-2 bg-background rounded border gap-2">
                                        <div className="flex-1 min-w-0">
                                          <div className="font-medium truncate">{evento.titulo}</div>
                                          <div className="text-xs text-muted-foreground">
                                            {format(new Date(evento.data), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                                          </div>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                          <Badge variant={evento.status === 'presente' ? 'default' : 'secondary'} className="text-xs">
                                            {evento.status}
                                          </Badge>
                                          {evento.justificativa && (
                                            <Badge variant="outline" className="text-xs">{evento.justificativa}</Badge>
                                          )}
                                          <div className="text-right ml-auto sm:ml-0">
                                            <div className="text-xs text-muted-foreground">
                                              Peso: {evento.pesoEvento.toFixed(2)} × {evento.pesoPresenca.toFixed(2)}
                                            </div>
                                            <div className="font-medium">
                                              {evento.pontos.toFixed(2)} pts
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Total do Bloco - estilo IntegrantesTab */}
              <div className="flex items-center justify-end px-2 py-1">
                <span className="text-xs font-semibold text-foreground">
                  Total {grupo.nome}: {grupo.integrantes.length} {grupo.integrantes.length === 1 ? 'integrante' : 'integrantes'}
                </span>
              </div>
            </div>
          ))}

          {/* Total Geral - estilo IntegrantesTab */}
          <div className="flex items-center justify-center px-2 py-3 mt-4 border-t">
            <span className="text-sm font-bold text-foreground">
              Total Geral: {totalGeral} {totalGeral === 1 ? 'integrante' : 'integrantes'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
