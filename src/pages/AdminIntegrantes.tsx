import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useIntegrantes } from "@/hooks/useIntegrantes";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { supabase } from "@/integrations/supabase/client";
import { parseExcelFile, processDelta, parseCargoGrau, TransferenciaDetectada } from "@/lib/excelParser";
import { parseMensalidadesExcel, formatRef, ParseResult } from "@/lib/mensalidadesParser";
import { Upload, ArrowLeft, Users, UserCheck, UserX, AlertCircle, FileSpreadsheet, History, Info, RefreshCw, XCircle, Eye, ArrowRightLeft, CheckCircle2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { HistoricoDevedores } from "@/components/admin/HistoricoDevedores";
import { useMensalidades } from "@/hooks/useMensalidades";
import { format } from "date-fns";
import { DialogAtualizados } from "@/components/admin/DialogAtualizados";
import type { IntegrantePortal } from "@/hooks/useIntegrantes";
import type { ExcelIntegrante } from "@/lib/excelParser";
import { CargaAfastados } from "@/components/admin/CargaAfastados";
import { DeltasPendentes } from "@/components/relatorios/DeltasPendentes";
import { usePendencias } from "@/hooks/usePendencias";
import { LimparDeltasFalsos } from "@/components/admin/LimparDeltasFalsos";
import { ProfileDetailDialog } from "@/components/admin/ProfileDetailDialog";
import { containsNormalized } from "@/lib/utils";
import { useRegionais } from "@/hooks/useRegionais";
import { useCargosGrau4 } from "@/hooks/useCargosGrau4";

const AdminIntegrantes = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mensalidadesInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { hasAccess, loading: loadingAccess } = useAdminAccess();
  
  const { integrantes, loading, stats, refetch } = useIntegrantes({ ativo: true });
  const [searchTerm, setSearchTerm] = useState("");
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<any>(null);
  const [processing, setProcessing] = useState(false);
  const [mensalidadesPreview, setMensalidadesPreview] = useState<ParseResult | null>(null);
  const [showHistoricoDialog, setShowHistoricoDialog] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [ultimaCarga, setUltimaCarga] = useState<{
    id: string;
    data_carga: string;
    total_atualizados: number;
  } | null>(null);
  const [showAtualizadosDialog, setShowAtualizadosDialog] = useState(false);
  const [showRemovidosDialog, setShowRemovidosDialog] = useState(false);
const [removidosConfirmados, setRemovidosConfirmados] = useState<Array<{
    integrante_id: string;
    registro_id: number;
    nome_colete: string;
    divisao_texto: string;
    motivo_inativacao: string;
    observacao_inativacao: string;
    // Campos para promoção (Grau IV)
    novo_cargo_id?: string;
    novo_cargo_nome?: string;
    nova_regional_id?: string;
    nova_regional_texto?: string;
    // Campos para transferência interna
    destino_regional_id?: string;
    destino_regional_texto?: string;
    destino_divisao_id?: string;
    destino_divisao_texto?: string;
    // Estado de verificação de transferência
    verificando_transferencia?: boolean;
    encontrado_em_outra_regional?: boolean;
  }>>([]);
  const [transferidosDetectados, setTransferidosDetectados] = useState<TransferenciaDetectada[]>([]);
  const [regionalDaCarga, setRegionalDaCarga] = useState<string>('');
  
const { ultimaCargaInfo, devedoresAtivos } = useMensalidades();
  const { hasRole } = useUserRole(user?.id);
  const { regionais } = useRegionais();
  const { cargosGrau4 } = useCargosGrau4();
  
  // Hook para deltas de afastados (admin vê todos)
  const { pendencias, loading: pendenciasLoading } = usePendencias(
    user?.id,
    hasRole('admin') ? 'admin' : 'user'
  );

  const integrantesFiltrados = integrantes.filter((i) =>
    containsNormalized(i.nome_colete, searchTerm)
  );

  useEffect(() => {
    if (!loadingAccess && !hasAccess) {
      toast({
        title: "Acesso negado",
        description: "Você não tem permissão para acessar esta página.",
        variant: "destructive",
      });
      navigate("/");
    }
  }, [loadingAccess, hasAccess, navigate, toast]);

  const handleOpenProfile = async (integrante: IntegrantePortal) => {
    // Se não está vinculado, mostrar mensagem
    if (!integrante.vinculado || !integrante.profile_id) {
      toast({
        title: "Integrante não vinculado",
        description: "Este integrante ainda não está vinculado a um perfil de usuário. Vincule-o primeiro na página de administração.",
        variant: "default",
      });
      return;
    }

    // Buscar o profile completo
    setLoadingProfile(true);
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select(`
          *,
          comandos:comando_id(nome),
          regionais:regional_id(nome),
          divisoes:divisao_id(nome),
          cargos:cargo_id(nome, grau),
          funcoes:funcao_id(nome)
        `)
        .eq('id', integrante.profile_id)
        .single();

      if (error) throw error;

      setSelectedProfile(profile);
      setDetailDialogOpen(true);
    } catch (error) {
      console.error('Erro ao buscar perfil:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar os detalhes do perfil",
        variant: "destructive",
      });
    } finally {
      setLoadingProfile(false);
    }
  };

  if (loadingAccess || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) return null;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setProcessing(true);
      const excelData = await parseExcelFile(file);
      
      // Validação de sanidade: verificar se IDs são válidos
      if (excelData.length === 0) {
        throw new Error('Nenhum registro válido encontrado no arquivo. Verifique o formato do Excel.');
      }
      
      const idsValidos = excelData.filter(i => i.id_integrante > 0);
      if (idsValidos.length === 0) {
        throw new Error('Nenhum ID válido encontrado. Verifique se a coluna de ID existe e está preenchida corretamente.');
      }
      
      // Passar todos os integrantes ativos para verificar transferências entre regionais
      const delta = processDelta(excelData, integrantes, integrantes);
      
      // Guardar regional detectada e transferidos
      setRegionalDaCarga(delta.regional_detectada);
      setTransferidosDetectados(delta.transferidos);
      
      // Filtrar integrantes apenas da regional da carga para verificação de sanidade
      const integrantesDaRegional = integrantes.filter(i => i.regional_texto === delta.regional_detectada);
      
      // VERIFICAÇÃO DE SANIDADE: Se 100% dos integrantes DA REGIONAL serão removidos, algo está errado
      const porcentagemRemocao = integrantesDaRegional.length > 0 
        ? (delta.removidos.length / integrantesDaRegional.length) * 100 
        : 0;
      
      if (porcentagemRemocao > 95 && integrantesDaRegional.length > 10) {
        console.error('[AdminIntegrantes] ⚠️ ALERTA: Remoção em massa detectada!', {
          regional_da_carga: delta.regional_detectada,
          total_regional: integrantesDaRegional.length,
          total_excel: excelData.length,
          removidos: delta.removidos.length,
          transferidos: delta.transferidos.length,
          porcentagem: porcentagemRemocao.toFixed(1) + '%'
        });
        
        throw new Error(
          `⚠️ ATENÇÃO: ${delta.removidos.length} de ${integrantesDaRegional.length} integrantes da ${delta.regional_detectada} (${porcentagemRemocao.toFixed(0)}%) seriam inativados!\n\n` +
          `Isso sugere um problema na leitura dos IDs do arquivo Excel.\n\n` +
          `Verifique:\n` +
          `• Se a coluna de ID está presente no arquivo\n` +
          `• Se os IDs estão preenchidos corretamente\n` +
          `• Os logs do console para mais detalhes`
        );
      }
      
      setUploadPreview({
        file: file.name,
        delta,
        excelData,
      });
      
      // Se há removidos (que não são transferências), abrir dialog de confirmação primeiro
      if (delta.removidos.length > 0) {
        setRemovidosConfirmados(delta.removidos.map((r: any) => ({
          integrante_id: r.id,
          registro_id: r.registro_id,
          nome_colete: r.nome_colete,
          divisao_texto: r.divisao_texto,
          motivo_inativacao: '',
          observacao_inativacao: ''
        })));
        setShowRemovidosDialog(true);
      } else {
        setShowUploadDialog(true);
      }
    } catch (error) {
      toast({
        title: "Erro ao processar arquivo",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleApplyChanges = async () => {
    if (!uploadPreview) return;

    if (!user) {
      toast({
        title: "Erro de autenticacao",
        description: "Usuario nao autenticado",
        variant: "destructive",
      });
      return;
    }

    try {
      setProcessing(true);
      const { delta } = uploadPreview;

      // Preparar dados para inserção com validação de cargo_grau
      const novosData = delta.novos
        .filter((item: any) => {
          // Validar campo obrigatório cargo_grau
          if (!item.cargo_grau || item.cargo_grau.trim() === '') {
            console.warn('[AdminIntegrantes] ⚠️ Novo registro sem cargo_grau será ignorado:', {
              id: item.id_integrante,
              nome: item.nome_colete,
              cargo_grau_encontrado: item.cargo_grau
            });
            return false; // Remove do array
          }
          return true;
        })
        .map((item: any) => {
          const { cargo, grau } = parseCargoGrau(item.cargo_grau);
          return {
            registro_id: item.id_integrante,
            nome_colete: item.nome_colete,
            comando_texto: item.comando,
            regional_texto: item.regional,
            divisao_texto: item.divisao,
            cargo_grau_texto: item.cargo_grau,
            cargo_nome: cargo,
            grau: grau,
            ativo: true,
            cargo_estagio: item.cargo_estagio || null,
            sgt_armas: item.sgt_armas || false,
            caveira: item.caveira || false,
            caveira_suplente: item.caveira_suplente || false,
            batedor: item.batedor || false,
            ursinho: item.ursinho || false,
            lobo: item.lobo || false,
            tem_moto: item.tem_moto || false,
            tem_carro: item.tem_carro || false,
            data_entrada: item.data_entrada || null,
          };
        });
      
      // Feedback visual se registros forem filtrados
      if (delta.novos.length !== novosData.length) {
        const ignorados = delta.novos.length - novosData.length;
        toast({
          title: "⚠️ Registros Ignorados",
          description: `${ignorados} novo(s) registro(s) sem cargo foram ignorados. Verifique os logs do console.`,
          variant: "destructive"
        });
      }

      // Preparar dados para atualização com validação de cargo_grau
      const atualizadosData = delta.atualizados
        .filter((item: any) => {
          // Validar campo obrigatório cargo_grau
          if (!item.novo.cargo_grau || item.novo.cargo_grau.trim() === '') {
            console.warn('[AdminIntegrantes] ⚠️ Atualização sem cargo_grau será ignorada:', {
              id: item.antigo.registro_id,
              nome: item.novo.nome_colete,
              cargo_grau_encontrado: item.novo.cargo_grau
            });
            return false; // Remove do array
          }
          return true;
        })
        .map((item: any) => {
          const { cargo, grau } = parseCargoGrau(item.novo.cargo_grau);
          return {
            id: item.antigo.id,
            nome_colete: item.novo.nome_colete,
            comando_texto: item.novo.comando,
            regional_texto: item.novo.regional,
            divisao_texto: item.novo.divisao,
            cargo_grau_texto: item.novo.cargo_grau,
            cargo_nome: cargo,
            grau: grau,
            cargo_estagio: item.novo.cargo_estagio || null,
            sgt_armas: item.novo.sgt_armas || false,
            caveira: item.novo.caveira || false,
            caveira_suplente: item.novo.caveira_suplente || false,
            batedor: item.novo.batedor || false,
            ursinho: item.novo.ursinho || false,
            lobo: item.novo.lobo || false,
            tem_moto: item.novo.tem_moto || false,
            tem_carro: item.novo.tem_carro || false,
            data_entrada: item.novo.data_entrada || null,
          };
        });
      
      // Feedback visual se atualizações forem filtradas
      if (delta.atualizados.length !== atualizadosData.length) {
        const ignorados = delta.atualizados.length - atualizadosData.length;
        toast({
          title: "⚠️ Atualizações Ignoradas",
          description: `${ignorados} atualização(ões) sem cargo foram ignoradas. Verifique os logs do console.`,
          variant: "destructive"
        });
      }

      // Log do payload antes de enviar
      console.log('[AdminIntegrantes] 📤 Payload sendo enviado:', {
        novos_count: novosData.length,
        atualizados_count: atualizadosData.length,
        primeiro_novo: novosData[0],
        primeiro_atualizado: atualizadosData[0],
        todos_novos_tem_cargo_grau: novosData.every((item: any) => item.cargo_grau_texto && item.cargo_grau_texto.trim() !== ''),
        todos_atualizados_tem_cargo_grau: atualizadosData.every((item: any) => item.cargo_grau_texto && item.cargo_grau_texto.trim() !== ''),
        formato_data_entrada_novos: novosData.filter((item: any) => item.data_entrada).map((item: any) => ({ id: item.registro_id, data: item.data_entrada })),
        formato_data_entrada_atualizados: atualizadosData.filter((item: any) => item.data_entrada).slice(0, 3).map((item: any) => ({ id: item.registro_id, data: item.data_entrada }))
      });

// Separar removidos em 4 grupos baseado no motivo
      
      // Grupo 1: Para INATIVAR (desligado, expulso, falecido, outro, transferido SEM destino interno)
      const removidosParaInativar = removidosConfirmados
        .filter(r => {
          if (!r.motivo_inativacao) return false;
          // Afastado e promovido nunca inativam
          if (['afastado', 'promovido'].includes(r.motivo_inativacao)) return false;
          // Transferido com destino interno não inativa
          if (r.motivo_inativacao === 'transferido' && r.destino_regional_id) return false;
          return true;
        })
        .map(r => ({
          integrante_id: r.integrante_id,
          registro_id: r.registro_id,
          nome_colete: r.nome_colete,
          motivo_inativacao: r.motivo_inativacao,
          observacao_inativacao: r.observacao_inativacao || ''
        }));
      
      // Grupo 2: Para PROMOVER (Grau IV)
      const removidosParaPromover = removidosConfirmados
        .filter(r => r.motivo_inativacao === 'promovido')
        .map(r => ({
          integrante_id: r.integrante_id,
          registro_id: r.registro_id,
          nome_colete: r.nome_colete,
          novo_cargo_id: r.novo_cargo_id,
          novo_cargo_nome: r.novo_cargo_nome,
          nova_regional: r.nova_regional_texto,
          nova_regional_id: r.nova_regional_id,
          observacao: r.observacao_inativacao
        }));
      
      // Grupo 3: AFASTADOS (apenas registrar no histórico, não inativar)
      const removidosAfastados = removidosConfirmados
        .filter(r => r.motivo_inativacao === 'afastado')
        .map(r => ({
          integrante_id: r.integrante_id,
          registro_id: r.registro_id,
          nome_colete: r.nome_colete,
          observacao: r.observacao_inativacao || 'Afastamento temporário detectado na carga'
        }));
      
      // Grupo 4: TRANSFERÊNCIAS INTERNAS (efetivar transferência, não inativar)
      const transferenciasInternas = removidosConfirmados
        .filter(r => r.motivo_inativacao === 'transferido' && r.destino_regional_id)
        .map(r => ({
          integrante_id: r.integrante_id,
          registro_id: r.registro_id,
          nome_colete: r.nome_colete,
          nova_regional_id: r.destino_regional_id,
          nova_regional_texto: r.destino_regional_texto,
          nova_divisao_id: r.destino_divisao_id,
          nova_divisao_texto: r.destino_divisao_texto,
          observacao: r.observacao_inativacao
        }));
      
      console.log('[AdminIntegrantes] 📤 Grupos de removidos:', {
        para_inativar: removidosParaInativar.length,
        para_promover: removidosParaPromover.length,
        afastados: removidosAfastados.length,
        transferencias_internas: transferenciasInternas.length
      });

      // Chamar edge function com os 4 grupos
      const { data, error } = await supabase.functions.invoke('admin-import-integrantes', {
        body: {
          admin_user_id: user.id,
          novos: novosData,
          atualizados: atualizadosData,
          removidos: removidosParaInativar.length > 0 ? removidosParaInativar : undefined,
          promovidos: removidosParaPromover.length > 0 ? removidosParaPromover : undefined,
          afastados_ignorados: removidosAfastados.length > 0 ? removidosAfastados : undefined,
          transferencias_internas: transferenciasInternas.length > 0 ? transferenciasInternas : undefined,
        },
      });

      if (error) {
        throw new Error(error.message || 'Erro ao importar integrantes');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      // Capturar dados da carga retornados pela Edge Function
      if (data?.carga) {
        setUltimaCarga({
          id: data.carga.id,
          data_carga: data.carga.data_carga,
          total_atualizados: data.carga.total_atualizados,
        });
      }

      toast({
        title: "Importacao concluida",
        description: data?.message || `${delta.novos.length} novos, ${delta.atualizados.length} atualizados`,
      });

      setShowUploadDialog(false);
      setUploadPreview(null);
      setRemovidosConfirmados([]);
      setTransferidosDetectados([]);
      setRegionalDaCarga('');
      refetch();
    } catch (error) {
      console.error('Error applying changes:', error);
      toast({
        title: "Erro ao aplicar mudancas",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleMensalidadesFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setProcessing(true);
      const parseResult = await parseMensalidadesExcel(file);

      if (parseResult.mensalidades.length === 0) {
        toast({
          title: "Nenhum dado encontrado",
          description: "O arquivo não contém dados válidos de mensalidades",
          variant: "destructive",
        });
        return;
      }

      setMensalidadesPreview(parseResult);
    } catch (error) {
      toast({
        title: "Erro ao processar arquivo",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
      setMensalidadesPreview(null);
    } finally {
      setProcessing(false);
    }
  };

  const handleUploadMensalidades = async () => {
    if (!mensalidadesPreview || !user) return;

    try {
      setProcessing(true);
      console.log('🚀 Enviando mensalidades para edge function...');
      
      const { data, error } = await supabase.functions.invoke('admin-import-mensalidades', {
        body: {
          user_id: user.id,
          mensalidades: mensalidadesPreview.mensalidades,
          realizado_por: user.user_metadata?.full_name || user.email || 'Admin'
        }
      });

      if (error) {
        toast({
          title: "Erro ao importar mensalidades",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "✅ Mensalidades importadas com sucesso!",
        description: `• ${data.insertedCount} registros importados\n• ${data.liquidatedCount} liquidações detectadas\n• Período: ${mensalidadesPreview.stats.periodoRef}`,
      });

      setMensalidadesPreview(null);
      if (mensalidadesInputRef.current) {
        mensalidadesInputRef.current.value = '';
      }

    } catch (error: any) {
      console.error('💥 Erro inesperado:', error);
      toast({
        title: "Erro inesperado",
        description: error.message || "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  // Função para comparar campos entre integrante antigo e novo
  const compararCampos = (antigo: IntegrantePortal, novo: ExcelIntegrante) => {
    const alteracoes: Array<{ campo: string; anterior: string; novo: string }> = [];
    
    const campos = [
      { key: 'nome_colete', antigoKey: 'nome_colete', novoKey: 'nome_colete' },
      { key: 'comando_texto', antigoKey: 'comando_texto', novoKey: 'comando' },
      { key: 'regional_texto', antigoKey: 'regional_texto', novoKey: 'regional' },
      { key: 'divisao_texto', antigoKey: 'divisao_texto', novoKey: 'divisao' },
      { key: 'cargo_grau_texto', antigoKey: 'cargo_grau_texto', novoKey: 'cargo_grau' },
      { key: 'cargo_estagio', antigoKey: 'cargo_estagio', novoKey: 'cargo_estagio' },
      { key: 'tem_moto', antigoKey: 'tem_moto', novoKey: 'tem_moto' },
      { key: 'tem_carro', antigoKey: 'tem_carro', novoKey: 'tem_carro' },
      { key: 'sgt_armas', antigoKey: 'sgt_armas', novoKey: 'sgt_armas' },
      { key: 'caveira', antigoKey: 'caveira', novoKey: 'caveira' },
      { key: 'caveira_suplente', antigoKey: 'caveira_suplente', novoKey: 'caveira_suplente' },
      { key: 'batedor', antigoKey: 'batedor', novoKey: 'batedor' },
      { key: 'ursinho', antigoKey: 'ursinho', novoKey: 'ursinho' },
      { key: 'lobo', antigoKey: 'lobo', novoKey: 'lobo' },
      { key: 'combate_insano', antigoKey: 'combate_insano', novoKey: 'combate_insano' },
      { key: 'data_entrada', antigoKey: 'data_entrada', novoKey: 'data_entrada' },
    ];
    
    campos.forEach(campo => {
      const valorAntigo = (antigo as any)[campo.antigoKey];
      const valorNovo = (novo as any)[campo.novoKey] ?? null;
      
      // Normalizar valores para comparação
      const antigoStr = valorAntigo === null ? '' : String(valorAntigo);
      const novoStr = valorNovo === null ? '' : String(valorNovo);
      
      if (antigoStr !== novoStr) {
        alteracoes.push({
          campo: campo.key,
          anterior: antigoStr || '-',
          novo: novoStr || '-',
        });
      }
    });
    
    return alteracoes;
  };

  return (
    <div className="admin-page min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/admin')}
            className="flex-shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">Gestao de Integrantes</h1>
            <p className="text-muted-foreground">
              Gerencie o banco de dados de integrantes do portal
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => fileInputRef.current?.click()} disabled={processing}>
              <Upload className="mr-2 h-4 w-4" />
              Importar Integrantes
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleFileSelect}
          />
          <input
            ref={mensalidadesInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleMensalidadesFileSelect}
          />
        </div>

        {/* Estatisticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center space-x-3">
              <Users className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center space-x-3">
              <UserCheck className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Vinculados</p>
                <p className="text-2xl font-bold">{stats.vinculados}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center space-x-3">
              <UserX className="h-8 w-8 text-orange-600" />
              <div>
                <p className="text-sm text-muted-foreground">Nao Vinculados</p>
                <p className="text-2xl font-bold">{stats.naoVinculados}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center space-x-3">
              <AlertCircle className="h-8 w-8 text-red-600" />
              <div>
                <p className="text-sm text-muted-foreground">Inativos</p>
                <p className="text-2xl font-bold">{stats.inativos}</p>
              </div>
            </div>
          </Card>
          <Card 
            className="p-4 cursor-pointer hover:bg-accent transition-colors"
            onClick={() => ultimaCarga && setShowAtualizadosDialog(true)}
            title="Clique para ver detalhes das atualizações"
          >
            <div className="flex items-center space-x-3">
              <RefreshCw className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Atualizados</p>
                <p className="text-2xl font-bold">{ultimaCarga?.total_atualizados || 0}</p>
                {ultimaCarga && (
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(ultimaCarga.data_carga), 'dd/MM/yyyy HH:mm')}
                  </p>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Card de Mensalidades em Atraso */}
        <Card className="border-orange-200">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              <CardTitle>Mensalidades em Atraso</CardTitle>
            </div>
            <CardDescription>
              Importe o relatório de mensalidades. Liquidações são detectadas automaticamente a cada novo upload.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Upload Section */}
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  type="file"
                  accept=".xls,.xlsx"
                  ref={mensalidadesInputRef}
                  onChange={handleMensalidadesFileSelect}
                  className="flex-1 hidden"
                />
                <Button 
                  onClick={() => mensalidadesInputRef.current?.click()}
                  disabled={processing}
                  variant="outline"
                  className="flex-1"
                >
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Selecionar Arquivo
                </Button>
                {mensalidadesPreview && (
                  <Button 
                    onClick={handleUploadMensalidades}
                    disabled={processing}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Confirmar Importação
                  </Button>
                )}
              </div>

              {/* Preview após seleção */}
              {mensalidadesPreview && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>Preview da Importação</AlertTitle>
                  <AlertDescription>
                    • {mensalidadesPreview.stats.totalValidas} registros válidos<br/>
                    • {mensalidadesPreview.stats.divisoesEncontradas.length} divisões<br/>
                    • Período: {mensalidadesPreview.stats.periodoRef}
                  </AlertDescription>
                </Alert>
              )}

              {/* Resumo da última carga */}
              {ultimaCargaInfo && (
                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <h4 className="font-semibold text-foreground">Última Carga Ativa</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-foreground">Data</p>
                      <p className="font-medium text-foreground">
                        {format(new Date(ultimaCargaInfo.data_carga), 'dd/MM/yyyy HH:mm')}
                      </p>
                    </div>
                    <div>
                      <p className="text-foreground">Período</p>
                      <p className="font-medium text-foreground">
                        {formatRef(ultimaCargaInfo.ref_principal)}
                      </p>
                    </div>
                  </div>
                  
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowHistoricoDialog(true)}
                    className="mt-2"
                  >
                    <History className="mr-2 h-4 w-4" />
                    Ver Histórico Completo
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Card de Afastados */}
        <Card className="border-purple-200">
          <CardHeader>
            <div className="flex items-center gap-2">
              <UserX className="h-5 w-5 text-purple-500" />
              <CardTitle>Gestão de Afastados</CardTitle>
            </div>
            <CardDescription>
              Importe a lista de integrantes temporariamente afastados e gerencie exceções detectadas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Área de Carga */}
            <CargaAfastados />
            
            {/* Divisor visual */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Deltas Pendentes
                </span>
              </div>
            </div>
            
            {/* Deltas Pendentes */}
            <DeltasPendentes 
              pendencias={pendencias}
              loading={pendenciasLoading}
              userId={user?.id}
              isAdmin={hasRole('admin')}
            />
            
            {/* Divisor visual */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Ferramentas Administrativas
                </span>
              </div>
            </div>
            
            {/* Limpar Deltas Falsos - Apenas para Admins */}
            {hasRole('admin') && <LimparDeltasFalsos />}
          </CardContent>
        </Card>

        {/* Busca */}
        <Input
          placeholder="Buscar por nome de colete..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md"
        />

        {/* Lista de Integrantes */}
        <Tabs defaultValue="todos">
          <div className="overflow-x-auto -mx-4 px-4 pb-2">
            <TabsList className="inline-flex w-max min-w-full h-auto p-1 gap-1">
              <TabsTrigger value="todos" className="flex-shrink-0 text-xs sm:text-sm px-3 py-1.5 whitespace-nowrap">
                Todos ({stats.total})
              </TabsTrigger>
              <TabsTrigger value="vinculados" className="flex-shrink-0 text-xs sm:text-sm px-3 py-1.5 whitespace-nowrap">
                Vinculados ({stats.vinculados})
              </TabsTrigger>
              <TabsTrigger value="nao-vinculados" className="flex-shrink-0 text-xs sm:text-sm px-3 py-1.5 whitespace-nowrap">
                Não Vinculados ({stats.naoVinculados})
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="todos" className="space-y-4">
            {loading ? (
              <p>Carregando...</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {integrantesFiltrados.map((integrante) => (
                  <Card key={integrante.id} className="p-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold">{integrante.nome_colete}</p>
                          <p className="text-sm text-muted-foreground">
                            Registro: {integrante.registro_id}
                          </p>
                        </div>
                        {integrante.vinculado ? (
                          <Badge variant="secondary">Vinculado</Badge>
                        ) : (
                          <Badge variant="outline">Disponivel</Badge>
                        )}
                      </div>
                      <div className="text-sm space-y-1">
                        <p><span className="font-semibold">Cargo:</span> {integrante.cargo_grau_texto}</p>
                        {integrante.cargo_estagio && (
                          <p><span className="font-semibold">Estagiando:</span> {integrante.cargo_estagio}</p>
                        )}
                        <p><span className="font-semibold">Divisao:</span> {integrante.divisao_texto}</p>
                        <p><span className="font-semibold">Regional:</span> {integrante.regional_texto}</p>
                        {integrante.data_entrada && (
                          <p><span className="font-semibold">Entrada:</span> {new Date(integrante.data_entrada).toLocaleDateString('pt-BR')}</p>
                        )}
                        <div className="flex gap-1 flex-wrap mt-2">
                          {integrante.tem_moto && <Badge variant="secondary">🏍️ Moto</Badge>}
                          {integrante.tem_carro && <Badge variant="secondary">🚗 Carro</Badge>}
                          {integrante.sgt_armas && <Badge variant="secondary">⚔️ Sgt Armas</Badge>}
                          {integrante.caveira && <Badge variant="secondary">💀 Caveira</Badge>}
                          {integrante.caveira_suplente && <Badge variant="outline">💀 Suplente</Badge>}
                          {integrante.batedor && <Badge variant="secondary">🛡️ Batedor</Badge>}
                          {integrante.ursinho && <Badge variant="secondary">🐻 Ursinho</Badge>}
                          {integrante.lobo && <Badge variant="secondary">🐺 Lobo</Badge>}
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-border">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full gap-2"
                          onClick={() => handleOpenProfile(integrante)}
                          disabled={loadingProfile}
                        >
                          <Eye className="h-4 w-4" />
                          {loadingProfile ? "Carregando..." : "Ver Detalhes"}
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="vinculados" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {integrantesFiltrados
                .filter((i) => i.vinculado)
                .map((integrante) => (
                  <Card key={integrante.id} className="p-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold">{integrante.nome_colete}</p>
                          <p className="text-sm text-muted-foreground">
                            Registro: {integrante.registro_id}
                          </p>
                        </div>
                        <Badge variant="secondary">Vinculado</Badge>
                      </div>
                      <div className="text-sm space-y-1">
                        <p><span className="font-semibold">Cargo:</span> {integrante.cargo_grau_texto}</p>
                        {integrante.cargo_estagio && (
                          <p><span className="font-semibold">Estagiando:</span> {integrante.cargo_estagio}</p>
                        )}
                        <p><span className="font-semibold">Divisao:</span> {integrante.divisao_texto}</p>
                        {integrante.data_entrada && (
                          <p><span className="font-semibold">Entrada:</span> {new Date(integrante.data_entrada).toLocaleDateString('pt-BR')}</p>
                        )}
                        <div className="flex gap-1 flex-wrap mt-2">
                          {integrante.tem_moto && <Badge variant="secondary">🏍️ Moto</Badge>}
                          {integrante.tem_carro && <Badge variant="secondary">🚗 Carro</Badge>}
                          {integrante.sgt_armas && <Badge variant="secondary">⚔️ Sgt Armas</Badge>}
                          {integrante.caveira && <Badge variant="secondary">💀 Caveira</Badge>}
                          {integrante.caveira_suplente && <Badge variant="outline">💀 Suplente</Badge>}
                          {integrante.batedor && <Badge variant="secondary">🛡️ Batedor</Badge>}
                          {integrante.ursinho && <Badge variant="secondary">🐻 Ursinho</Badge>}
                          {integrante.lobo && <Badge variant="secondary">🐺 Lobo</Badge>}
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-border">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full gap-2"
                          onClick={() => handleOpenProfile(integrante)}
                          disabled={loadingProfile}
                        >
                          <Eye className="h-4 w-4" />
                          {loadingProfile ? "Carregando..." : "Ver Detalhes"}
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
            </div>
          </TabsContent>

          <TabsContent value="nao-vinculados" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {integrantesFiltrados
                .filter((i) => !i.vinculado)
                .map((integrante) => (
                  <Card key={integrante.id} className="p-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold">{integrante.nome_colete}</p>
                          <p className="text-sm text-muted-foreground">
                            Registro: {integrante.registro_id}
                          </p>
                        </div>
                        <Badge variant="outline">Disponivel</Badge>
                      </div>
                      <div className="text-sm space-y-1">
                        <p><span className="font-semibold">Cargo:</span> {integrante.cargo_grau_texto}</p>
                        {integrante.cargo_estagio && (
                          <p><span className="font-semibold">Estagiando:</span> {integrante.cargo_estagio}</p>
                        )}
                        <p><span className="font-semibold">Divisao:</span> {integrante.divisao_texto}</p>
                        {integrante.data_entrada && (
                          <p><span className="font-semibold">Entrada:</span> {new Date(integrante.data_entrada).toLocaleDateString('pt-BR')}</p>
                        )}
                         <div className="flex gap-1 flex-wrap mt-2">
                          {integrante.tem_moto && <Badge variant="secondary">🏍️ Moto</Badge>}
                          {integrante.tem_carro && <Badge variant="secondary">🚗 Carro</Badge>}
                          {integrante.sgt_armas && <Badge variant="secondary">⚔️ Sgt Armas</Badge>}
                          {integrante.caveira && <Badge variant="secondary">💀 Caveira</Badge>}
                          {integrante.caveira_suplente && <Badge variant="outline">💀 Suplente</Badge>}
                          {integrante.batedor && <Badge variant="secondary">🛡️ Batedor</Badge>}
                          {integrante.ursinho && <Badge variant="secondary">🐻 Ursinho</Badge>}
                          {integrante.lobo && <Badge variant="secondary">🐺 Lobo</Badge>}
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-border">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full gap-2"
                          onClick={() => handleOpenProfile(integrante)}
                          disabled={loadingProfile}
                        >
                          <Eye className="h-4 w-4" />
                          {loadingProfile ? "Carregando..." : "Ver Detalhes"}
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Dialog de Histórico */}
        <Dialog open={showHistoricoDialog} onOpenChange={setShowHistoricoDialog}>
          <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Histórico de Mensalidades</DialogTitle>
            </DialogHeader>
            <HistoricoDevedores />
          </DialogContent>
        </Dialog>

        {/* Diálogo de Atualizados */}
        {ultimaCarga && (
          <DialogAtualizados
            open={showAtualizadosDialog}
            onOpenChange={setShowAtualizadosDialog}
            cargaId={ultimaCarga.id}
            dataCarga={ultimaCarga.data_carga}
            totalAtualizados={ultimaCarga.total_atualizados}
          />
        )}

        {/* Dialog de Confirmação de Remoções */}
        <Dialog open={showRemovidosDialog} onOpenChange={setShowRemovidosDialog}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-destructive" />
                Confirmar Inativações Detectadas
              </DialogTitle>
              <DialogDescription>
                Os seguintes integrantes não estão presentes no arquivo Excel. Selecione o motivo da saída para cada um antes de prosseguir.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 max-h-[50vh] overflow-y-auto">
{removidosConfirmados.map((removido, index) => (
                <Card key={removido.integrante_id} className={`p-4 ${
                  removido.motivo_inativacao === 'afastado' ? 'border-blue-300 bg-blue-50/50' :
                  removido.motivo_inativacao === 'promovido' ? 'border-green-300 bg-green-50/50' :
                  removido.motivo_inativacao === 'transferido' && removido.destino_regional_id ? 'border-emerald-300 bg-emerald-50/50' :
                  'border-orange-200'
                }`}>
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-bold">{removido.nome_colete}</p>
                        <p className="text-sm text-muted-foreground">
                          Registro: {removido.registro_id} • {removido.divisao_texto}
                        </p>
                      </div>
                      {/* Badge de status */}
                      {removido.motivo_inativacao === 'afastado' && (
                        <Badge className="bg-blue-100 text-blue-800 border-blue-300">
                          <Info className="h-3 w-3 mr-1" />
                          Mantém ativo
                        </Badge>
                      )}
                      {removido.motivo_inativacao === 'promovido' && (
                        <Badge className="bg-green-100 text-green-800 border-green-300">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Promoção
                        </Badge>
                      )}
                      {removido.motivo_inativacao === 'transferido' && removido.destino_regional_id && (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">
                          <ArrowRightLeft className="h-3 w-3 mr-1" />
                          Transferência
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Motivo *</label>
                      <Select
                        value={removido.motivo_inativacao}
                        onValueChange={async (value) => {
                          const updated = [...removidosConfirmados];
                          updated[index].motivo_inativacao = value;
                          // Limpar campos ao trocar motivo
                          updated[index].novo_cargo_id = undefined;
                          updated[index].novo_cargo_nome = undefined;
                          updated[index].nova_regional_id = undefined;
                          updated[index].nova_regional_texto = undefined;
                          updated[index].destino_regional_id = undefined;
                          updated[index].destino_regional_texto = undefined;
                          updated[index].destino_divisao_id = undefined;
                          updated[index].destino_divisao_texto = undefined;
                          updated[index].encontrado_em_outra_regional = undefined;
                          
                          // Se for transferido, verificar se existe em outra regional
                          if (value === 'transferido') {
                            updated[index].verificando_transferencia = true;
                            setRemovidosConfirmados(updated);
                            
                            try {
                              const { data: integranteDestino } = await supabase
                                .from('integrantes_portal')
                                .select('id, regional_id, regional_texto, divisao_id, divisao_texto')
                                .eq('registro_id', removido.registro_id)
                                .eq('ativo', true)
                                .neq('divisao_texto', removido.divisao_texto)
                                .maybeSingle();
                              
                              const finalUpdated = [...removidosConfirmados];
                              finalUpdated[index].verificando_transferencia = false;
                              if (integranteDestino) {
                                finalUpdated[index].encontrado_em_outra_regional = true;
                                finalUpdated[index].destino_regional_id = integranteDestino.regional_id;
                                finalUpdated[index].destino_regional_texto = integranteDestino.regional_texto;
                                finalUpdated[index].destino_divisao_id = integranteDestino.divisao_id;
                                finalUpdated[index].destino_divisao_texto = integranteDestino.divisao_texto;
                              } else {
                                finalUpdated[index].encontrado_em_outra_regional = false;
                              }
                              setRemovidosConfirmados(finalUpdated);
                            } catch (err) {
                              console.error('Erro ao verificar transferência:', err);
                              const finalUpdated = [...removidosConfirmados];
                              finalUpdated[index].verificando_transferencia = false;
                              finalUpdated[index].encontrado_em_outra_regional = false;
                              setRemovidosConfirmados(finalUpdated);
                            }
                          } else {
                            setRemovidosConfirmados(updated);
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o motivo..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="transferido">Transferido</SelectItem>
                          <SelectItem value="falecido">Falecido</SelectItem>
                          <SelectItem value="desligado">Desligado</SelectItem>
                          <SelectItem value="expulso">Expulso</SelectItem>
                          <SelectItem value="afastado">Afastado Temporariamente</SelectItem>
                          <SelectItem value="promovido">Promovido (Grau IV)</SelectItem>
                          <SelectItem value="outro">Outro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* AFASTADO: Alerta informativo */}
                    {removido.motivo_inativacao === 'afastado' && (
                      <Alert className="border-blue-200 bg-blue-50">
                        <Info className="h-4 w-4 text-blue-600" />
                        <AlertDescription className="text-blue-700">
                          Este integrante será <strong>mantido ativo</strong> no portal. 
                          Apenas será registrado no histórico como afastamento temporário.
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* PROMOVIDO: Campos de promoção */}
                    {removido.motivo_inativacao === 'promovido' && (
                      <div className="space-y-3 p-3 bg-green-50 rounded-lg border border-green-200">
                        <p className="text-sm font-medium text-green-800 flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4" />
                          Promoção para Grau IV
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-green-700">Novo Cargo *</label>
                            <Select
                              value={removido.novo_cargo_id || ''}
                              onValueChange={(value) => {
                                const cargo = cargosGrau4.find(c => c.id === value);
                                const updated = [...removidosConfirmados];
                                updated[index].novo_cargo_id = value;
                                updated[index].novo_cargo_nome = cargo?.nome || '';
                                setRemovidosConfirmados(updated);
                              }}
                            >
                              <SelectTrigger className="bg-white">
                                <SelectValue placeholder="Selecione o cargo..." />
                              </SelectTrigger>
                              <SelectContent>
                                {cargosGrau4.map(cargo => (
                                  <SelectItem key={cargo.id} value={cargo.id}>
                                    {cargo.nome}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-green-700">Nova Regional *</label>
                            <Select
                              value={removido.nova_regional_id || ''}
                              onValueChange={(value) => {
                                const regional = regionais.find(r => r.id === value);
                                const updated = [...removidosConfirmados];
                                updated[index].nova_regional_id = value;
                                updated[index].nova_regional_texto = regional?.nome || '';
                                setRemovidosConfirmados(updated);
                              }}
                            >
                              <SelectTrigger className="bg-white">
                                <SelectValue placeholder="Selecione a regional..." />
                              </SelectTrigger>
                              <SelectContent>
                                {regionais.map(regional => (
                                  <SelectItem key={regional.id} value={regional.id}>
                                    {regional.nome}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* TRANSFERIDO: Verificação de destino */}
                    {removido.motivo_inativacao === 'transferido' && (
                      <div className="space-y-2">
                        {removido.verificando_transferencia ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 bg-muted rounded">
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            Verificando se existe em outra regional...
                          </div>
                        ) : removido.encontrado_em_outra_regional ? (
                          <Alert className="border-emerald-200 bg-emerald-50">
                            <ArrowRightLeft className="h-4 w-4 text-emerald-600" />
                            <AlertDescription className="text-emerald-700">
                              Encontrado ativo em <strong>{removido.destino_divisao_texto || removido.destino_regional_texto}</strong>.
                              Será efetivada a transferência (não será inativado).
                            </AlertDescription>
                          </Alert>
                        ) : removido.encontrado_em_outra_regional === false ? (
                          <Alert className="border-orange-200 bg-orange-50">
                            <AlertCircle className="h-4 w-4 text-orange-600" />
                            <AlertDescription className="text-orange-700">
                              <strong>Não encontrado</strong> em outra regional no sistema.
                              Este integrante será <strong>inativado</strong>.
                            </AlertDescription>
                          </Alert>
                        ) : null}
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Observação (opcional)</label>
                      <Textarea
                        placeholder="Adicione detalhes..."
                        value={removido.observacao_inativacao}
                        onChange={(e) => {
                          const updated = [...removidosConfirmados];
                          updated[index].observacao_inativacao = e.target.value;
                          setRemovidosConfirmados(updated);
                        }}
                        rows={2}
                      />
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowRemovidosDialog(false);
                  setRemovidosConfirmados([]);
                  setUploadPreview(null);
                  setTransferidosDetectados([]);
                  setRegionalDaCarga('');
                }}
              >
                Cancelar
              </Button>
<Button
                onClick={() => {
                  // Validar que todos têm motivo preenchido
                  const todosPreenchidos = removidosConfirmados.every(r => r.motivo_inativacao && r.motivo_inativacao.trim() !== '');
                  if (!todosPreenchidos) {
                    toast({
                      title: "Atenção",
                      description: "Preencha o motivo para todos os integrantes removidos",
                      variant: "destructive"
                    });
                    return;
                  }
                  
                  // Validar campos de promoção
                  const promovidosSemCampos = removidosConfirmados.filter(r => 
                    r.motivo_inativacao === 'promovido' && (!r.novo_cargo_id || !r.nova_regional_id)
                  );
                  if (promovidosSemCampos.length > 0) {
                    toast({
                      title: "Campos obrigatórios",
                      description: `Preencha o novo cargo e regional para: ${promovidosSemCampos.map(p => p.nome_colete).join(', ')}`,
                      variant: "destructive"
                    });
                    return;
                  }
                  
                  // Validar se transferidos terminaram de verificar
                  const transferidosVerificando = removidosConfirmados.filter(r => 
                    r.motivo_inativacao === 'transferido' && r.verificando_transferencia
                  );
                  if (transferidosVerificando.length > 0) {
                    toast({
                      title: "Aguarde",
                      description: "Ainda verificando transferências internas...",
                      variant: "default"
                    });
                    return;
                  }
                  
                  setShowRemovidosDialog(false);
                  setShowUploadDialog(true);
                }}
                disabled={
                  !removidosConfirmados.every(r => r.motivo_inativacao && r.motivo_inativacao.trim() !== '') ||
                  removidosConfirmados.some(r => r.verificando_transferencia) ||
                  removidosConfirmados.some(r => r.motivo_inativacao === 'promovido' && (!r.novo_cargo_id || !r.nova_regional_id))
                }
              >
                Confirmar e Prosseguir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de Preview de Upload */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview das Mudancas</DialogTitle>
            <DialogDescription>
              Revise as mudancas antes de aplicar
            </DialogDescription>
          </DialogHeader>

          {uploadPreview && (
            <div className="space-y-4">
              <Card className="p-4 bg-accent">
                <div className="flex items-center space-x-3">
                  <FileSpreadsheet className="h-6 w-6" />
                  <div>
                    <p className="font-semibold">{uploadPreview.file}</p>
                    <p className="text-sm text-muted-foreground">
                      {uploadPreview.excelData.length} registros no arquivo
                    </p>
                    {regionalDaCarga && (
                      <Badge variant="outline" className="mt-1">
                        Regional: {regionalDaCarga}
                      </Badge>
                    )}
                  </div>
                </div>
              </Card>

              <div className="grid grid-cols-2 gap-4">
                <Card className="p-4">
                  <p className="text-sm text-muted-foreground">Novos</p>
                  <p className="text-3xl font-bold text-green-600">
                    {uploadPreview.delta.novos.length}
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-muted-foreground">Atualizados</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {uploadPreview.delta.atualizados.length}
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-muted-foreground">Sem Mudança</p>
                  <p className="text-3xl font-bold text-gray-600">
                    {uploadPreview.delta.semMudanca}
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-muted-foreground">Inativações</p>
                  <p className="text-3xl font-bold text-orange-600">
                    {removidosConfirmados.length}
                  </p>
                </Card>
              </div>

              {/* Transferências detectadas - NÃO serão inativados */}
              {transferidosDetectados.length > 0 && (
                <Alert className="border-blue-200 bg-blue-50">
                  <ArrowRightLeft className="h-4 w-4 text-blue-600" />
                  <AlertTitle className="text-blue-800">Transferências Detectadas</AlertTitle>
                  <AlertDescription>
                    <p className="text-sm text-blue-700 mb-2">
                      {transferidosDetectados.length} integrante(s) não estão mais na {regionalDaCarga},
                      mas foram encontrados ativos em outra regional. Estes <strong>NÃO serão inativados</strong>.
                    </p>
                    <div className="mt-2 space-y-1 text-xs max-h-32 overflow-y-auto">
                      {transferidosDetectados.map((t, idx) => (
                        <p key={idx} className="text-blue-700">
                          • {t.integrante.nome_colete} → <span className="font-semibold">{t.nova_regional}</span> / {t.nova_divisao}
                        </p>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {uploadPreview.delta.atualizados.length > 0 && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>Detalhes das Atualizações</AlertTitle>
                  <AlertDescription>
                    <div className="mt-2 max-h-48 overflow-y-auto space-y-2">
                      {uploadPreview.delta.atualizados.slice(0, 5).map((atualizado: any, idx: number) => {
                        const mudancas = compararCampos(atualizado.antigo, atualizado.novo);
                        return (
                          <div key={idx} className="text-xs border-l-2 border-blue-500 pl-2">
                            <p className="font-semibold">{atualizado.novo.nome_colete}</p>
                            <p className="text-muted-foreground">
                              {mudancas.length} campo(s) alterado(s): {mudancas.map(m => m.campo).join(', ')}
                            </p>
                          </div>
                        );
                      })}
                      {uploadPreview.delta.atualizados.length > 5 && (
                        <p className="text-xs text-muted-foreground">
                          + {uploadPreview.delta.atualizados.length - 5} outros...
                        </p>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {removidosConfirmados.length > 0 && (
                <Alert className="border-orange-200">
                  <XCircle className="h-4 w-4 text-orange-500" />
                  <AlertTitle>Inativações Confirmadas</AlertTitle>
                  <AlertDescription>
                    <div className="mt-2 space-y-1 text-xs">
                      {removidosConfirmados.map((r, idx) => (
                        <p key={idx}>
                          • {r.nome_colete} - <span className="font-semibold capitalize">{r.motivo_inativacao}</span>
                        </p>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowUploadDialog(false);
              setUploadPreview(null);
              setRemovidosConfirmados([]);
              setTransferidosDetectados([]);
              setRegionalDaCarga('');
            }}>
              Cancelar
            </Button>
            <Button onClick={handleApplyChanges} disabled={processing}>
              {processing ? "Processando..." : "Aplicar Mudancas"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de detalhes do perfil */}
      <ProfileDetailDialog
        profile={selectedProfile}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        onSuccess={() => {
          setDetailDialogOpen(false);
          setSelectedProfile(null);
          refetch();
        }}
      />
    </div>
  </div>
  );
};

export default AdminIntegrantes;
