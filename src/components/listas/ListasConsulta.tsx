import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Users } from "lucide-react";
import { removeAccents } from "@/lib/utils";

interface ListasConsultaProps {
  isAdmin: boolean;
  userDivisaoId?: string;
}

export const ListasConsulta = ({ isAdmin, userDivisaoId }: ListasConsultaProps) => {
  const [eventoSelecionado, setEventoSelecionado] = useState<string>('');

  // Buscar eventos disponíveis
  const { data: eventos, isLoading: loadingEventos } = useQuery({
    queryKey: ['eventos-lista', userDivisaoId],
    queryFn: async () => {
      let query = supabase
        .from('eventos_agenda')
        .select(`
          id,
          titulo,
          data_evento,
          divisao_id,
          divisoes(nome)
        `)
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'presente':
        return <Badge className="bg-green-600 hover:bg-green-700">Presente</Badge>;
      case 'ausente':
        return <Badge variant="destructive">Ausente</Badge>;
      case 'justificado':
        return <Badge className="bg-amber-600 hover:bg-amber-700">Justificado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const estatisticas = presencas ? {
    total: presencas.length,
    presentes: presencas.filter(p => p.status === 'presente').length,
    ausentes: presencas.filter(p => p.status === 'ausente').length,
    justificados: presencas.filter(p => p.status === 'justificado').length
  } : null;

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
            ) : presencas && presencas.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Divisão</TableHead>
                      <TableHead>Cargo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Confirmado Por</TableHead>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Justificativa</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {presencas.map((presenca) => (
                      <TableRow key={presenca.id}>
                        <TableCell className="font-medium">
                          {presenca.integrantes_portal?.nome_colete 
                            ? removeAccents(presenca.integrantes_portal.nome_colete)
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {presenca.integrantes_portal?.divisao_texto 
                            ? removeAccents(presenca.integrantes_portal.divisao_texto)
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {presenca.integrantes_portal?.cargo_nome 
                            ? `${removeAccents(presenca.integrantes_portal.cargo_nome)}${presenca.integrantes_portal.grau ? ` (${removeAccents(presenca.integrantes_portal.grau)})` : ''}`
                            : '-'}
                        </TableCell>
                        <TableCell>{getStatusBadge(presenca.status)}</TableCell>
                        <TableCell>{presenca.confirmado_por || '-'}</TableCell>
                        <TableCell>
                          {presenca.confirmado_em 
                            ? format(new Date(presenca.confirmado_em), "dd/MM/yy HH:mm", { locale: ptBR })
                            : '-'}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {presenca.status === 'presente' 
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
