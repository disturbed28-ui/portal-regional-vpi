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
      // Criar evento se não existir (isso vai chamar initialize automaticamente)
      const divisaoId = await getDivisaoIdFromEvent(event);
      await criarEvento(
        event.id,
        event.title,
        event.start,
        null,
        divisaoId,
        event.type || null
      );
    } else {
      refetch();
    }
  };

  const getDivisaoIdFromEvent = async (event: CalendarEvent): Promise<string | null> => {
    if (!event.division) return null;

    // Normalizar e extrair palavras-chave do evento
    const normalizeText = (text: string) => {
      return removeAccents(text)
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
    };

    const divisaoEventoNormalizada = normalizeText(event.division);
    console.log('[getDivisaoIdFromEvent] Buscando divisão para:', event.division, '-> normalizada:', divisaoEventoNormalizada);
    
    const { data: allDivisoes } = await supabase
      .from('divisoes')
      .select('id, nome');
    
    if (!allDivisoes) return null;
    
    // Extrair palavras-chave principais (remover palavras comuns)
    const palavrasChave = divisaoEventoNormalizada
      .split(' ')
      .filter(p => !['divisao', 'div', 'sp', '-', 'de', 'do', 'da', 'dos'].includes(p) && p.length > 2);
    
    console.log('[getDivisaoIdFromEvent] Palavras-chave:', palavrasChave);
    
    // Encontrar melhor match
    const divisaoEncontrada = allDivisoes.find(d => {
      const nomeNormalizado = normalizeText(d.nome);
      
      // Verificar se todas as palavras-chave do evento estão no nome da divisão
      const todasPalavrasPresentes = palavrasChave.every(palavra => 
        nomeNormalizado.includes(palavra)
      );
      
      console.log('[getDivisaoIdFromEvent] Comparando com:', d.nome, '-> normalizado:', nomeNormalizado, '-> match:', todasPalavrasPresentes);
      
      return todasPalavrasPresentes;
    });

    console.log('[getDivisaoIdFromEvent] Divisão encontrada:', divisaoEncontrada);
    return divisaoEncontrada?.id || null;
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

  const handleMarcarPresente = async (integrante: any) => {
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
    await removerPresenca(integranteId);
  };

  if (!event) return null;

  const startDate = new Date(event.start);
  
  // Função para converter grau romano em número para ordenação
  const romanToNumber = (roman: string | null): number => {
    if (!roman) return 999; // Sem grau vai para o final
    const romanMap: { [key: string]: number } = {
      'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5,
      'VI': 6, 'VII': 7, 'VIII': 8, 'IX': 9, 'X': 10,
      'XI': 11, 'XII': 12
    };
    return romanMap[roman.toUpperCase()] || 999;
  };

  // Função para obter prioridade do cargo dentro do grau
  const getCargoOrder = (cargo: string | null, grau: string | null): number => {
    if (!cargo) return 999;
    
    const cargoLower = cargo.toLowerCase();
    
    // Grau V - Cargos Regionais
    if (grau === 'V') {
      if (cargoLower.includes('diretor regional')) return 1;
      if (cargoLower.includes('operacional regional')) return 2;
      if (cargoLower.includes('social regional')) return 3;
      if (cargoLower.includes('adm') && cargoLower.includes('regional')) return 4;
      if (cargoLower.includes('comunicação') || cargoLower.includes('comunicacao')) return 5;
    }
    
    // Grau VI - Cargos de Divisão
    if (grau === 'VI') {
      if (cargoLower.includes('diretor') && cargoLower.includes('divisão')) return 1;
      if (cargoLower.includes('sub diretor')) return 2;
      if (cargoLower.includes('social') && cargoLower.includes('divisão')) return 3;
      if (cargoLower.includes('adm') && cargoLower.includes('divisão')) return 4;
      if (cargoLower.includes('armas') || cargoLower.includes('sgt')) return 5;
    }
    
    // Para outros graus, retornar 999 para usar ordem alfabética
    return 999;
  };

  // Função para ordenar por hierarquia
  const ordenarPorHierarquia = (a: any, b: any) => {
    // 1. Ordenar por grau (menor número = maior hierarquia)
    const grauA = romanToNumber(a.grau);
    const grauB = romanToNumber(b.grau);
    
    if (grauA !== grauB) {
      return grauA - grauB;
    }
    
    // 2. Se grau igual, ordenar por prioridade de cargo específica
    const ordemCargoA = getCargoOrder(a.cargo_nome, a.grau);
    const ordemCargoB = getCargoOrder(b.cargo_nome, b.grau);
    
    if (ordemCargoA !== ordemCargoB) {
      return ordemCargoA - ordemCargoB;
    }
    
    // 3. Se prioridade igual (999), usar ordem alfabética do cargo
    const cargoA = a.cargo_nome || '';
    const cargoB = b.cargo_nome || '';
    
    if (cargoA !== cargoB) {
      return cargoA.localeCompare(cargoB, 'pt-BR');
    }
    
    // 4. Se cargo igual, ordenar por nome
    const nomeA = a.nome_colete || '';
    const nomeB = b.nome_colete || '';
    return nomeA.localeCompare(nomeB, 'pt-BR');
  };
  
  // Separar por status e ordenar por hierarquia
  const presentes = presencas
    .filter(p => p.status === 'presente')
    .map(p => ({
      ...p.integrante,
      presencaId: p.id,
      isVisitante: false,
    }))
    .sort(ordenarPorHierarquia);

  const visitantes = presencas
    .filter(p => p.status === 'visitante')
    .map(p => ({
      ...p.integrante,
      presencaId: p.id,
      isVisitante: true,
    }))
    .sort(ordenarPorHierarquia);

  const todosPresentes = [...presentes, ...visitantes];

  const ausentes = presencas
    .filter(p => p.status === 'ausente')
    .map(p => ({
      ...p.integrante,
      presencaId: p.id,
    }))
    .sort(ordenarPorHierarquia);

  // Total da divisão = presentes + ausentes (excluindo visitantes)
  const totalDivisao = presentes.length + ausentes.length;

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
                <div className="text-2xl font-bold text-green-600">{todosPresentes.length}</div>
                <div className="text-sm text-muted-foreground">Presentes</div>
              </div>
              <div className="h-8 w-px bg-border" />
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{ausentes.length}</div>
                <div className="text-sm text-muted-foreground">Ausentes</div>
              </div>
              <div className="h-8 w-px bg-border" />
              <div className="text-center">
                <div className="text-2xl font-bold">{totalDivisao}</div>
                <div className="text-sm text-muted-foreground">Total da Divisão</div>
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
                Carregando lista de presença...
              </p>
            )}

            {/* Lista de Presentes */}
            {todosPresentes.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="font-semibold text-lg text-green-600">Presentes</h3>
                  <Badge className="bg-green-600">{todosPresentes.length}</Badge>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-gray-900 dark:text-gray-100">Nome</TableHead>
                      <TableHead className="text-gray-900 dark:text-gray-100">Divisão</TableHead>
                      <TableHead className="text-gray-900 dark:text-gray-100">Cargo</TableHead>
                      <TableHead className="text-gray-900 dark:text-gray-100">Grau</TableHead>
                      {canManage && <TableHead className="w-[120px] text-gray-900 dark:text-gray-100">Ações</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {todosPresentes.map((integrante) => {
                      return (
                        <TableRow 
                          key={integrante.id} 
                          className={integrante.isVisitante ? "bg-blue-50 dark:bg-blue-950/20" : "bg-green-50 dark:bg-green-950/20"}
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {integrante.nome_colete}
                              {integrante.isVisitante && (
                                <Badge variant="outline" className="text-blue-600 border-blue-600">
                                  Visitante
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {integrante.divisao_texto}
                          </TableCell>
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
                      <TableHead className="text-gray-900 dark:text-gray-100">Nome</TableHead>
                      <TableHead className="text-gray-900 dark:text-gray-100">Cargo</TableHead>
                      <TableHead className="text-gray-900 dark:text-gray-100">Grau</TableHead>
                      {canManage && <TableHead className="w-[120px] text-gray-900 dark:text-gray-100">Ações</TableHead>}
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
