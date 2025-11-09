import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, TrendingUp, Users, CheckCircle2, XCircle } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";

interface FrequenciaDashboardProps {
  isAdmin: boolean;
  userDivisaoId?: string;
}

type PeriodoPreset = 'mes_atual' | 'mes_anterior' | 'trimestre' | 'ano' | 'personalizado';

const COLORS = {
  presente: '#10b981',
  ausente: '#ef4444',
  justificado: '#f59e0b'
};

export const FrequenciaDashboard = ({ isAdmin, userDivisaoId }: FrequenciaDashboardProps) => {
  const hoje = new Date();
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  
  const [periodoPreset, setPeriodoPreset] = useState<PeriodoPreset>('mes_atual');
  const [dataInicio, setDataInicio] = useState<Date>(startOfMonth(hoje));
  const [dataFim, setDataFim] = useState<Date>(endOfMonth(hoje));
  const [divisaoSelecionada, setDivisaoSelecionada] = useState<string>(isAdmin ? 'todas' : userDivisaoId || '');

  // Buscar divisões (todas para admin, ou da regional do usuário)
  const { data: divisoes } = useQuery({
    queryKey: ['divisoes-lista', isAdmin, profile?.regional_id],
    queryFn: async () => {
      let query = supabase
        .from('divisoes')
        .select('id, nome')
        .order('nome');
      
      // Se não for admin e tiver regional_id, filtrar pela regional
      if (!isAdmin && profile?.regional_id) {
        query = query.eq('regional_id', profile.regional_id);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: isAdmin || !!profile?.regional_id
  });

  // Buscar eventos e presenças do período (limitado até hoje)
  const { data: dadosFrequencia, isLoading } = useQuery({
    queryKey: ['frequencia-dashboard', dataInicio, dataFim, divisaoSelecionada, divisoes],
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
          divisoes(nome),
          presencas(
            id,
            status,
            justificativa_ausencia,
            integrante_id
          )
        `)
        .gte('data_evento', dataInicio.toISOString())
        .lte('data_evento', dataFimReal.toISOString())
        .order('data_evento', { ascending: true });

      if (!isAdmin) {
        // Se houver divisões da regional (usuário não-admin), usar todas essas divisões
        if (divisoes && divisoes.length > 0) {
          const divisaoIds = divisoes.map(d => d.id);
          query = query.in('divisao_id', divisaoIds);
        } else if (userDivisaoId) {
          // Fallback: usar apenas a divisão do usuário
          query = query.eq('divisao_id', userDivisaoId);
        }
      } else if (divisaoSelecionada && divisaoSelecionada !== 'todas') {
        // Admin: filtrar pela divisão selecionada
        query = query.eq('divisao_id', divisaoSelecionada);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return data;
    }
  });

  // Processar dados para gráficos
  const estatisticas = useMemo(() => {
    if (!dadosFrequencia) return null;

    const totalEventos = dadosFrequencia.length;
    let totalPresencas = 0;
    let totalAusencias = 0;
    let totalJustificados = 0;

    const eventosPorMes: Record<string, { presentes: number; ausentes: number; justificados: number }> = {};

    dadosFrequencia.forEach(evento => {
      const presencas = evento.presencas || [];
      const mesAno = format(new Date(evento.data_evento), 'MMM/yyyy', { locale: ptBR });

      if (!eventosPorMes[mesAno]) {
        eventosPorMes[mesAno] = { presentes: 0, ausentes: 0, justificados: 0 };
      }

      presencas.forEach(presenca => {
        if (presenca.status === 'presente') {
          totalPresencas++;
          eventosPorMes[mesAno].presentes++;
        } else if (presenca.status === 'justificado') {
          totalJustificados++;
          eventosPorMes[mesAno].justificados++;
        } else {
          totalAusencias++;
          eventosPorMes[mesAno].ausentes++;
        }
      });
    });

    const dadosGraficoBarras = Object.entries(eventosPorMes).map(([mes, dados]) => ({
      mes,
      Presentes: dados.presentes,
      Ausentes: dados.ausentes,
      Justificados: dados.justificados
    }));

    const totalRegistros = totalPresencas + totalAusencias + totalJustificados;
    const dadosGraficoPizza = [
      { name: 'Presentes', value: totalPresencas, porcentagem: totalRegistros > 0 ? ((totalPresencas / totalRegistros) * 100).toFixed(1) : 0 },
      { name: 'Ausentes', value: totalAusencias, porcentagem: totalRegistros > 0 ? ((totalAusencias / totalRegistros) * 100).toFixed(1) : 0 },
      { name: 'Justificados', value: totalJustificados, porcentagem: totalRegistros > 0 ? ((totalJustificados / totalRegistros) * 100).toFixed(1) : 0 }
    ];

    return {
      totalEventos,
      totalPresencas,
      totalAusencias,
      totalJustificados,
      totalRegistros,
      dadosGraficoBarras,
      dadosGraficoPizza
    };
  }, [dadosFrequencia]);

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

            {(isAdmin || (divisoes && divisoes.length > 1)) && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Divisão</label>
                <Select value={divisaoSelecionada} onValueChange={setDivisaoSelecionada}>
                  <SelectTrigger>
                    <SelectValue placeholder={isAdmin ? "Todas as divisões" : "Todas da Regional"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">{isAdmin ? "Todas as Divisões" : "Todas da Regional"}</SelectItem>
                    {divisoes?.map(div => (
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Eventos</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
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
              <CardTitle className="text-sm font-medium">Ausências</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{estatisticas.totalAusencias}</div>
              <p className="text-xs text-muted-foreground">
                {estatisticas.dadosGraficoPizza[1].porcentagem}% do total
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
                {estatisticas.dadosGraficoPizza[2].porcentagem}% do total
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Gráficos */}
      {estatisticas && estatisticas.dadosGraficoBarras.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Gráfico de Barras */}
          <Card>
            <CardHeader>
              <CardTitle>Frequência por Período</CardTitle>
              <CardDescription>Distribuição de presenças ao longo do tempo</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={estatisticas.dadosGraficoBarras}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Presentes" fill={COLORS.presente} />
                  <Bar dataKey="Justificados" fill={COLORS.justificado} />
                  <Bar dataKey="Ausentes" fill={COLORS.ausente} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Gráfico de Pizza */}
          <Card>
            <CardHeader>
              <CardTitle>Distribuição Geral</CardTitle>
              <CardDescription>Proporção de cada status no período</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={estatisticas.dadosGraficoPizza}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, porcentagem }) => `${name}: ${porcentagem}%`}
                    outerRadius={80}
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
