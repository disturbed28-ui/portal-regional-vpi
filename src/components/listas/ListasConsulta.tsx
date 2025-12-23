import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Users, FileSpreadsheet, Building2 } from "lucide-react";
import { removeAccents } from "@/lib/utils";
import { getNivelAcesso } from "@/lib/grauUtils";
import { useDivisoesPorRegional } from "@/hooks/useDivisoesPorRegional";
import { ordenarIntegrantes } from "@/lib/integranteOrdering";
import * as XLSX from 'xlsx';

interface ListasConsultaProps {
  grau?: string | null;
  regionalId?: string | null;
  divisaoId?: string | null;
  isAdmin?: boolean;
  isCaveira?: boolean;
  isBatedor?: boolean;
}

/**
 * Deriva o status de exibição baseado no status real e na justificativa
 */
/**
 * Deriva o status de exibição baseado no status real e na justificativa
 */
const getStatusExibicao = (status: string, justificativa: string | null): string => {
  if (status === 'presente') return 'presente';
  if (status === 'visitante') return 'visitante';
  
  if (justificativa && justificativa !== 'nao_justificado') {
    return 'justificado';
  }
  return 'ausente';
};

export const ListasConsulta = ({ 
  grau, 
  regionalId, 
  divisaoId, 
  isAdmin = false,
  isCaveira = false,
  isBatedor = false
}: ListasConsultaProps) => {
  const [eventoSelecionado, setEventoSelecionado] = useState<string>('');
  
  // Determinar nível de acesso
  const nivelAcesso = getNivelAcesso(grau);
  
  // Buscar divisões da regional (para graus V e VI)
  const { divisaoIds: divisoesDaRegional } = useDivisoesPorRegional(
    (nivelAcesso === 'regional' || nivelAcesso === 'divisao') ? regionalId : null
  );

  // Buscar a divisão que representa a regional (ex: "REGIONAL VALE DO PARAIBA I - SP")
  const { data: divisaoRegional } = useQuery({
    queryKey: ['divisao-regional', regionalId],
    queryFn: async () => {
      if (!regionalId) return null;
      const { data } = await supabase
        .from('divisoes')
        .select('id')
        .eq('regional_id', regionalId)
        .ilike('nome', 'REGIONAL%')
        .maybeSingle();
      return data?.id || null;
    },
    enabled: !!regionalId
  });

  // Buscar o ID da divisão CMD (eventos de comando são visíveis para todos)
  const { data: divisaoCMD } = useQuery({
    queryKey: ['divisao-cmd'],
    queryFn: async () => {
      const { data } = await supabase
        .from('divisoes')
        .select('id')
        .eq('nome', 'CMD')
        .maybeSingle();
      return data?.id || null;
    }
  });

  // Buscar eventos disponíveis (apenas passados ou de hoje)
  const { data: eventos, isLoading: loadingEventos } = useQuery({
    queryKey: ['eventos-lista', isAdmin, nivelAcesso, divisoesDaRegional, divisaoId, divisaoRegional, divisaoCMD],
    queryFn: async () => {
      const hoje = new Date();
      const dataLimite = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59, 999));
      
      let query = supabase
        .from('eventos_agenda')
        .select(`
          id,
          titulo,
          data_evento,
          divisao_id,
          tipo_evento,
          divisoes(nome)
        `)
        .lte('data_evento', dataLimite.toISOString())
        .order('data_evento', { ascending: false })
        .limit(50);

      // Aplicar filtro baseado no nível de acesso
      if (!isAdmin) {
        if (nivelAcesso === 'comando') {
          // Graus I-IV: ver todos (sem filtro adicional de divisão)
        } else {
          // Construir lista de divisões visíveis
          let divisoesVisiveis = [...divisoesDaRegional];

          // Adicionar a divisão "REGIONAL X" se existir
          if (divisaoRegional) {
            divisoesVisiveis.push(divisaoRegional);
          }

          // Adicionar divisão CMD (eventos de comando são visíveis para todos)
          if (divisaoCMD) {
            divisoesVisiveis.push(divisaoCMD);
          }

          if (divisoesVisiveis.length > 0) {
            // Graus V e VI: ver eventos da regional + CMD + regional específica
            query = query.in('divisao_id', divisoesVisiveis);
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
    enabled: isAdmin || nivelAcesso === 'comando' || divisoesDaRegional.length > 0 || !!divisaoId || !!divisaoRegional || !!divisaoCMD
  });

  // Filtrar eventos de Caveira/Batedor no cliente
  const eventosFiltrados = useMemo(() => {
    if (!eventos) return [];
    
    return eventos.filter(evento => {
      // Eventos de Caveira só aparecem para quem é caveira
      if (evento.tipo_evento === 'Caveira' && !isCaveira) {
        return false;
      }
      // Eventos de Batedor só aparecem para quem é batedor (se existir esse tipo)
      if (evento.tipo_evento === 'Batedor' && !isBatedor) {
        return false;
      }
      return true;
    });
  }, [eventos, isCaveira, isBatedor]);

  // Buscar presenças do evento selecionado
  const { data: presencas, isLoading: loadingPresencas } = useQuery({
    queryKey: ['presencas-evento', eventoSelecionado],
    queryFn: async () => {
      if (!eventoSelecionado) return [];

      const { data, error } = await supabase
        .from('presencas')
        .select(`
          id,
          status,
          confirmado_em,
          confirmado_por,
          justificativa_ausencia,
          integrante_id,
          visitante_nome,
          visitante_tipo,
          integrantes_portal(
            nome_colete,
            divisao_texto,
            cargo_nome,
            grau
          )
        `)
        .eq('evento_agenda_id', eventoSelecionado)
        .order('status', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!eventoSelecionado
  });

  const eventoAtual = eventosFiltrados?.find(e => e.id === eventoSelecionado);

  // Agrupar presenças por divisão e ordenar hierarquicamente dentro de cada grupo
  const presencasAgrupadasPorDivisao = useMemo(() => {
    if (!presencas || presencas.length === 0) return new Map<string, typeof presencas>();
    
    const grupos = new Map<string, typeof presencas>();
    
    // Agrupar por divisão
    presencas.forEach(p => {
      const divisao = p.integrantes_portal?.divisao_texto || 
                      (p.visitante_tipo === 'externo' ? 'Visitantes Externos' : 'Sem Divisão');
      
      if (!grupos.has(divisao)) {
        grupos.set(divisao, []);
      }
      grupos.get(divisao)?.push(p);
    });
    
    // Ordenar integrantes dentro de cada divisão pela hierarquia do organograma
    grupos.forEach((integrantes, divisao) => {
      const ordenados = [...integrantes].sort((a, b) => {
        // Adaptar para o formato esperado por ordenarIntegrantes
        const integranteA = {
          cargo_nome: a.integrantes_portal?.cargo_nome || null,
          grau: a.integrantes_portal?.grau || null,
          data_entrada: null,
          nome_colete: a.integrantes_portal?.nome_colete || a.visitante_nome || ''
        };
        const integranteB = {
          cargo_nome: b.integrantes_portal?.cargo_nome || null,
          grau: b.integrantes_portal?.grau || null,
          data_entrada: null,
          nome_colete: b.integrantes_portal?.nome_colete || b.visitante_nome || ''
        };
        return ordenarIntegrantes(integranteA, integranteB);
      });
      grupos.set(divisao, ordenados);
    });
    
    return grupos;
  }, [presencas]);

  // Ordenar divisões alfabeticamente, com "Visitantes Externos" e "Sem Divisão" por último
  const divisoesOrdenadas = useMemo(() => {
    const divisoes = Array.from(presencasAgrupadasPorDivisao.keys());
    return divisoes.sort((a, b) => {
      if (a === 'Visitantes Externos') return 1;
      if (b === 'Visitantes Externos') return -1;
      if (a === 'Sem Divisão') return 1;
      if (b === 'Sem Divisão') return -1;
      return a.localeCompare(b, 'pt-BR');
    });
  }, [presencasAgrupadasPorDivisao]);

  // Lista plana para estatísticas e exportação Excel
  const presencasOrdenadas = useMemo(() => {
    const resultado: typeof presencas = [];
    divisoesOrdenadas.forEach(divisao => {
      const integrantes = presencasAgrupadasPorDivisao.get(divisao) || [];
      resultado.push(...integrantes);
    });
    return resultado;
  }, [divisoesOrdenadas, presencasAgrupadasPorDivisao]);

  const getStatusBadge = (status: string, justificativa: string | null) => {
    const statusExibicao = getStatusExibicao(status, justificativa);
    switch (statusExibicao) {
      case 'presente':
        return <Badge className="bg-green-600 hover:bg-green-700">Presente</Badge>;
      case 'visitante':
        return <Badge className="bg-blue-600 hover:bg-blue-700">Visitante</Badge>;
      case 'justificado':
        return <Badge className="bg-amber-600 hover:bg-amber-700">Justificado</Badge>;
      case 'ausente':
        return <Badge variant="destructive">Ausente</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const estatisticas = presencasOrdenadas ? {
    total: presencasOrdenadas.length,
    presentes: presencasOrdenadas.filter(p => getStatusExibicao(p.status, p.justificativa_ausencia) === 'presente').length,
    visitantes: presencasOrdenadas.filter(p => getStatusExibicao(p.status, p.justificativa_ausencia) === 'visitante').length,
    justificados: presencasOrdenadas.filter(p => getStatusExibicao(p.status, p.justificativa_ausencia) === 'justificado').length,
    ausentes: presencasOrdenadas.filter(p => getStatusExibicao(p.status, p.justificativa_ausencia) === 'ausente').length
  } : null;

  const handleExportarExcel = () => {
    if (!eventoAtual || !presencasOrdenadas) return;
    
    const dadosExcel = presencasOrdenadas.map(p => {
      const statusExibicao = getStatusExibicao(p.status, p.justificativa_ausencia);
      const isVisitanteExterno = p.visitante_tipo === 'externo';
      
      return {
        'Nome': p.integrantes_portal?.nome_colete 
          ? removeAccents(p.integrantes_portal.nome_colete)
          : p.visitante_nome 
            ? removeAccents(p.visitante_nome)
            : '-',
        'Divisão': p.integrantes_portal?.divisao_texto 
          ? removeAccents(p.integrantes_portal.divisao_texto)
          : isVisitanteExterno ? 'Externo' : '-',
        'Cargo': p.integrantes_portal?.cargo_nome 
          ? removeAccents(p.integrantes_portal.cargo_nome)
          : isVisitanteExterno ? 'Visitante Externo' : '-',
        'Grau': p.integrantes_portal?.grau || '-',
        'Status': statusExibicao.charAt(0).toUpperCase() + statusExibicao.slice(1),
        'Confirmado Por': p.confirmado_por || '-',
        'Data/Hora': p.confirmado_em 
          ? format(new Date(p.confirmado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })
          : '-',
        'Justificativa': statusExibicao === 'presente' || statusExibicao === 'visitante'
          ? '-' 
          : (p.justificativa_ausencia || 'Não justificado')
      };
    });
    
    const ws = XLSX.utils.json_to_sheet(dadosExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Lista de Presença');
    
    const nomeArquivo = `lista_presenca_${format(new Date(eventoAtual.data_evento), 'yyyy-MM-dd')}_${removeAccents(eventoAtual.titulo).replace(/\s+/g, '_')}.xlsx`;
    XLSX.writeFile(wb, nomeArquivo);
  };

  return (
    <div className="space-y-6">
      {/* Seletor de Evento */}
      <Card>
        <CardHeader>
          <CardTitle>Selecione um Evento</CardTitle>
          <CardDescription>Escolha o evento para visualizar a lista de presença</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={eventoSelecionado} onValueChange={setEventoSelecionado}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione um evento..." />
            </SelectTrigger>
            <SelectContent>
              {loadingEventos ? (
                <SelectItem value="loading" disabled>Carregando...</SelectItem>
              ) : eventosFiltrados && eventosFiltrados.length > 0 ? (
                eventosFiltrados.map(evento => (
                  <SelectItem key={evento.id} value={evento.id}>
                    {format(new Date(evento.data_evento), "dd/MM/yyyy", { locale: ptBR })} - {removeAccents(evento.titulo)}
                    {evento.divisoes && ` (${removeAccents(evento.divisoes.nome)})`}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="empty" disabled>Nenhum evento encontrado</SelectItem>
              )}
            </SelectContent>
          </Select>
          
          {eventoSelecionado && presencasOrdenadas && presencasOrdenadas.length > 0 && (
            <div className="flex justify-end mt-4">
              <Button
                onClick={handleExportarExcel}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Exportar para Excel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Informações do Evento e Estatísticas */}
      {eventoSelecionado && eventoAtual && estatisticas && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Informações do Evento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <span className="font-medium">Título:</span>
                <p className="text-muted-foreground">{removeAccents(eventoAtual.titulo)}</p>
              </div>
              <div>
                <span className="font-medium">Data:</span>
                <p className="text-muted-foreground">
                  {format(new Date(eventoAtual.data_evento), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
              {eventoAtual.divisoes && (
                <div>
                  <span className="font-medium">Divisão:</span>
                  <p className="text-muted-foreground">{removeAccents(eventoAtual.divisoes.nome)}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Estatísticas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Total de Registros:</span>
                <span className="text-2xl font-bold">{estatisticas.total}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-green-600">Presentes:</span>
                <span className="text-xl font-semibold text-green-600">{estatisticas.presentes}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-blue-600">Visitantes:</span>
                <span className="text-xl font-semibold text-blue-600">{estatisticas.visitantes}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-amber-600">Justificados:</span>
                <span className="text-xl font-semibold text-amber-600">{estatisticas.justificados}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-red-600">Ausentes:</span>
                <span className="text-xl font-semibold text-red-600">{estatisticas.ausentes}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Lista de Presença */}
      {eventoSelecionado && (
        <Card>
          <CardHeader>
            <CardTitle>Lista de Presença</CardTitle>
            <CardDescription>
              {loadingPresencas ? "Carregando..." : `${presencas?.length || 0} registros encontrados`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingPresencas ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : divisoesOrdenadas.length > 0 ? (
              <div className="space-y-6">
                {divisoesOrdenadas.map(divisao => {
                  const integrantesDaDivisao = presencasAgrupadasPorDivisao.get(divisao) || [];
                  return (
                    <div key={divisao} className="border rounded-lg overflow-hidden">
                      {/* Cabeçalho da Divisão */}
                      <div className="bg-muted/50 px-4 py-3 flex items-center gap-2 border-b">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <h3 className="font-semibold text-sm">
                          {removeAccents(divisao)}
                        </h3>
                        <Badge variant="secondary" className="ml-auto">
                          {integrantesDaDivisao.length}
                        </Badge>
                      </div>
                      
                      {/* Tabela da Divisão */}
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="min-w-[120px]">Nome</TableHead>
                              <TableHead className="hidden lg:table-cell">Cargo</TableHead>
                              <TableHead className="hidden lg:table-cell">Grau</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="hidden md:table-cell">Confirmado Por</TableHead>
                              <TableHead className="hidden lg:table-cell">Data/Hora</TableHead>
                              <TableHead className="hidden sm:table-cell">Justificativa</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {integrantesDaDivisao.map((presenca) => (
                              <TableRow key={presenca.id}>
                                <TableCell className="font-medium text-sm">
                                  {presenca.integrantes_portal?.nome_colete 
                                    ? removeAccents(presenca.integrantes_portal.nome_colete)
                                    : presenca.visitante_nome 
                                      ? removeAccents(presenca.visitante_nome)
                                      : '-'}
                                </TableCell>
                                <TableCell className="hidden lg:table-cell">
                                  {presenca.integrantes_portal?.cargo_nome 
                                    ? removeAccents(presenca.integrantes_portal.cargo_nome)
                                    : presenca.visitante_tipo === 'externo' 
                                      ? 'Visitante Externo' 
                                      : '-'}
                                </TableCell>
                                <TableCell className="hidden lg:table-cell">
                                  {presenca.integrantes_portal?.grau || '-'}
                                </TableCell>
                                <TableCell>{getStatusBadge(presenca.status, presenca.justificativa_ausencia)}</TableCell>
                                <TableCell className="hidden md:table-cell">{presenca.confirmado_por || '-'}</TableCell>
                                <TableCell className="hidden lg:table-cell">
                                  {presenca.confirmado_em 
                                    ? format(new Date(presenca.confirmado_em), "dd/MM/yy HH:mm", { locale: ptBR })
                                    : '-'}
                                </TableCell>
                                <TableCell className="hidden sm:table-cell text-sm">
                                  {getStatusExibicao(presenca.status, presenca.justificativa_ausencia) === 'presente' ||
                                   getStatusExibicao(presenca.status, presenca.justificativa_ausencia) === 'visitante'
                                    ? '-'
                                    : presenca.justificativa_ausencia || 'Não justificado'}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum registro de presença encontrado para este evento
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
