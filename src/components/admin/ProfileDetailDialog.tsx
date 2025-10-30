import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { ProfileStatus } from "@/types/profile";
import { useComandos } from "@/hooks/useComandos";
import { useRegionais } from "@/hooks/useRegionais";
import { useDivisoes } from "@/hooks/useDivisoes";
import { useCargos } from "@/hooks/useCargos";
import { useFuncoes } from "@/hooks/useFuncoes";
import { IntegranteLookup } from "./IntegranteLookup";
import { IntegrantePortal } from "@/hooks/useIntegrantes";
import { parseCargoGrau } from "@/lib/excelParser";
import { matchIntegranteToStructure } from "@/lib/integranteMatching";
import { supabase } from "@/integrations/supabase/client";
import { Download, CheckCircle } from "lucide-react";
import { RoleManager } from "./RoleManager";

interface Profile {
  id: string;
  name: string;
  nome_colete: string | null;
  photo_url: string | null;
  comando_id: string | null;
  regional: string | null;
  divisao: string | null;
  cargo: string | null;
  funcao: string | null;
  regional_id: string | null;
  divisao_id: string | null;
  cargo_id: string | null;
  funcao_id: string | null;
  data_entrada: string | null;
  grau: string | null;
  profile_status: ProfileStatus;
  observacao: string | null;
}

interface ProfileDetailDialogProps {
  profile: Profile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const STATUS_OPTIONS: ProfileStatus[] = [
  'Pendente',
  'Analise',
  'Ativo',
  'Recusado',
  'Inativo',
];

const GRAU_OPTIONS = [
  'X',
  'IX',
  'VIII',
  'VII',
  'VI',
  'V',
  'IV',
  'III',
  'II',
  'I',
  'Camiseta',
];

export function ProfileDetailDialog({
  profile,
  open,
  onOpenChange,
  onSuccess,
}: ProfileDetailDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<Profile>>({});
  const [integranteSelecionado, setIntegranteSelecionado] = useState<IntegrantePortal | null>(null);
  const [showIntegranteLookup, setShowIntegranteLookup] = useState(false);
  
  // Estados para cascata
  const [selectedComandoId, setSelectedComandoId] = useState<string>('');
  const [selectedRegionalId, setSelectedRegionalId] = useState<string>('');
  const [selectedGrau, setSelectedGrau] = useState<string>('');

  // Hooks com filtros
  const { comandos } = useComandos();
  const { regionais } = useRegionais(selectedComandoId || undefined);
  const { divisoes } = useDivisoes(selectedRegionalId || undefined);
  const { cargos } = useCargos();
  const { funcoes } = useFuncoes();

  // Filtrar cargos por grau selecionado
  const cargosFiltrados = selectedGrau 
    ? cargos.filter(cargo => cargo.grau === selectedGrau)
    : cargos;

  // Reset form quando profile muda OU quando dialog abre
  useEffect(() => {
    // Reset integrante selecionado quando dialog abre ou muda de perfil
    if (open) {
      setIntegranteSelecionado(null);
      setShowIntegranteLookup(false);
    }

    if (profile) {
      setFormData({
        name: profile.name,
        nome_colete: profile.nome_colete,
        comando_id: profile.comando_id,
        regional_id: profile.regional_id,
        divisao_id: profile.divisao_id,
        cargo_id: profile.cargo_id,
        funcao_id: profile.funcao_id,
        data_entrada: profile.data_entrada,
        grau: profile.grau,
        profile_status: profile.profile_status,
        observacao: profile.observacao,
      });
      if (profile.comando_id) {
        setSelectedComandoId(profile.comando_id);
      }
      if (profile.regional_id) {
        setSelectedRegionalId(profile.regional_id);
      }
      if (profile.grau) {
        setSelectedGrau(profile.grau);
      }
    }
  }, [profile, open]);

  const handleImportarIntegrante = async () => {
    if (!integranteSelecionado) return;

    try {
      setLoading(true);
      
      // Parse cargo e grau
      const { cargo, grau } = parseCargoGrau(integranteSelecionado.cargo_grau_texto);
      
      // Fazer matching com a estrutura existente
      const matched = await matchIntegranteToStructure(
        integranteSelecionado.comando_texto,
        integranteSelecionado.regional_texto,
        integranteSelecionado.divisao_texto,
        cargo,
        grau
      );

      console.log('Matched data:', matched);
      console.log('Parsed grau:', grau);

      // Mostrar feedback sobre o que foi encontrado
      if (matched.matched_fields.length > 0) {
        toast({
          title: "Dados encontrados",
          description: matched.matched_fields.join(", "),
        });
      }

      // Filtrar failed_fields para não mostrar divisão como erro se for cargo de nível regional
      const cargoNome = integranteSelecionado.cargo_nome?.toLowerCase() || "";
      const isCargoRegional = cargoNome.includes("regional") || cargoNome.includes("diretor");
      
      const relevantFailedFields = matched.failed_fields.filter(field => {
        // Se é cargo regional e o campo que falhou é divisão, não mostrar como erro
        if (isCargoRegional && field.toLowerCase().includes("divisão")) {
          return false;
        }
        return true;
      });

      if (relevantFailedFields.length > 0) {
        toast({
          title: "Campos não encontrados",
          description: relevantFailedFields.join(", "),
          variant: "destructive",
        });
      }
      
      // Mensagem informativa para cargos regionais
      if (isCargoRegional && matched.failed_fields.some(f => f.toLowerCase().includes("divisão"))) {
        toast({
          title: "Integrante de nível Regional",
          description: "Divisão não aplicável para este cargo",
        });
      }

      // Atualizar estados de cascata PRIMEIRO
      if (matched.comando_id) {
        console.log('Setting comando_id:', matched.comando_id);
        setSelectedComandoId(matched.comando_id);
      }
      if (matched.regional_id) {
        console.log('Setting regional_id:', matched.regional_id);
        setSelectedRegionalId(matched.regional_id);
      }
      if (grau) {
        console.log('Setting grau:', grau);
        setSelectedGrau(grau);
      }

      // Aguardar para garantir que os hooks de dados carregaram
      await new Promise(resolve => setTimeout(resolve, 300));

      // Atualizar form data com TODOS os campos
      const newFormData = {
        ...formData,
        nome_colete: integranteSelecionado.nome_colete,
        comando_id: matched.comando_id || formData.comando_id,
        regional_id: matched.regional_id || formData.regional_id,
        divisao_id: matched.divisao_id || formData.divisao_id,
        cargo_id: matched.cargo_id || formData.cargo_id,
        grau: grau || formData.grau,
        data_entrada: integranteSelecionado.data_entrada || formData.data_entrada,
      };

      console.log('New form data to set:', newFormData);
      console.log('Current formData before update:', formData);
      setFormData(newFormData);

      // Vincular integrante ao perfil
      const { error: updateIntegranteError } = await supabase
        .from('integrantes_portal')
        .update({
          profile_id: profile?.id,
          vinculado: true,
          data_vinculacao: new Date().toISOString(),
        })
        .eq('id', integranteSelecionado.id);

      if (updateIntegranteError) {
        console.error('Error updating integrante:', updateIntegranteError);
        throw updateIntegranteError;
      }

      toast({
        title: "Dados importados",
        description: "Dados do integrante foram importados com sucesso. Revise e clique em Salvar.",
      });

      setShowIntegranteLookup(false);
    } catch (error) {
      console.error('Error importing integrante:', error);
      toast({
        title: "Erro ao importar",
        description: error instanceof Error ? error.message : "Falha ao importar dados do integrante",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !user) {
      toast({
        title: "Erro de autenticacao",
        description: "Voce precisa estar logado",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      const response = await fetch(
        `${supabaseUrl}/functions/v1/admin-update-profile`,
        {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            admin_user_id: user.uid,
            profile_id: profile.id,
            ...formData,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao atualizar perfil');
      }

      toast({
        title: "Perfil atualizado",
        description: "As alteracoes foram salvas com sucesso",
      });

      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!profile) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="admin-page max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Perfil</DialogTitle>
          <DialogDescription>
            Atualize as informacoes administrativas do membro
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Avatar */}
          <div className="flex justify-center">
            <Avatar className="w-24 h-24">
              <AvatarImage src={profile.photo_url || ''} />
              <AvatarFallback className="text-2xl">
                {profile.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>

          {/* Secao de Vinculacao com Integrante do Portal */}
          <Card className="p-4 bg-accent">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Vincular Integrante do Portal</h3>
                {integranteSelecionado && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Selecionado
                  </Badge>
                )}
              </div>
              
              {!showIntegranteLookup && !integranteSelecionado && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowIntegranteLookup(true)}
                  className="w-full"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Buscar e Importar Dados
                </Button>
              )}

              {showIntegranteLookup && (
                <div className="space-y-3">
                  <IntegranteLookup
                    onSelect={setIntegranteSelecionado}
                    excludeVinculados={true}
                    selectedId={integranteSelecionado?.id}
                  />
                  
                  {integranteSelecionado && (
                    <div className="space-y-2">
                      <Card className="p-3 bg-background">
                        <div className="space-y-1 text-sm">
                          <p><span className="font-semibold">Registro:</span> {integranteSelecionado.registro_id}</p>
                          <p><span className="font-semibold">Nome:</span> {integranteSelecionado.nome_colete}</p>
                          <p><span className="font-semibold">Cargo:</span> {integranteSelecionado.cargo_grau_texto}</p>
                          <p><span className="font-semibold">Divisao:</span> {integranteSelecionado.divisao_texto}</p>
                          <p><span className="font-semibold">Regional:</span> {integranteSelecionado.regional_texto}</p>
                          <p><span className="font-semibold">Comando:</span> {integranteSelecionado.comando_texto}</p>
                        </div>
                      </Card>
                      
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          onClick={handleImportarIntegrante}
                          disabled={loading}
                          className="flex-1"
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Importar e Preencher
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setIntegranteSelecionado(null);
                            setShowIntegranteLookup(false);
                          }}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {integranteSelecionado && !showIntegranteLookup && (
                <div className="space-y-2">
                  <Card className="p-3 bg-background">
                    <div className="space-y-1 text-sm">
                      <p><span className="font-semibold">Vinculado:</span> {integranteSelecionado.nome_colete}</p>
                      <p className="text-muted-foreground">Registro: {integranteSelecionado.registro_id}</p>
                    </div>
                  </Card>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowIntegranteLookup(true)}
                  >
                    Alterar Vinculo
                  </Button>
                </div>
              )}
            </div>
          </Card>

          <Separator />

          {/* Gerenciamento de Roles */}
          <RoleManager profileId={profile.id} />

          <Separator />

          {/* Nome Completo */}
          <div className="space-y-2">
            <Label htmlFor="name">Nome Completo</Label>
            <Input
              id="name"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          {/* Nome de Colete */}
          <div className="space-y-2">
            <Label htmlFor="nome_colete">Nome de Colete</Label>
            <Input
              id="nome_colete"
              value={formData.nome_colete || ''}
              onChange={(e) => setFormData({ ...formData, nome_colete: e.target.value })}
            />
          </div>

          {/* Grid de 2 colunas - Estrutura */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Comando */}
            <div className="space-y-2">
              <Label htmlFor="comando">Comando</Label>
              <Select
                value={formData.comando_id || ''}
                onValueChange={(value) => {
                  setFormData({ 
                    ...formData, 
                    comando_id: value, 
                    regional_id: null,
                    divisao_id: null 
                  });
                  setSelectedComandoId(value);
                  setSelectedRegionalId('');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent className="z-50">
                  {comandos.map((comando) => (
                    <SelectItem key={comando.id} value={comando.id}>
                      {comando.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Regional */}
            <div className="space-y-2">
              <Label htmlFor="regional">Regional</Label>
              <Select
                value={formData.regional_id || ''}
                onValueChange={(value) => {
                  setFormData({ ...formData, regional_id: value, divisao_id: null });
                  setSelectedRegionalId(value);
                }}
                disabled={!selectedComandoId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={selectedComandoId ? "Selecione..." : "Selecione comando primeiro"} />
                </SelectTrigger>
                <SelectContent className="z-50">
                  {regionais.map((regional) => (
                    <SelectItem key={regional.id} value={regional.id}>
                      {regional.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Divisao */}
            <div className="space-y-2">
              <Label htmlFor="divisao">Divisao</Label>
              <Select
                value={formData.divisao_id || ''}
                onValueChange={(value) => setFormData({ ...formData, divisao_id: value })}
                disabled={!selectedRegionalId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={selectedRegionalId ? "Selecione..." : "Selecione regional primeiro"} />
                </SelectTrigger>
                <SelectContent className="z-50">
                  {divisoes.map((divisao) => (
                    <SelectItem key={divisao.id} value={divisao.id}>
                      {divisao.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Grau */}
            <div className="space-y-2">
              <Label htmlFor="grau">Grau</Label>
              <Select
                value={formData.grau || ''}
                onValueChange={(value) => {
                  setFormData({ ...formData, grau: value, cargo_id: null });
                  setSelectedGrau(value);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent className="z-50">
                  {GRAU_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Grid de 2 colunas - Cargo e Função */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Cargo */}
            <div className="space-y-2">
              <Label htmlFor="cargo">Cargo</Label>
              <Select
                value={formData.cargo_id || ''}
                onValueChange={(value) => setFormData({ ...formData, cargo_id: value })}
                disabled={!selectedGrau}
              >
                <SelectTrigger>
                  <SelectValue placeholder={selectedGrau ? "Selecione..." : "Selecione grau primeiro"} />
                </SelectTrigger>
                <SelectContent className="z-50">
                  {cargosFiltrados.map((cargo) => (
                    <SelectItem key={cargo.id} value={cargo.id}>
                      {cargo.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Funcao */}
            <div className="space-y-2">
              <Label htmlFor="funcao_id">Funcao</Label>
              <Select
                value={formData.funcao_id || ''}
                onValueChange={(value) => setFormData({ ...formData, funcao_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent className="z-50">
                  {funcoes.map((funcao) => (
                    <SelectItem key={funcao.id} value={funcao.id}>
                      {funcao.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Data de Entrada */}
          <div className="space-y-2">
            <Label htmlFor="data_entrada">Data de Entrada</Label>
            <Input
              id="data_entrada"
              type="date"
              value={formData.data_entrada || ''}
              onChange={(e) => setFormData({ ...formData, data_entrada: e.target.value })}
            />
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.profile_status || 'Pendente'}
              onValueChange={(value) =>
                setFormData({ ...formData, profile_status: value as ProfileStatus })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Observacao */}
          <div className="space-y-2">
            <Label htmlFor="observacao">Observacao</Label>
            <Textarea
              id="observacao"
              value={formData.observacao || ''}
              onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
              placeholder="Notas administrativas..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar Alteracoes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
