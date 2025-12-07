import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, TrendingUp, Users, CheckCircle2, XCircle, AlertTriangle, Target } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, startOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { getNivelAcesso } from "@/lib/grauUtils";
import { useDivisoesPorRegional } from "@/hooks/useDivisoesPorRegional";

interface FrequenciaDashboardProps {
  grau?: string | null;
  regionalId?: string | null;
  divisaoId?: string | null;
  isAdmin?: boolean;
}

type PeriodoPreset = 'mes_atual' | 'mes_anterior' | 'trimestre' | 'ano' | 'personalizado';

const COLORS = {
  presente: '#10b981',
  injustificado: '#ef4444',
  justificado: '#f59e0b'
};

export const FrequenciaDashboard = ({ grau, regionalId, divisaoId, isAdmin = false }: FrequenciaDashboardProps) => {
  const hoje = new Date();
  
  const [periodoPreset, setPeriodoPreset] = useState<PeriodoPreset>('mes_atual');
  const [dataInicio, setDataInicio] = useState<Date>(startOfMonth(hoje));
  const [dataFim, setDataFim] = useState<Date>(endOfMonth(hoje));
  const [divisaoSelecionada, setDivisaoSelecionada] = useState<string>('todas');

  // Determinar nível de acesso
  const nivelAcesso = getNivelAcesso(grau);
  
  // Buscar divisões da regional (para graus V e VI)
  const { divisoes: divisoesDaRegional, divisaoIds: divisaoIdsDaRegional } = useDivisoesPorRegional(
    (nivelAcesso === 'regional' || nivelAcesso === 'divisao') ? regionalId : null
  );

  // Buscar todas as divisões (para admin ou CMD)
  const { data: todasDivisoes } = useQuery({
    queryKey: ['todas-divisoes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('divisoes')
        .select('id, nome')
        .order('nome');
      
      if (error) throw error;
      return data;
    },
    enabled: isAdmin || nivelAcesso === 'comando'
  });

  // Buscar pesos dos tipos de evento
  const { data: tiposEventoPeso } = useQuery({
    queryKey: ['tipos-evento-peso'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tipos_evento_peso')
        .select('tipo, peso, ativo')
        .eq('ativo', true);
      
      if (error) throw error;
      return data;
    }
  });

  // Buscar pesos das justificativas
  const { data: justificativasPeso } = useQuery({
    queryKey: ['justificativas-peso'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('justificativas_peso')
        .select('tipo, peso, ativo')
        .eq('ativo', true);
      
      if (error) throw error;
      return data;
    }
  });

  // Determinar quais divisões mostrar no seletor
  const divisoesParaSelecao = useMemo(() => {
    if (isAdmin || nivelAcesso === 'comando') {
      return todasDivisoes || [];
    }
    return divisoesDaRegional;
  }, [isAdmin, nivelAcesso, todasDivisoes, divisoesDaRegional]);

  // Buscar eventos e presenças do período (limitado até hoje)
  const { data: dadosFrequencia, isLoading } = useQuery({
    queryKey: ['frequencia-dashboard', dataInicio, dataFim, divisaoSelecionada, isAdmin, nivelAcesso, divisaoIdsDaRegional, divisaoId],
    queryFn: async () => {
      const hoje = new Date();
      hoje.setHours(23, 59, 59, 999);
      const dataFimReal = dataFim > hoje ? hoje : dataFim;
      
      let query = supabase
        .from('eventos_agenda')
        .select(`
          id,
          titulo,
          data_evento,
          divisao_id,
          tipo_evento_peso,
          divisoes(nome),
          presencas(
            id,
            status,
            justificativa_ausencia,
            justificativa_tipo,
            integrante_id
          )
        `)
        .gte('data_evento', dataInicio.toISOString())
        .lte('data_evento', dataFimReal.toISOString())
        .order('data_evento', { ascending: true });

      // Aplicar filtro de divisão selecionada
      if (divisaoSelecionada && divisaoSelecionada !== 'todas') {
        query = query.eq('divisao_id', divisaoSelecionada);
      } else {
        // Aplicar filtro baseado no nível de acesso
        if (!isAdmin) {
          if (nivelAcesso === 'comando') {
            // Graus I-IV: ver todos (sem filtro adicional)
          } else if ((nivelAcesso === 'regional' || nivelAcesso === 'divisao') && divisaoIdsDaRegional.length > 0) {
            // Graus V e VI: ver eventos da regional inteira
            query = query.in('divisao_id', divisaoIdsDaRegional);
          } else if (divisaoId) {
            // Fallback: apenas a divisão do usuário
            query = query.eq('divisao_id', divisaoId);
          }
        }
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return data;
    },
    enabled: isAdmin || nivelAcesso === 'comando' || divisaoIdsDaRegional.length > 0 || !!divisaoId
  });

  // Processar dados para gráficos com cálculo ponderado
  const estatisticas = useMemo(() => {
    if (!dadosFrequencia) return null;

    // Mapear pesos por tipo
    const pesosEvento: Record<string, number> = {};
    tiposEventoPeso?.forEach(t => {
      pesosEvento[t.tipo] = Number(t.peso);
    });
    
    const pesosJustificativa: Record<string, number> = {};
    justificativasPeso?.forEach(j => {
      pesosJustificativa[j.tipo] = Number(j.peso);
    });

    const totalEventos = dadosFrequencia.length;
    let totalPresencas = 0;
    let totalInjustificados = 0;
    let totalJustificados = 0;

    // Para cálculo ponderado
    let pontosObtidos = 0;
    let pontosMaximos = 0;

    const eventosPorMes: Record<string, { presentes: number; injustificados: number; justificados: number }> = {};

    dadosFrequencia.forEach(evento => {
      const presencas = evento.presencas || [];
      const mesAno = format(new Date(evento.data_evento), 'MMM/yyyy', { locale: ptBR });
      
      // Peso do tipo de evento (default 1 se não configurado)
      const pesoEvento = pesosEvento[evento.tipo_evento_peso || ''] || 1;

      if (!eventosPorMes[mesAno]) {
        eventosPorMes[mesAno] = { presentes: 0, injustificados: 0, justificados: 0 };
      }

      presencas.forEach(presenca => {
        // Peso máximo possível para este registro
        pontosMaximos += pesoEvento;

        if (presenca.status === 'presente') {
          // Presença = 100% do peso do evento
          totalPresencas++;
          eventosPorMes[mesAno].presentes++;
          pontosObtidos += pesoEvento;
        } else if (presenca.status === 'ausente') {
          // Verificar se tem justificativa válida
          const tipoJustificativa = presenca.justificativa_tipo;
          
          if (tipoJustificativa && tipoJustificativa !== 'Não justificou') {
            // Ausência justificada - aplicar peso da justificativa
            totalJustificados++;
            eventosPorMes[mesAno].justificados++;
            
            // Peso da justificativa (ex: Saúde = 0.75, Trabalho = 0.5, etc)
            const pesoJustificativa = pesosJustificativa[tipoJustificativa] ?? 0;
            pontosObtidos += pesoEvento * pesoJustificativa;
          } else {
            // Ausência injustificada - 0 pontos
            totalInjustificados++;
            eventosPorMes[mesAno].injustificados++;
            // pontosObtidos += 0
          }
        }
      });
    });

    const dadosGraficoBarras = Object.entries(eventosPorMes).map(([mes, dados]) => ({
      mes,
      Presentes: dados.presentes,
      Injustificados: dados.injustificados,
      Justificados: dados.justificados
    }));

    const totalRegistros = totalPresencas + totalInjustificados + totalJustificados;
    const aproveitamentoPonderado = pontosMaximos > 0 ? (pontosObtidos / pontosMaximos) * 100 : 0;

    const dadosGraficoPizza = [
      { name: 'Presentes', value: totalPresencas, porcentagem: totalRegistros > 0 ? ((totalPresencas / totalRegistros) * 100).toFixed(1) : '0' },
      { name: 'Justificados', value: totalJustificados, porcentagem: totalRegistros > 0 ? ((totalJustificados / totalRegistros) * 100).toFixed(1) : '0' },
      { name: 'Injustificados', value: totalInjustificados, porcentagem: totalRegistros > 0 ? ((totalInjustificados / totalRegistros) * 100).toFixed(1) : '0' }
    ];

    return {
      totalEventos,
      totalPresencas,
      totalInjustificados,
      totalJustificados,
      totalRegistros,
      aproveitamentoPonderado,
      pontosObtidos,
      pontosMaximos,
      dadosGraficoBarras,
      dadosGraficoPizza
    };
  }, [dadosFrequencia, tiposEventoPeso, justificativasPeso]);

  const handlePeriodoChange = (valor: PeriodoPreset) => {
    setPeriodoPreset(valor);
    const hoje = new Date();
    hoje.setHours(23, 59, 59, 999);
    
    switch (valor) {
      case 'mes_atual':
        setDataInicio(startOfMonth(hoje));
        setDataFim(hoje);
        break;
      case 'mes_anterior':
        const mesPassado = subMonths(hoje, 1);
        setDataInicio(startOfMonth(mesPassado));
        setDataFim(endOfMonth(mesPassado));
        break;
      case 'trimestre':
        setDataInicio(subMonths(hoje, 3));
        setDataFim(hoje);
        break;
      case 'ano':
        setDataInicio(startOfYear(hoje));
        setDataFim(hoje);
        break;
    }
  };

  // Label do seletor de divisão
  const getDivisaoPlaceholder = () => {
    if (isAdmin || nivelAcesso === 'comando') return "Todas as Divisões";
    return "Todas da Regional";
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Selecione o período e divisão para análise</CardDescription>
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
                  <SelectItem value="mes_atual">Mês Atual</SelectItem>
                  <SelectItem value="mes_anterior">Mês Anterior</SelectItem>
                  <SelectItem value="trimestre">Últimos 3 Meses</SelectItem>
                  <SelectItem value="ano">Este Ano</SelectItem>
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
                      <Button variant="outline" className="w-full justify-start text-left">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(dataInicio, "dd/MM/yyyy")}
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
                      <Button variant="outline" className="w-full justify-start text-left">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(dataFim, "dd/MM/yyyy")}
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

            {/* Mostrar seletor de divisão se houver mais de uma opção */}
            {divisoesParaSelecao.length > 1 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Divisão</label>
                <Select value={divisaoSelecionada} onValueChange={setDivisaoSelecionada}>
                  <SelectTrigger>
                    <SelectValue placeholder={getDivisaoPlaceholder()} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">{getDivisaoPlaceholder()}</SelectItem>
                    {divisoesParaSelecao.map(div => (
                      <SelectItem key={div.id} value={div.id}>{div.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Cards de Resumo */}
      {estatisticas && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Eventos</CardTitle>
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{estatisticas.totalEventos}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Presenças</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{estatisticas.totalPresencas}</div>
              <p className="text-xs text-muted-foreground">
                {estatisticas.dadosGraficoPizza[0].porcentagem}% do total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Justificados</CardTitle>
              <Users className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{estatisticas.totalJustificados}</div>
              <p className="text-xs text-muted-foreground">
                {estatisticas.dadosGraficoPizza[1].porcentagem}% do total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Injustificados</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{estatisticas.totalInjustificados}</div>
              <p className="text-xs text-muted-foreground">
                {estatisticas.dadosGraficoPizza[2].porcentagem}% do total
              </p>
            </CardContent>
          </Card>

          <Card className="col-span-2 md:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Aproveitamento</CardTitle>
              <Target className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${
                estatisticas.aproveitamentoPonderado >= 80 ? 'text-green-600' :
                estatisticas.aproveitamentoPonderado >= 60 ? 'text-amber-600' :
                'text-red-600'
              }`}>
                {estatisticas.aproveitamentoPonderado.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">
                {estatisticas.pontosObtidos.toFixed(1)} / {estatisticas.pontosMaximos.toFixed(1)} pts
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Gráficos */}
      {estatisticas && estatisticas.dadosGraficoBarras.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          {/* Gráfico de Barras */}
          <Card>
            <CardHeader className="pb-2 md:pb-6">
              <CardTitle className="text-base md:text-lg">Frequência por Período</CardTitle>
              <CardDescription className="text-xs md:text-sm">Distribuição de presenças ao longo do tempo</CardDescription>
            </CardHeader>
            <CardContent className="px-2 md:px-6">
              <ResponsiveContainer width="100%" height={250} className="md:!h-[300px]">
                <BarChart data={estatisticas.dadosGraficoBarras}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="Presentes" fill={COLORS.presente} />
                  <Bar dataKey="Justificados" fill={COLORS.justificado} />
                  <Bar dataKey="Injustificados" fill={COLORS.injustificado} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Gráfico de Pizza */}
          <Card>
            <CardHeader className="pb-2 md:pb-6">
              <CardTitle className="text-base md:text-lg">Distribuição Geral</CardTitle>
              <CardDescription className="text-xs md:text-sm">Proporção de cada status no período</CardDescription>
            </CardHeader>
            <CardContent className="px-2 md:px-6">
              <ResponsiveContainer width="100%" height={250} className="md:!h-[300px]">
                <PieChart>
                  <Pie
                    data={estatisticas.dadosGraficoPizza}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, porcentagem }) => `${name}: ${porcentagem}%`}
                    outerRadius={70}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {estatisticas.dadosGraficoPizza.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={Object.values(COLORS)[index]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {(!estatisticas || estatisticas.totalEventos === 0) && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              Nenhum evento encontrado no período selecionado
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
