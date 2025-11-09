import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Clock, MapPin, Camera, X, UserCheck, Heart, Briefcase, Users, Search } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { useAuth } from "@/hooks/useAuth";

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
  const [nomeColeteSearch, setNomeColeteSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [justificativaDialog, setJustificativaDialog] = useState<{ open: boolean; integranteId: string | null }>({
    open: false,
    integranteId: null,
  });
  const { canManage, loading: loadingPermissions } = useCanManagePresenca();
  const { evento, presencas, loading, criarEvento, registrarPresenca, removerPresenca, refetch } = useEventoPresenca(event?.id || null);
  const { toast } = useToast();
  const { user } = useAuth();

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
      
      // Verificar se o evento tem presenças
      const { count } = await supabase
        .from('presencas')
        .select('*', { count: 'exact', head: true })
        .eq('evento_agenda_id', existingEvento.id);
      
      // Se o evento existe mas não tem presenças E tem uma divisão, inicializar
      if (count === 0 && existingEvento.divisao_id && user) {
        console.log('[initializeEvento] Evento sem presenças, inicializando lista...');
        try {
          const { data, error } = await supabase.functions.invoke('manage-presenca', {
            body: {
              action: 'initialize',
              user_id: user.id,
              evento_agenda_id: existingEvento.id,
              divisao_id: existingEvento.divisao_id,
            }
          });
          
          if (error) {
            console.error('[initializeEvento] Erro ao inicializar:', error);
            toast({
              title: "Erro ao inicializar lista",
              description: error.message || "Não foi possível criar a lista de presença",
              variant: "destructive",
            });
          } else {
            console.log(`[initializeEvento] ${data.count} integrantes registrados`);
            refetch(); // Atualizar dados após inicialização
            toast({
              title: "Lista criada",
              description: `${data.count} integrantes registrados como ausentes`,
            });
          }
        } catch (error) {
          console.error('[initializeEvento] Erro:', error);
          toast({
            title: "Erro",
            description: "Não foi possível criar a lista de presença",
            variant: "destructive",
          });
        }
      }
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

  const handleMarcarAusente = (integranteId: string) => {
    setJustificativaDialog({ open: true, integranteId });
  };

  const handleConfirmarAusencia = async (justificativa: string) => {
    if (!justificativaDialog.integranteId) return;
    
    await removerPresenca(justificativaDialog.integranteId, justificativa);
    setJustificativaDialog({ open: false, integranteId: null });
  };

  const handleExcluirDaLista = async (integranteId: string, presencaId: string) => {
    if (!evento) return;
    
    try {
      const { error } = await supabase
        .from('presencas')
        .delete()
        .eq('id', presencaId);
      
      if (error) throw error;
      
      toast({
        title: "Integrante removido",
        description: "O integrante foi excluído da lista de presença",
      });
      
      refetch();
    } catch (error) {
      console.error('Erro ao excluir:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o integrante da lista",
        variant: "destructive",
      });
    }
  };

  const handleSearchNomeColete = async () => {
    if (!nomeColeteSearch.trim()) {
      toast({
        title: "Campo vazio",
        description: "Digite um nome de colete para buscar",
        variant: "destructive",
      });
      return;
    }

    setIsSearching(true);
    const { data, error } = await supabase
      .from('integrantes_portal')
      .select('id, nome_colete, cargo_nome, grau, divisao_texto, profile_id')
      .eq('ativo', true)
      .ilike('nome_colete', `%${nomeColeteSearch.trim()}%`)
      .limit(10);

    if (error) {
      console.error('Erro ao buscar integrante:', error);
      toast({
        title: "Erro",
        description: "Não foi possível buscar o integrante",
        variant: "destructive",
      });
    } else if (data && data.length > 0) {
      setSearchResults(data);
    } else {
      toast({
        title: "Não encontrado",
        description: "Nenhum integrante encontrado com esse nome",
      });
      setSearchResults([]);
    }
    setIsSearching(false);
  };

  const handleSelectSearchResult = async (integrante: any) => {
    await handleMarcarPresente(integrante);
    setNomeColeteSearch("");
    setSearchResults([]);
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
    
    // Grau X - PP vem antes de Camiseta
    if (grau === 'X') {
      if (cargoLower === 'pp' || cargoLower.includes('sgt armas pp')) return 1;
      if (cargoLower.includes('camiseta')) return 2;
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
      justificativa_ausencia: p.justificativa_ausencia,
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
            <div className="flex items-center justify-center gap-6 p-4 bg-muted/50 rounded-lg">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600 dark:text-green-500">{todosPresentes.length}</div>
                <div className="text-sm font-medium text-foreground/70">Presentes</div>
              </div>
              <div className="h-8 w-px bg-border" />
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-600 dark:text-orange-500">{ausentes.length}</div>
                <div className="text-sm font-medium text-foreground/70">Ausentes</div>
              </div>
              <div className="h-8 w-px bg-border" />
              <div className="text-center">
                <div className="text-3xl font-bold text-foreground">{totalDivisao}</div>
                <div className="text-sm font-medium text-foreground/70">Total da Divisão</div>
              </div>
            </div>

            {/* Campo de Busca por Nome de Colete */}
            {canManage && (
              <div className="space-y-3 border rounded-lg p-4 bg-muted/50">
                <Label htmlFor="nome-colete" className="text-base font-semibold text-foreground">
                  🔍 Buscar por Nome de Colete
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="nome-colete"
                    placeholder="Digite o nome do colete..."
                    value={nomeColeteSearch}
                    onChange={(e) => setNomeColeteSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSearchNomeColete();
                      }
                    }}
                  />
                  <Button 
                    onClick={handleSearchNomeColete}
                    disabled={isSearching}
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
                
                {/* Resultados da Busca */}
                {searchResults.length > 0 && (
                  <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-2 bg-card">
                    {searchResults.map((integrante) => (
                      <div
                        key={integrante.id}
                        className="flex items-center justify-between p-2 hover:bg-muted/50 rounded cursor-pointer transition-colors"
                        onClick={() => handleSelectSearchResult(integrante)}
                      >
                        <div>
                          <div className="font-medium text-foreground">{integrante.nome_colete}</div>
                          <div className="text-sm text-foreground/70">
                            {integrante.divisao_texto} • {integrante.cargo_nome || 'Sem cargo'}
                          </div>
                        </div>
                        <UserCheck className="h-5 w-5 text-green-600 dark:text-green-500" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Botão Escanear QR Code */}
            {canManage && (
              <Button
                onClick={() => setScannerOpen(true)}
                variant="outline"
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
                  <h3 className="font-semibold text-lg text-green-600 dark:text-green-500">Presentes</h3>
                  <Badge className="bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600">{todosPresentes.length}</Badge>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-semibold text-foreground">Nome</TableHead>
                      <TableHead className="font-semibold text-foreground">Divisão</TableHead>
                      <TableHead className="font-semibold text-foreground">Cargo</TableHead>
                      <TableHead className="font-semibold text-foreground">Grau</TableHead>
                      {canManage && <TableHead className="w-[120px] font-semibold text-foreground">Ações</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {todosPresentes.map((integrante) => {
                      return (
                        <TableRow 
                          key={integrante.id} 
                          className={integrante.isVisitante 
                            ? "bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-950/40" 
                            : "bg-green-50 dark:bg-green-950/30 hover:bg-green-100 dark:hover:bg-green-950/40"
                          }
                        >
                          <TableCell className="font-medium text-foreground">
                            <div className="flex items-center gap-2">
                              {integrante.nome_colete}
                              {integrante.isVisitante && (
                                <Badge variant="outline" className="text-blue-600 border-blue-600 dark:text-blue-400 dark:border-blue-400">
                                  Visitante
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm font-medium text-foreground/90">
                            {integrante.divisao_texto}
                          </TableCell>
                          <TableCell className="text-foreground/80">{integrante.cargo_nome || '-'}</TableCell>
                          <TableCell className="text-foreground/80">{integrante.grau || '-'}</TableCell>
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
                  <h3 className="font-semibold text-lg text-orange-600 dark:text-orange-500">Ausentes</h3>
                  <Badge className="bg-orange-600 text-white hover:bg-orange-700 dark:bg-orange-600 dark:hover:bg-orange-700">{ausentes.length}</Badge>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-semibold text-foreground">Nome</TableHead>
                      <TableHead className="font-semibold text-foreground">Cargo</TableHead>
                      <TableHead className="font-semibold text-foreground">Grau</TableHead>
                      <TableHead className="font-semibold text-foreground">Justificativa</TableHead>
                      {canManage && <TableHead className="w-[120px] font-semibold text-foreground">Ações</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ausentes.map((integrante) => {
                      const getJustificativaIcon = (justificativa: string | null | undefined) => {
                        if (!justificativa) return null;
                        switch (justificativa) {
                          case 'saude':
                            return <Heart className="h-4 w-4 text-red-500" />;
                          case 'trabalho':
                            return <Briefcase className="h-4 w-4 text-blue-500" />;
                          case 'familia':
                            return <Users className="h-4 w-4 text-green-500" />;
                          case 'nao_justificado':
                            return <X className="h-4 w-4 text-gray-500" />;
                          default:
                            return null;
                        }
                      };

                      const getJustificativaLabel = (justificativa: string | null | undefined) => {
                        if (!justificativa) return '-';
                        switch (justificativa) {
                          case 'saude':
                            return 'Saúde';
                          case 'trabalho':
                            return 'Trabalho';
                          case 'familia':
                            return 'Família';
                          case 'nao_justificado':
                            return 'Não Justificado';
                          default:
                            return '-';
                        }
                      };

                      return (
                        <TableRow key={integrante.id} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="font-medium text-foreground">{integrante.nome_colete}</TableCell>
                          <TableCell className="text-foreground/80">{integrante.cargo_nome || '-'}</TableCell>
                          <TableCell className="text-foreground/80">{integrante.grau || '-'}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getJustificativaIcon(integrante.justificativa_ausencia)}
                              <span className="text-sm text-foreground/70">{getJustificativaLabel(integrante.justificativa_ausencia)}</span>
                            </div>
                          </TableCell>
                          {canManage && (
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleMarcarPresente(integrante)}
                                  title="Marcar como presente"
                                >
                                  <UserCheck className="h-4 w-4 text-green-600" />
                                </Button>
                                {(!integrante.justificativa_ausencia || integrante.justificativa_ausencia === 'nao_justificado') && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setJustificativaDialog({ open: true, integranteId: integrante.id })}
                                    title="Adicionar justificativa"
                                  >
                                    <Heart className="h-4 w-4 text-orange-500" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleExcluirDaLista(integrante.id, integrante.presencaId)}
                                  title="Excluir da lista"
                                  className="hover:bg-red-100 dark:hover:bg-red-950"
                                >
                                  <X className="h-4 w-4 text-red-600" />
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
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

      {/* Dialog de Justificativa */}
      <AlertDialog 
        open={justificativaDialog.open} 
        onOpenChange={(open) => setJustificativaDialog({ open, integranteId: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Selecione a Justificativa</AlertDialogTitle>
            <AlertDialogDescription>
              Escolha o motivo da ausência
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-3 mt-4">
            <Button
              variant="outline"
              className="h-auto py-4 justify-start gap-3"
              onClick={() => handleConfirmarAusencia('saude')}
            >
              <Heart className="h-5 w-5 text-red-500" />
              <div className="text-left">
                <div className="font-semibold">Saúde</div>
                <div className="text-xs text-muted-foreground">Motivos médicos ou de saúde</div>
              </div>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 justify-start gap-3"
              onClick={() => handleConfirmarAusencia('trabalho')}
            >
              <Briefcase className="h-5 w-5 text-blue-500" />
              <div className="text-left">
                <div className="font-semibold">Trabalho</div>
                <div className="text-xs text-muted-foreground">Compromissos profissionais</div>
              </div>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 justify-start gap-3"
              onClick={() => handleConfirmarAusencia('familia')}
            >
              <Users className="h-5 w-5 text-green-500" />
              <div className="text-left">
                <div className="font-semibold">Família</div>
                <div className="text-xs text-muted-foreground">Questões familiares</div>
              </div>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 justify-start gap-3"
              onClick={() => handleConfirmarAusencia('nao_justificado')}
            >
              <X className="h-5 w-5 text-gray-500" />
              <div className="text-left">
                <div className="font-semibold">Não Justificado</div>
                <div className="text-xs text-muted-foreground">Sem justificativa</div>
              </div>
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
