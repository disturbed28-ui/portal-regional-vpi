import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin, Camera, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarEvent } from "@/lib/googleCalendar";
import { useEventoPresenca } from "@/hooks/useEventoPresenca";
import { useCanManagePresenca } from "@/hooks/useCanManagePresenca";
import { QRCodeScanner } from "./QRCodeScanner";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ListaPresencaProps {
  event: CalendarEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface IntegranteDivisao {
  id: string;
  nome_colete: string;
  cargo_nome: string | null;
  grau: string | null;
  divisao_texto: string;
  profile_id: string | null;
}

export function ListaPresenca({ event, open, onOpenChange }: ListaPresencaProps) {
  const [scannerOpen, setScannerOpen] = useState(false);
  const [integrantesDivisao, setIntegrantesDivisao] = useState<IntegranteDivisao[]>([]);
  const { canManage, loading: loadingPermissions } = useCanManagePresenca();
  const { evento, presencas, loading, criarEvento, registrarPresenca, refetch } = useEventoPresenca(event?.id || null);
  const { toast } = useToast();

  useEffect(() => {
    if (open && event) {
      initializeEvento();
    }
  }, [open, event]);

  const initializeEvento = async () => {
    if (!event) return;

    // Verificar se evento já existe no banco
    const { data: existingEvento } = await supabase
      .from('eventos_agenda')
      .select('*')
      .eq('evento_id', event.id)
      .maybeSingle();

    if (!existingEvento) {
      // Criar evento se não existir
      const divisaoId = await getDivisaoIdFromEvent(event);
      await criarEvento(
        event.id,
        event.title,
        event.start,
        null, // regionalId - pode ser derivado da divisão
        divisaoId,
        event.type || null
      );
    } else {
      refetch();
    }

    // Buscar integrantes da divisão
    if (event.division) {
      fetchIntegrantesDivisao(event.division);
    }
  };

  const getDivisaoIdFromEvent = async (event: CalendarEvent): Promise<string | null> => {
    if (!event.division) return null;

    const { data } = await supabase
      .from('divisoes')
      .select('id')
      .ilike('nome', `%${event.division}%`)
      .maybeSingle();

    return data?.id || null;
  };

  const fetchIntegrantesDivisao = async (divisaoTexto: string) => {
    // Dividir se houver múltiplas divisões separadas por " / "
    const divisoes = divisaoTexto.split(' / ').map(d => d.trim());
    
    let allIntegrantes: IntegranteDivisao[] = [];
    
    for (const divisao of divisoes) {
      const { data, error } = await supabase
        .from('integrantes_portal')
        .select('id, nome_colete, cargo_nome, grau, divisao_texto, profile_id')
        .eq('ativo', true)
        .ilike('divisao_texto', `%${divisao}%`)
        .order('cargo_nome', { ascending: false })
        .order('grau', { ascending: false });

      if (error) {
        console.error('Erro ao buscar integrantes:', error);
      } else if (data) {
        allIntegrantes = [...allIntegrantes, ...data];
      }
    }
    
    // Remover duplicatas (caso um integrante apareça em múltiplas consultas)
    const uniqueIntegrantes = Array.from(
      new Map(allIntegrantes.map(item => [item.id, item])).values()
    );
    
    setIntegrantesDivisao(uniqueIntegrantes);
  };

  const handleScan = async (profileId: string, integranteId: string) => {
    if (!evento) {
      toast({
        title: "Erro",
        description: "Evento não encontrado",
        variant: "destructive",
      });
      return;
    }

    await registrarPresenca(integranteId, profileId);
  };

  if (!event) return null;

  const startDate = new Date(event.start);
  
  // Separar presentes e ausentes
  const presencasIds = new Set(presencas.map(p => p.integrante_id));
  const presentes = integrantesDivisao.filter(i => presencasIds.has(i.id));
  const ausentes = integrantesDivisao.filter(i => !presencasIds.has(i.id));

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">{event.title}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Informações do Evento */}
            <div className="space-y-2 border-b pb-4">
              {event.division && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Divisão:</span>
                  <span>{event.division}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Data:</span>
                <span>{format(startDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Horário:</span>
                <span>{format(startDate, "HH:mm", { locale: ptBR })}</span>
              </div>
            </div>

            {/* Botão Adicionar Presença */}
            {canManage && (
              <Button
                onClick={() => setScannerOpen(true)}
                className="w-full"
              >
                <Camera className="mr-2 h-4 w-4" />
                Adicionar Presença (QR Code)
              </Button>
            )}

            {/* Lista de Presentes */}
            {presentes.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="font-semibold text-lg">Presentes</h3>
                  <Badge variant="default">{presentes.length}</Badge>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Cargo</TableHead>
                      <TableHead>Grau</TableHead>
                      {canManage && <TableHead className="w-[100px]">Ações</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {presentes.map((integrante) => {
                      const presenca = presencas.find(p => p.integrante_id === integrante.id);
                      return (
                        <TableRow key={integrante.id} className="bg-green-50 dark:bg-green-950/20">
                          <TableCell className="font-medium">{integrante.nome_colete}</TableCell>
                          <TableCell>{integrante.cargo_nome || '-'}</TableCell>
                          <TableCell>{integrante.grau || '-'}</TableCell>
                          {canManage && presenca && (
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (confirm('Remover presença?')) {
                                    // Implementar remoção
                                  }
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Lista de Ausentes */}
            {ausentes.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="font-semibold text-lg">Ausentes</h3>
                  <Badge variant="secondary">{ausentes.length}</Badge>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Cargo</TableHead>
                      <TableHead>Grau</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ausentes.map((integrante) => (
                      <TableRow key={integrante.id} className="opacity-60">
                        <TableCell className="font-medium">{integrante.nome_colete}</TableCell>
                        <TableCell>{integrante.cargo_nome || '-'}</TableCell>
                        <TableCell>{integrante.grau || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {!canManage && !loadingPermissions && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Você não tem permissão para gerenciar a lista de presença
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <QRCodeScanner
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onScan={handleScan}
      />
    </>
  );
}
