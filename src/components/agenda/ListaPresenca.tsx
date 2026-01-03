import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Clock, MapPin, Camera, X, UserCheck, Heart, Briefcase, Users, Search, ChevronDown, ChevronRight, Filter } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarEvent } from "@/lib/googleCalendar";
import { useEventoPresenca } from "@/hooks/useEventoPresenca";
import { useCanManagePresenca } from "@/hooks/useCanManagePresenca";
import { QRCodeScanner } from "./QRCodeScanner";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { removeAccents, normalizeSearchTerm } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useScreenAccess } from "@/hooks/useScreenAccess";
import { useProfile } from "@/hooks/useProfile";

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

// Funções de ordenação FORA do componente para evitar recriação a cada render
const romanToNumberLocal = (roman: string | null): number => {
  if (!roman) return 999;
  const romanMap: { [key: string]: number } = {
    'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5,
    'VI': 6, 'VII': 7, 'VIII': 8, 'IX': 9, 'X': 10,
    'XI': 11, 'XII': 12
  };
  return romanMap[roman.toUpperCase()] || 999;
};

const getCargoOrderLocal = (cargo: string | null, grau: string | null): number => {
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
  
  return 999;
};

const ordenarPorHierarquiaLocal = (a: any, b: any) => {
  const grauA = romanToNumberLocal(a.grau);
  const grauB = romanToNumberLocal(b.grau);
  
  if (grauA !== grauB) return grauA - grauB;
  
  const getTipoGrau = (cargo: string | null): number => {
    if (!cargo) return 3;
    const cargoUpper = cargo.toUpperCase();
    if (cargoUpper.includes('PP')) return 1;
    if (cargoUpper.includes('FULL')) return 2;
    return 3;
  };
  
  const tipoA = getTipoGrau(a.cargo_nome);
  const tipoB = getTipoGrau(b.cargo_nome);
  
  if (tipoA !== tipoB) return tipoA - tipoB;
  
  const ordemCargoA = getCargoOrderLocal(a.cargo_nome, a.grau);
  const ordemCargoB = getCargoOrderLocal(b.cargo_nome, b.grau);
  
  if (ordemCargoA !== ordemCargoB) return ordemCargoA - ordemCargoB;
  
  const cargoA = a.cargo_nome || '';
  const cargoB = b.cargo_nome || '';
  
  if (cargoA !== cargoB) return cargoA.localeCompare(cargoB, 'pt-BR');
  
  const nomeA = a.nome_colete || '';
  const nomeB = b.nome_colete || '';
  return nomeA.localeCompare(nomeB, 'pt-BR');
};

export function ListaPresenca({ event, open, onOpenChange }: ListaPresencaProps) {
  const [scannerOpen, setScannerOpen] = useState(false);
  const [nomeColeteSearch, setNomeColeteSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [justificativaDialog, setJustificativaDialog] = useState<{ open: boolean; integranteId: string | null }>({
    open: false,
    integranteId: null,
  });
  const [visitanteExternoDialog, setVisitanteExternoDialog] = useState({
    open: false,
    nome: "",
  });
  
  // Estados para carregar divisão (CMD e Regional)
  const [showCarregarDivisaoDialog, setShowCarregarDivisaoDialog] = useState(false);
  const [loadingDivisao, setLoadingDivisao] = useState(false);
  
  // Estado para filtro por divisão
  const [filtroDivisao, setFiltroDivisao] = useState<string>("todas");
  const [divisoesExpandidas, setDivisoesExpandidas] = useState<Set<string>>(new Set());

  const { canManage, loading: loadingPermissions } = useCanManagePresenca();
  const { 
    evento, 
    presencas, 
    loading, 
    criarEvento, 
    registrarPresenca, 
    removerPresenca, 
    registrarVisitanteExterno,
    inicializarListaRegional,
    carregarDivisaoCMD,
    excluirDaLista,
    refetch 
  } = useEventoPresenca(event?.id || null);
  const { toast } = useToast();
  const { user } = useAuth();
  const { profile: userProfile } = useProfile(user?.id);
  
  // Validar permissão para abrir Lista de Presença
  const { hasAccess: hasScreenAccessLista, loading: loadingScreenAccessLista } = 
    useScreenAccess('/lista-presenca', user?.id);

  // Detectar tipo de evento
  const tipoEvento = useMemo(() => {
    if (!event) return 'divisao';
    
    const titulo = event.title?.toUpperCase() || '';
    const division = event.division?.toUpperCase() || '';
    
    // Evento CMD: título ou divisão contém "CMD" ou "COMANDO"
    if (titulo.includes('CMD') || titulo.includes('COMANDO') || 
        division.includes('CMD') || division.includes('COMANDO')) {
      return 'cmd';
    }
    
    // Evento Regional: divisão contém "REGIONAL" mas não é uma divisão específica
    if (division.includes('REGIONAL') && !division.includes('DIVISAO')) {
      return 'regional';
    }
    
    // Evento de Divisão: tem uma divisão específica
    return 'divisao';
  }, [event]);

  const isRegional = tipoEvento === 'regional';
  const isCMD = tipoEvento === 'cmd';

  // Fechar modal automaticamente se não tiver permissão
  useEffect(() => {
    if (open && !loadingScreenAccessLista && !hasScreenAccessLista) {
      console.log('[ListaPresenca] Usuário sem permissão - fechando modal');
      onOpenChange(false);
      toast({
        title: "Acesso Negado",
        description: "Você não tem permissão para acessar a lista de presença",
        variant: "destructive",
      });
    }
  }, [open, loadingScreenAccessLista, hasScreenAccessLista, onOpenChange, toast]);

  useEffect(() => {
    if (open && event) {
      initializeEvento();
    }
  }, [open, event]);

  // Expandir automaticamente a divisão do usuário
  useEffect(() => {
    if (userProfile?.divisao && (isRegional || isCMD)) {
      setDivisoesExpandidas(new Set([userProfile.divisao]));
    }
  }, [userProfile?.divisao, isRegional, isCMD]);

  const initializeEvento = async () => {
    if (!event || !user) return;

    // Verificar se evento já existe no banco
    const { data: existingEvento } = await supabase
      .from('eventos_agenda')
      .select('*')
      .eq('evento_id', event.id)
      .maybeSingle();

    if (!existingEvento) {
      // Criar evento se não existir
      const divisaoId = getDivisaoIdFromEvent(event);
      const regionalId = await getRegionalIdFromEvent(event);
      
      await criarEvento(
        event.id,
        event.title,
        event.start,
        regionalId,
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
      
      // EVENTO DE DIVISÃO: Inicializar automaticamente se vazio
      if (tipoEvento === 'divisao' && count === 0 && existingEvento.divisao_id) {
        console.log('[initializeEvento] Evento de divisão sem presenças, inicializando...');
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
            refetch();
            toast({
              title: "Lista criada",
              description: `${data.count} integrantes registrados como ausentes`,
            });
          }
        } catch (error) {
          console.error('[initializeEvento] Erro:', error);
        }
      }
      
      // EVENTO REGIONAL ou CMD: Exibir diálogo para carregar divisão
      if ((tipoEvento === 'regional' || tipoEvento === 'cmd') && userProfile?.divisao_id) {
        setShowCarregarDivisaoDialog(true);
      }
    }
  };

  const getRegionalIdFromEvent = async (event: CalendarEvent): Promise<string | null> => {
    if (!event.division) return null;
    
    const normalizeText = (text: string) => {
      return removeAccents(text).toLowerCase().replace(/\s+/g, ' ').trim();
    };
    
    const divisionNorm = normalizeText(event.division);
    
    // Buscar regional pelo nome
    const { data: regionais } = await supabase
      .from('regionais')
      .select('id, nome');
    
    if (!regionais) return null;
    
    const regional = regionais.find(r => {
      const nomeNorm = normalizeText(r.nome);
      return divisionNorm.includes(nomeNorm) || nomeNorm.includes(divisionNorm);
    });
    
    return regional?.id || null;
  };

  const getDivisaoIdFromEvent = (event: CalendarEvent): string | null => {
    // Usar diretamente o divisao_id que já vem do CalendarEvent
    // Já foi resolvido no parsing do Google Calendar - 100% preciso
    if (event.divisao_id) {
      console.log('[getDivisaoIdFromEvent] Usando divisao_id do evento:', event.divisao_id);
      return event.divisao_id;
    }
    
    console.log('[getDivisaoIdFromEvent] Evento sem divisao_id:', event.title);
    return null;
  };

  const handleLoadDivisao = async () => {
    if (!evento || !user || !userProfile?.divisao_id) {
      setShowCarregarDivisaoDialog(false);
      return;
    }
    
    setLoadingDivisao(true);
    try {
      const result = await carregarDivisaoCMD(
        evento.id,
        userProfile.divisao_id,
        user.id
      );
      
      if (result.already_loaded) {
        toast({
          title: "Divisão já carregada",
          description: "Os integrantes da sua divisão já estão na lista",
        });
      } else {
        toast({
          title: "Divisão carregada",
          description: `${result.count} integrantes adicionados`,
        });
        refetch();
      }
    } catch (error) {
      console.error('[handleLoadDivisao] Erro:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar integrantes da divisão",
        variant: "destructive",
      });
    } finally {
      setLoadingDivisao(false);
      setShowCarregarDivisaoDialog(false);
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

  const handleConfirmarVisitanteExterno = async () => {
    const sucesso = await registrarVisitanteExterno(visitanteExternoDialog.nome);
    if (sucesso) {
      setVisitanteExternoDialog({ open: false, nome: "" });
      setNomeColeteSearch("");
    }
  };

  const handleCancelarVisitanteExterno = () => {
    setVisitanteExternoDialog({ open: false, nome: "" });
  };

  const handleExcluirDaLista = async (integranteId: string, presencaId: string) => {
    if (!evento) return;
    await excluirDaLista(presencaId);
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
    const termoBusca = normalizeSearchTerm(nomeColeteSearch);
    const { data, error } = await supabase
      .from('integrantes_portal')
      .select('id, nome_colete, cargo_nome, grau, divisao_texto, profile_id')
      .eq('ativo', true)
      .ilike('nome_colete_ascii', `%${termoBusca}%`)
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
      setVisitanteExternoDialog({
        open: true,
        nome: nomeColeteSearch.trim(),
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

  const toggleDivisaoExpandida = (divisao: string) => {
    const novas = new Set(divisoesExpandidas);
    if (novas.has(divisao)) {
      novas.delete(divisao);
    } else {
      novas.add(divisao);
    }
    setDivisoesExpandidas(novas);
  };

  // ==========================================
  // TODOS OS useMemo ANTES DOS EARLY RETURNS
  // para respeitar a regra de hooks do React
  // ==========================================

  // Separar por status e ordenar - MEMOIZADO para evitar loop infinito
  const { presentes, visitantes, todosPresentes, ausentes, totalDivisao } = useMemo(() => {
    if (!presencas || presencas.length === 0) {
      return {
        presentes: [],
        visitantes: [],
        todosPresentes: [],
        ausentes: [],
        totalDivisao: 0,
      };
    }

    const _presentes = presencas
      .filter(p => p.status === 'presente')
      .map(p => ({
        ...p.integrante,
        presencaId: p.id,
        isVisitante: false,
      }))
      .sort(ordenarPorHierarquiaLocal);

    const _visitantesInternos = presencas
      .filter(p => p.status === 'visitante' && p.integrante_id !== null)
      .map(p => ({
        ...p.integrante!,
        presencaId: p.id,
        isVisitante: true,
        isExterno: false,
      }))
      .sort(ordenarPorHierarquiaLocal);

    const _visitantesExternos = presencas
      .filter(p => p.status === 'visitante' && p.integrante_id === null)
      .map(p => ({
        id: p.id,
        nome_colete: p.visitante_nome || 'Visitante Externo',
        cargo_nome: null,
        grau: null,
        divisao_texto: 'Externo',
        profile_id: null,
        presencaId: p.id,
        isVisitante: true,
        isExterno: true,
      }));

    const _visitantes = [..._visitantesInternos, ..._visitantesExternos];
    const _todosPresentes = [..._presentes, ..._visitantes];

    const _ausentes = presencas
      .filter(p => p.status === 'ausente')
      .map(p => ({
        ...p.integrante,
        presencaId: p.id,
        justificativa_ausencia: p.justificativa_ausencia,
      }))
      .sort(ordenarPorHierarquiaLocal);

    return {
      presentes: _presentes,
      visitantes: _visitantes,
      todosPresentes: _todosPresentes,
      ausentes: _ausentes,
      totalDivisao: _presentes.length + _ausentes.length,
    };
  }, [presencas]);

  // Agrupar por divisão para eventos Regional/CMD
  const presencasAgrupadasPorDivisao = useMemo(() => {
    if (!isRegional && !isCMD) return null;
    
    const grupos: Record<string, { presentes: any[], ausentes: any[] }> = {};
    
    todosPresentes.forEach(p => {
      const divisao = p.divisao_texto || 'Sem Divisão';
      if (!grupos[divisao]) grupos[divisao] = { presentes: [], ausentes: [] };
      grupos[divisao].presentes.push(p);
    });
    
    ausentes.forEach(a => {
      const divisao = a.divisao_texto || 'Sem Divisão';
      if (!grupos[divisao]) grupos[divisao] = { presentes: [], ausentes: [] };
      grupos[divisao].ausentes.push(a);
    });
    
    return grupos;
  }, [isRegional, isCMD, todosPresentes, ausentes]);

  // Lista de divisões únicas para o filtro
  const divisoesUnicas = useMemo(() => {
    if (!presencasAgrupadasPorDivisao) return [];
    return Object.keys(presencasAgrupadasPorDivisao).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [presencasAgrupadasPorDivisao]);

  // Filtrar dados se houver filtro ativo
  const dadosFiltrados = useMemo(() => {
    if (filtroDivisao === 'todas' || !presencasAgrupadasPorDivisao) {
      return { presentes: todosPresentes, ausentes };
    }
    
    const grupo = presencasAgrupadasPorDivisao[filtroDivisao];
    return {
      presentes: grupo?.presentes || [],
      ausentes: grupo?.ausentes || [],
    };
  }, [filtroDivisao, presencasAgrupadasPorDivisao, todosPresentes, ausentes]);

  // ==========================================
  // EARLY RETURNS (após todos os hooks)
  // ==========================================
  
  if (loadingScreenAccessLista) {
    return null;
  }

  if (!hasScreenAccessLista) {
    return null;
  }

  if (!event) return null;

  const startDate = new Date(event.start);

  // Renderização de integrante para cards mobile
  const renderIntegranteCardPresente = (integrante: any) => (
    <div 
      key={integrante.id} 
      className={`p-3 rounded-lg border ${
        integrante.isVisitante 
          ? "bg-blue-50/80 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800" 
          : "bg-green-50/80 dark:bg-green-950/40 border-green-200 dark:border-green-800"
      }`}
    >
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-foreground truncate">{integrante.nome_colete}</span>
            {integrante.isVisitante && (
              <Badge 
                variant={integrante.isExterno ? "secondary" : "outline"} 
                className={`text-xs ${integrante.isExterno ? "" : "text-blue-700 border-blue-700 dark:text-blue-400 dark:border-blue-400"}`}
              >
                {integrante.isExterno ? 'Externo' : 'Visitante'}
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-1 truncate">
            {integrante.divisao_texto}
          </div>
          <div className="text-xs text-muted-foreground">
            {integrante.cargo_nome || '-'} • Grau {integrante.grau || '-'}
          </div>
        </div>
        {canManage && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 flex-shrink-0"
            onClick={() => handleMarcarAusente(integrante.id)}
            title="Marcar como ausente"
          >
            <X className="h-4 w-4 text-red-600" />
          </Button>
        )}
      </div>
    </div>
  );

  const getJustificativaIcon = (justificativa: string | null | undefined) => {
    if (!justificativa) return null;
    switch (justificativa) {
      case 'saude': return <Heart className="h-3 w-3 text-red-500" />;
      case 'trabalho': return <Briefcase className="h-3 w-3 text-blue-500" />;
      case 'familia': return <Users className="h-3 w-3 text-green-500" />;
      case 'nao_justificado': return <X className="h-3 w-3 text-gray-500" />;
      default: return null;
    }
  };

  const getJustificativaLabel = (justificativa: string | null | undefined) => {
    if (!justificativa) return 'Sem justificativa';
    switch (justificativa) {
      case 'saude': return 'Saúde';
      case 'trabalho': return 'Trabalho';
      case 'familia': return 'Família';
      case 'nao_justificado': return 'Não Justificado';
      default: return '-';
    }
  };

  const renderIntegranteCardAusente = (integrante: any) => (
    <div 
      key={integrante.id} 
      className="p-3 rounded-lg border bg-orange-50/50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800"
    >
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-foreground truncate">{integrante.nome_colete}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {integrante.cargo_nome || '-'} • Grau {integrante.grau || '-'}
          </div>
          <div className="flex items-center gap-1 mt-1">
            {getJustificativaIcon(integrante.justificativa_ausencia)}
            <span className="text-xs text-foreground/70">{getJustificativaLabel(integrante.justificativa_ausencia)}</span>
          </div>
        </div>
        {canManage && (
          <div className="flex gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => handleMarcarPresente(integrante)}
              title="Marcar como presente"
            >
              <UserCheck className="h-4 w-4 text-green-600" />
            </Button>
            {(!integrante.justificativa_ausencia || integrante.justificativa_ausencia === 'nao_justificado') && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setJustificativaDialog({ open: true, integranteId: integrante.id })}
                title="Adicionar justificativa"
              >
                <Heart className="h-4 w-4 text-orange-500" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 hover:bg-red-100 dark:hover:bg-red-950"
              onClick={() => handleExcluirDaLista(integrante.id, integrante.presencaId)}
              title="Excluir da lista"
            >
              <X className="h-4 w-4 text-red-600" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[98vw] max-w-4xl sm:w-auto max-h-[95vh] sm:max-h-[90vh] overflow-y-auto px-3 sm:px-6">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-2xl flex items-center gap-2 flex-wrap">
              {event.title}
              {isRegional && <Badge variant="secondary" className="text-xs">Regional</Badge>}
              {isCMD && <Badge variant="outline" className="text-xs">CMD</Badge>}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 sm:space-y-6">
            {/* Informações do Evento */}
            <div className="space-y-1 sm:space-y-2 border-b pb-3 sm:pb-4">
              {event.division && (
                <div className="flex items-center gap-2 text-sm sm:text-base">
                  <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="font-medium">Divisão:</span>
                  <span className="truncate">{event.division}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm sm:text-base">
                <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="font-medium">Data:</span>
                <span>{format(startDate, "dd/MM/yyyy", { locale: ptBR })}</span>
              </div>
              <div className="flex items-center gap-2 text-sm sm:text-base">
                <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="font-medium">Horário:</span>
                <span>{format(startDate, "HH:mm", { locale: ptBR })}</span>
              </div>
            </div>

            {/* Loading Divisão */}
            {loadingDivisao && (
              <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                <span>Carregando integrantes da divisão...</span>
              </div>
            )}

            {/* Contador - Responsivo */}
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 p-3 sm:p-4 bg-muted/50 rounded-lg">
              <div className="text-center min-w-[70px]">
                <div className="text-2xl sm:text-3xl font-bold text-green-600 dark:text-green-500">{dadosFiltrados.presentes.length}</div>
                <div className="text-xs sm:text-sm font-medium text-foreground/70">Presentes</div>
              </div>
              <div className="h-8 w-px bg-border hidden sm:block" />
              <div className="text-center min-w-[70px]">
                <div className="text-2xl sm:text-3xl font-bold text-orange-600 dark:text-orange-500">{dadosFiltrados.ausentes.length}</div>
                <div className="text-xs sm:text-sm font-medium text-foreground/70">Ausentes</div>
              </div>
              <div className="h-8 w-px bg-border hidden sm:block" />
              <div className="text-center min-w-[70px] w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50">
                <div className="text-2xl sm:text-3xl font-bold text-foreground">{dadosFiltrados.presentes.length + dadosFiltrados.ausentes.length}</div>
                <div className="text-xs sm:text-sm font-medium text-foreground/70">Total</div>
              </div>
            </div>

            {/* Filtro por Divisão (apenas para Regional/CMD) */}
            {(isRegional || isCMD) && divisoesUnicas.length > 1 && (
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={filtroDivisao} onValueChange={setFiltroDivisao}>
                  <SelectTrigger className="w-full max-w-[250px]">
                    <SelectValue placeholder="Filtrar por divisão" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="todas">Todas as divisões</SelectItem>
                    {divisoesUnicas.map(d => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Botão Carregar Minha Divisão (CMD ou Regional) */}
            {(isCMD || isRegional) && canManage && userProfile?.divisao_id && (
              <Button
                onClick={() => setShowCarregarDivisaoDialog(true)}
                variant="outline"
                className="w-full"
                disabled={loadingDivisao}
              >
                {loadingDivisao ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                    Carregando...
                  </>
                ) : (
                  <>
                    <Users className="mr-2 h-4 w-4" />
                    Carregar Minha Divisão
                  </>
                )}
              </Button>
            )}

            {/* Campo de Busca por Nome de Colete */}
            {canManage && (
              <div className="space-y-2 sm:space-y-3 border rounded-lg p-3 sm:p-4 bg-muted/50">
                <Label htmlFor="nome-colete" className="text-sm sm:text-base font-semibold text-foreground">
                  🔍 Buscar por Nome de Colete
                </Label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    id="nome-colete"
                    placeholder="Digite o nome..."
                    value={nomeColeteSearch}
                    onChange={(e) => setNomeColeteSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSearchNomeColete();
                      }
                    }}
                    className="flex-1"
                  />
                  <Button 
                    onClick={handleSearchNomeColete}
                    disabled={isSearching}
                    className="w-full sm:w-auto"
                  >
                    <Search className="h-4 w-4 mr-2 sm:mr-0" />
                    <span className="sm:hidden">Buscar</span>
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
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-foreground truncate">{integrante.nome_colete}</div>
                          <div className="text-xs sm:text-sm text-foreground/70 truncate">
                            {integrante.divisao_texto} • {integrante.cargo_nome || 'Sem cargo'}
                          </div>
                        </div>
                        <UserCheck className="h-5 w-5 text-green-600 dark:text-green-500 flex-shrink-0 ml-2" />
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

            {/* VISUALIZAÇÃO AGRUPADA POR DIVISÃO (Regional/CMD) */}
            {(isRegional || isCMD) && presencasAgrupadasPorDivisao && filtroDivisao === 'todas' ? (
              <div className="space-y-3">
                {divisoesUnicas.map(divisao => {
                  const grupo = presencasAgrupadasPorDivisao[divisao];
                  const totalGrupo = grupo.presentes.length + grupo.ausentes.length;
                  const isExpanded = divisoesExpandidas.has(divisao);
                  
                  return (
                    <Collapsible 
                      key={divisao} 
                      open={isExpanded}
                      onOpenChange={() => toggleDivisaoExpandida(divisao)}
                    >
                      <CollapsibleTrigger className="w-full flex items-center justify-between p-3 bg-muted/50 hover:bg-muted rounded-lg transition-colors">
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <span className="font-medium text-sm truncate">{divisao}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-green-600 border-green-600">
                            {grupo.presentes.length}
                          </Badge>
                          <Badge variant="outline" className="text-orange-600 border-orange-600">
                            {grupo.ausentes.length}
                          </Badge>
                          <Badge variant="secondary">{totalGrupo}</Badge>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-2 space-y-2">
                        {grupo.presentes.length > 0 && (
                          <div className="space-y-1">
                            <div className="text-xs font-medium text-green-600 px-2">Presentes ({grupo.presentes.length})</div>
                            {grupo.presentes.map(renderIntegranteCardPresente)}
                          </div>
                        )}
                        {grupo.ausentes.length > 0 && (
                          <div className="space-y-1">
                            <div className="text-xs font-medium text-orange-600 px-2">Ausentes ({grupo.ausentes.length})</div>
                            {grupo.ausentes.map(renderIntegranteCardAusente)}
                          </div>
                        )}
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </div>
            ) : (
              /* VISUALIZAÇÃO SIMPLES (Divisão ou com filtro ativo) */
              <>
                {/* Lista de Presentes */}
                {dadosFiltrados.presentes.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2 sm:mb-3">
                      <h3 className="font-semibold text-base sm:text-lg text-green-600 dark:text-green-500">Presentes</h3>
                      <Badge className="bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600">{dadosFiltrados.presentes.length}</Badge>
                    </div>
                    
                    {/* Desktop: Tabela */}
                    <div className="hidden sm:block">
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
                          {dadosFiltrados.presentes.map((integrante) => (
                            <TableRow 
                              key={integrante.id} 
                              className={integrante.isVisitante 
                                ? "bg-blue-100/80 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-colors" 
                                : "bg-green-100/80 dark:bg-green-950/40 hover:bg-green-100 dark:hover:bg-green-950/50 transition-colors"
                              }
                            >
                              <TableCell className="font-medium text-foreground">
                                <div className="flex items-center gap-2">
                                  {integrante.nome_colete}
                                  {integrante.isVisitante && (
                                    <Badge variant={(integrante as any).isExterno ? "secondary" : "outline"} className={(integrante as any).isExterno ? "" : "text-blue-700 border-blue-700 dark:text-blue-400 dark:border-blue-400 bg-white/50 dark:bg-transparent"}>
                                      {(integrante as any).isExterno ? 'Visitante (Externo)' : 'Visitante'}
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-sm font-medium text-foreground">
                                {integrante.divisao_texto}
                              </TableCell>
                              <TableCell className="text-foreground">{integrante.cargo_nome || '-'}</TableCell>
                              <TableCell className="text-foreground">{integrante.grau || '-'}</TableCell>
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
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Mobile: Cards */}
                    <div className="block sm:hidden space-y-2">
                      {dadosFiltrados.presentes.map(renderIntegranteCardPresente)}
                    </div>
                  </div>
                )}

                {/* Lista de Ausentes */}
                {dadosFiltrados.ausentes.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2 sm:mb-3">
                      <h3 className="font-semibold text-base sm:text-lg text-orange-600 dark:text-orange-500">Ausentes</h3>
                      <Badge className="bg-orange-600 text-white hover:bg-orange-700 dark:bg-orange-600 dark:hover:bg-orange-700">{dadosFiltrados.ausentes.length}</Badge>
                    </div>

                    {/* Desktop: Tabela */}
                    <div className="hidden sm:block">
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
                          {dadosFiltrados.ausentes.map((integrante) => (
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
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Mobile: Cards */}
                    <div className="block sm:hidden space-y-2">
                      {dadosFiltrados.ausentes.map(renderIntegranteCardAusente)}
                    </div>
                  </div>
                )}
              </>
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
        <AlertDialogContent className="w-[95vw] max-w-md sm:w-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg sm:text-xl">Selecione a Justificativa</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Escolha o motivo da ausência
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-2 sm:gap-3 mt-3 sm:mt-4">
            <Button
              variant="outline"
              className="h-auto py-3 sm:py-4 justify-start gap-2 sm:gap-3"
              onClick={() => handleConfirmarAusencia('saude')}
            >
              <Heart className="h-5 w-5 text-red-500 flex-shrink-0" />
              <div className="text-left">
                <div className="font-semibold text-sm sm:text-base">Saúde</div>
                <div className="text-xs text-muted-foreground hidden sm:block">Motivos médicos ou de saúde</div>
              </div>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-3 sm:py-4 justify-start gap-2 sm:gap-3"
              onClick={() => handleConfirmarAusencia('trabalho')}
            >
              <Briefcase className="h-5 w-5 text-blue-500 flex-shrink-0" />
              <div className="text-left">
                <div className="font-semibold text-sm sm:text-base">Trabalho</div>
                <div className="text-xs text-muted-foreground hidden sm:block">Compromissos profissionais</div>
              </div>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-3 sm:py-4 justify-start gap-2 sm:gap-3"
              onClick={() => handleConfirmarAusencia('familia')}
            >
              <Users className="h-5 w-5 text-green-500 flex-shrink-0" />
              <div className="text-left">
                <div className="font-semibold text-sm sm:text-base">Família</div>
                <div className="text-xs text-muted-foreground hidden sm:block">Questões familiares</div>
              </div>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-3 sm:py-4 justify-start gap-2 sm:gap-3"
              onClick={() => handleConfirmarAusencia('nao_justificado')}
            >
              <X className="h-5 w-5 text-gray-500 flex-shrink-0" />
              <div className="text-left">
                <div className="font-semibold text-sm sm:text-base">Não Justificado</div>
                <div className="text-xs text-muted-foreground hidden sm:block">Sem justificativa</div>
              </div>
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo para Visitante Externo */}
      <AlertDialog open={visitanteExternoDialog.open} onOpenChange={(open) => !open && handleCancelarVisitanteExterno()}>
        <AlertDialogContent className="w-[95vw] max-w-md sm:w-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg sm:text-xl">Visitante Externo</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              O nome "<strong>{visitanteExternoDialog.nome}</strong>" não foi localizado.
              <br /><br />
              Deseja incluí-lo como <strong>Visitante (Externo)</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col sm:flex-row justify-end gap-2 mt-3 sm:mt-4">
            <Button variant="outline" onClick={handleCancelarVisitanteExterno} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button onClick={handleConfirmarVisitanteExterno} className="w-full sm:w-auto">
              Confirmar
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo Carregar Divisão (CMD ou Regional) */}
      <AlertDialog open={showCarregarDivisaoDialog} onOpenChange={setShowCarregarDivisaoDialog}>
        <AlertDialogContent className="w-[95vw] max-w-md sm:w-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg sm:text-xl">
              {tipoEvento === 'cmd' ? 'Evento CMD' : 'Evento Regional'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Deseja carregar os integrantes da sua divisão neste evento?
              <br /><br />
              <span className="text-muted-foreground">
                Divisão: <strong>{userProfile?.divisao || 'Não identificada'}</strong>
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="w-full sm:w-auto">Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleLoadDivisao}
              disabled={loadingDivisao}
              className="w-full sm:w-auto"
            >
              {loadingDivisao ? 'Carregando...' : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
