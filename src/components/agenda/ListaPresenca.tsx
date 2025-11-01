import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin, Camera, X, UserCheck } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarEvent } from "@/lib/googleCalendar";
import { useEventoPresenca } from "@/hooks/useEventoPresenca";
import { useCanManagePresenca } from "@/hooks/useCanManagePresenca";
import { QRCodeScanner } from "./QRCodeScanner";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { removeAccents } from "@/lib/utils";

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
  const { evento, presencas, loading, criarEvento, registrarPresenca, removerPresenca, refetch } = useEventoPresenca(event?.id || null);
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
      
      // Buscar integrantes usando o divisaoId encontrado
      if (divisaoId) {
        await fetchIntegrantesByDivisaoId(divisaoId);
      }
    } else {
      refetch();
      
      // Buscar integrantes usando o divisao_id do evento
      if (existingEvento.divisao_id) {
        await fetchIntegrantesByDivisaoId(existingEvento.divisao_id);
      }
    }
  };

  const getDivisaoIdFromEvent = async (event: CalendarEvent): Promise<string | null> => {
    if (!event.division) return null;

    // Buscar usando normalização para lidar com diferenças de acentuação
    const divisaoNormalizada = removeAccents(event.division.toLowerCase());
    
    const { data: allDivisoes } = await supabase
      .from('divisoes')
      .select('id, nome');
    
    if (!allDivisoes) return null;
    
    // Filtrar no cliente com normalização
    const divisaoEncontrada = allDivisoes.find(d => {
      const nomeNormalizado = removeAccents(d.nome.toLowerCase());
      return nomeNormalizado.includes(divisaoNormalizada) || 
             divisaoNormalizada.includes(nomeNormalizado);
    });

    return divisaoEncontrada?.id || null;
  };

  const fetchIntegrantesByDivisaoId = async (divisaoId: string) => {
    console.log('[fetchIntegrantesByDivisaoId] Buscando integrantes para divisao_id:', divisaoId);
    
    // Primeiro buscar o nome da divisão
    const { data: divisao } = await supabase
      .from('divisoes')
      .select('nome')
      .eq('id', divisaoId)
      .single();
    
    if (!divisao) {
      console.error('[fetchIntegrantesByDivisaoId] Divisão não encontrada');
      setIntegrantesDivisao([]);
      return;
    }
    
    console.log('[fetchIntegrantesByDivisaoId] Nome da divisão:', divisao.nome);
    
    // Buscar integrantes usando o nome exato da divisão
    const { data, error } = await supabase
      .from('integrantes_portal')
      .select('id, nome_colete, cargo_nome, grau, divisao_texto, profile_id')
      .eq('ativo', true)
      .ilike('divisao_texto', `%${divisao.nome}%`)
      .order('cargo_nome', { ascending: false })
      .order('grau', { ascending: false });

    if (error) {
      console.error('[fetchIntegrantesByDivisaoId] Erro ao buscar integrantes:', error);
      setIntegrantesDivisao([]);
    } else {
      console.log(`[fetchIntegrantesByDivisaoId] Encontrados ${data?.length || 0} integrantes`);
      setIntegrantesDivisao(data || []);
    }
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

  const handleMarcarPresente = async (integrante: IntegranteDivisao) => {
    if (!evento) {
      toast({
        title: "Erro",
        description: "Evento não encontrado",
        variant: "destructive",
      });
      return;
    }

    await registrarPresenca(integrante.id, integrante.profile_id || '');
  };

  const handleMarcarAusente = async (integranteId: string) => {
    const presenca = presencas.find(p => p.integrante_id === integranteId);
    if (!presenca) return;
    
    await removerPresenca(presenca.id);
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

            {/* Contador */}
            <div className="flex items-center justify-center gap-6 p-4 bg-muted rounded-lg">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{presentes.length}</div>
                <div className="text-sm text-muted-foreground">Presentes</div>
              </div>
              <div className="h-8 w-px bg-border" />
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{ausentes.length}</div>
                <div className="text-sm text-muted-foreground">Ausentes</div>
              </div>
              <div className="h-8 w-px bg-border" />
              <div className="text-center">
                <div className="text-2xl font-bold">{integrantesDivisao.length}</div>
                <div className="text-sm text-muted-foreground">Total</div>
              </div>
            </div>

            {/* Botão Adicionar Presença */}
            {canManage && (
              <Button
                onClick={() => setScannerOpen(true)}
                className="w-full"
              >
                <Camera className="mr-2 h-4 w-4" />
                Escanear QR Code
              </Button>
            )}

            {loading && (
              <p className="text-center text-muted-foreground py-4">
                Carregando integrantes...
              </p>
            )}

            {!loading && integrantesDivisao.length === 0 && (
              <p className="text-center text-muted-foreground py-4">
                Nenhum integrante encontrado para esta divisão
              </p>
            )}

            {/* Lista de Presentes */}
            {presentes.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="font-semibold text-lg text-green-600">Presentes</h3>
                  <Badge className="bg-green-600">{presentes.length}</Badge>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Cargo</TableHead>
                      <TableHead>Grau</TableHead>
                      {canManage && <TableHead className="w-[120px]">Ações</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {presentes.map((integrante) => {
                      return (
                        <TableRow key={integrante.id} className="bg-green-50 dark:bg-green-950/20">
                          <TableCell className="font-medium">{integrante.nome_colete}</TableCell>
                          <TableCell>{integrante.cargo_nome || '-'}</TableCell>
                          <TableCell>{integrante.grau || '-'}</TableCell>
                          {canManage && (
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleMarcarAusente(integrante.id)}
                                title="Marcar como ausente"
                              >
                                <X className="h-4 w-4 text-red-600" />
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
                  <h3 className="font-semibold text-lg text-orange-600">Ausentes</h3>
                  <Badge variant="secondary">{ausentes.length}</Badge>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Cargo</TableHead>
                      <TableHead>Grau</TableHead>
                      {canManage && <TableHead className="w-[120px]">Ações</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ausentes.map((integrante) => (
                      <TableRow key={integrante.id} className="opacity-60 hover:opacity-100 transition-opacity">
                        <TableCell className="font-medium">{integrante.nome_colete}</TableCell>
                        <TableCell>{integrante.cargo_nome || '-'}</TableCell>
                        <TableCell>{integrante.grau || '-'}</TableCell>
                        {canManage && (
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMarcarPresente(integrante)}
                              title="Marcar como presente"
                            >
                              <UserCheck className="h-4 w-4 text-green-600" />
                            </Button>
                          </TableCell>
                        )}
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
