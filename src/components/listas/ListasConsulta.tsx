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
import { Calendar, Users, FileSpreadsheet } from "lucide-react";
import { removeAccents } from "@/lib/utils";
import * as XLSX from 'xlsx';

interface ListasConsultaProps {
  isAdmin: boolean;
  userDivisaoId?: string;
}

/**
 * Deriva o status de exibição baseado no status real e na justificativa
 * Regra de negócio:
 * - presente → "presente"
 * - visitante → "visitante"
 * - ausente + justificativa válida → "justificado"
 * - ausente + sem justificativa ou "nao_justificado" → "ausente"
 */
const getStatusExibicao = (status: string, justificativa: string | null): string => {
  if (status === 'presente') return 'presente';
  if (status === 'visitante') return 'visitante';
  
  // Status = ausente
  if (justificativa && justificativa !== 'nao_justificado') {
    return 'justificado';
  }
  return 'ausente';
};

// Funções auxiliares para ordenação
const romanToNumber = (roman: string | null): number => {
  if (!roman) return 999;
  const romanMap: { [key: string]: number } = {
    'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5,
    'VI': 6, 'VII': 7, 'VIII': 8, 'IX': 9, 'X': 10,
    'XI': 11, 'XII': 12
  };
  return romanMap[roman.toUpperCase()] || 999;
};

const getCargoOrder = (cargo: string | null, grau: string | null): number => {
  if (!cargo) return 999;
  const cargoLower = cargo.toLowerCase();
  
  if (grau === 'V') {
    if (cargoLower.includes('diretor regional')) return 1;
    if (cargoLower.includes('operacional regional')) return 2;
    if (cargoLower.includes('social regional')) return 3;
    if (cargoLower.includes('adm') && cargoLower.includes('regional')) return 4;
    if (cargoLower.includes('comunicação') || cargoLower.includes('comunicacao')) return 5;
  }
  
  if (grau === 'VI') {
    if (cargoLower.includes('diretor') && cargoLower.includes('divisão')) return 1;
    if (cargoLower.includes('sub diretor')) return 2;
    if (cargoLower.includes('social') && cargoLower.includes('divisão')) return 3;
    if (cargoLower.includes('adm') && cargoLower.includes('divisão')) return 4;
    if (cargoLower.includes('armas') || cargoLower.includes('sgt')) return 5;
  }
  
  if (grau === 'X') {
    if (cargoLower === 'pp' || cargoLower.includes('sgt armas pp')) return 1;
    if (cargoLower.includes('camiseta')) return 2;
  }
  
  return 999;
};

const getStatusOrder = (status: string, justificativa: string | null): number => {
  const statusExibicao = getStatusExibicao(status, justificativa);
  switch (statusExibicao) {
    case 'presente': return 1;
    case 'visitante': return 2;
    case 'justificado': return 3;
    case 'ausente': return 4;
    default: return 999;
  }
};

export const ListasConsulta = ({ isAdmin, userDivisaoId }: ListasConsultaProps) => {
  const [eventoSelecionado, setEventoSelecionado] = useState<string>('');

  // Buscar eventos disponíveis (apenas passados ou de hoje)
  const { data: eventos, isLoading: loadingEventos } = useQuery({
    queryKey: ['eventos-lista', userDivisaoId],
    queryFn: async () => {
      const hoje = new Date();
      // Criar data limite em UTC corretamente (fim do dia de hoje)
      const dataLimite = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59, 999));
      
      let query = supabase
        .from('eventos_agenda')
        .select(`
          id,
          titulo,
          data_evento,
          divisao_id,
          divisoes(nome)
        `)
        .lte('data_evento', dataLimite.toISOString())
        .order('data_evento', { ascending: false })
        .limit(50);

      if (!isAdmin && userDivisaoId) {
        query = query.eq('divisao_id', userDivisaoId);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return data;
    }
  });

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

  const eventoAtual = eventos?.find(e => e.id === eventoSelecionado);

  // Ordenar presenças hierarquicamente
  const presencasOrdenadas = useMemo(() => {
    if (!presencas) return [];
    
    return [...presencas].sort((a, b) => {
      // 1. Ordenar por status
      const statusOrderA = getStatusOrder(a.status, a.justificativa_ausencia);
      const statusOrderB = getStatusOrder(b.status, b.justificativa_ausencia);
      if (statusOrderA !== statusOrderB) return statusOrderA - statusOrderB;
      
      // 2. Ordenar por grau
      const grauA = romanToNumber(a.integrantes_portal?.grau || null);
      const grauB = romanToNumber(b.integrantes_portal?.grau || null);
      if (grauA !== grauB) return grauA - grauB;
      
      // 3. Ordenar por cargo
      const cargoOrderA = getCargoOrder(a.integrantes_portal?.cargo_nome || null, a.integrantes_portal?.grau || null);
      const cargoOrderB = getCargoOrder(b.integrantes_portal?.cargo_nome || null, b.integrantes_portal?.grau || null);
      if (cargoOrderA !== cargoOrderB) return cargoOrderA - cargoOrderB;
      
      // 4. Ordenar por nome (considerando visitante externo)
      const nomeA = a.integrantes_portal?.nome_colete || a.visitante_nome || '';
      const nomeB = b.integrantes_portal?.nome_colete || b.visitante_nome || '';
      return nomeA.localeCompare(nomeB, 'pt-BR');
    });
  }, [presencas]);

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
              ) : eventos && eventos.length > 0 ? (
                eventos.map(evento => (
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
            ) : presencasOrdenadas && presencasOrdenadas.length > 0 ? (
              <div className="overflow-x-auto -mx-4 md:mx-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[120px]">Nome</TableHead>
                      <TableHead className="hidden md:table-cell">Divisão</TableHead>
                      <TableHead className="hidden lg:table-cell">Cargo</TableHead>
                      <TableHead className="hidden lg:table-cell">Grau</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden md:table-cell">Confirmado Por</TableHead>
                      <TableHead className="hidden lg:table-cell">Data/Hora</TableHead>
                      <TableHead className="hidden sm:table-cell">Justificativa</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {presencasOrdenadas.map((presenca) => (
                      <TableRow key={presenca.id}>
                        <TableCell className="font-medium text-sm">
                          {presenca.integrantes_portal?.nome_colete 
                            ? removeAccents(presenca.integrantes_portal.nome_colete)
                            : presenca.visitante_nome 
                              ? removeAccents(presenca.visitante_nome)
                              : '-'}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {presenca.integrantes_portal?.divisao_texto 
                            ? removeAccents(presenca.integrantes_portal.divisao_texto)
                            : presenca.visitante_tipo === 'externo' 
                              ? 'Externo' 
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
                        <TableCell className="hidden sm:table-cell max-w-xs truncate">
                          {presenca.status === 'presente' || presenca.status === 'visitante'
                            ? '-' 
                            : (presenca.justificativa_ausencia || 'Não justificado')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma presença registrada para este evento
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
