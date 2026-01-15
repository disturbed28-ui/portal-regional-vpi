import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Save, GraduationCap, Briefcase, Mail, Phone } from "lucide-react";
import { IntegrantePortal } from "@/hooks/useIntegrantes";
import { useCargos } from "@/hooks/useCargos";

interface ModalEditarIntegranteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  integrante: IntegrantePortal | null;
  onSalvar: (dadosNovos: Record<string, any>, observacao: string) => Promise<boolean>;
  operando: boolean;
}

export function ModalEditarIntegrante({
  open,
  onOpenChange,
  integrante,
  onSalvar,
  operando,
}: ModalEditarIntegranteProps) {
  const { cargos, loading: loadingCargos } = useCargos();
  const [observacao, setObservacao] = useState("");
  const [dados, setDados] = useState({
    nome_colete: "",
    cargo_nome: "",
    cargo_grau_texto: "",
    grau: "",
    tem_moto: false,
    tem_carro: false,
    sgt_armas: false,
    caveira: false,
    caveira_suplente: false,
    batedor: false,
    ursinho: false,
    lobo: false,
    combate_insano: false,
  });

  // Dados somente leitura
  const [dadosReadOnly, setDadosReadOnly] = useState({
    cargo_estagio: "",
    cargo_treinamento_nome: "",
    data_entrada: "",
  });

  useEffect(() => {
    if (integrante) {
      setDados({
        nome_colete: integrante.nome_colete || "",
        cargo_nome: integrante.cargo_nome || "",
        cargo_grau_texto: integrante.cargo_grau_texto || "",
        grau: integrante.grau || "",
        tem_moto: integrante.tem_moto || false,
        tem_carro: integrante.tem_carro || false,
        sgt_armas: integrante.sgt_armas || false,
        caveira: integrante.caveira || false,
        caveira_suplente: integrante.caveira_suplente || false,
        batedor: integrante.batedor || false,
        ursinho: integrante.ursinho || false,
        lobo: integrante.lobo || false,
        combate_insano: integrante.combate_insano || false,
      });
      
      // Buscar nome do cargo de treinamento se existir
      const cargoTreinamento = cargos.find(c => c.id === integrante.cargo_treinamento_id);
      
      setDadosReadOnly({
        cargo_estagio: integrante.cargo_estagio || "",
        cargo_treinamento_nome: cargoTreinamento?.nome || "",
        data_entrada: integrante.data_entrada || "",
      });
      
      setObservacao("");
    }
  }, [integrante, cargos]);

  // Handler para mudança de cargo
  const handleCargoChange = (cargoNome: string) => {
    const cargoSelecionado = cargos.find(c => c.nome === cargoNome);
    if (cargoSelecionado) {
      setDados(prev => ({
        ...prev,
        cargo_nome: cargoNome,
        cargo_grau_texto: `${cargoSelecionado.nome} (Grau ${cargoSelecionado.grau})`,
        grau: cargoSelecionado.grau,
      }));
    }
  };

  // Verificar se cargo foi alterado (requer justificativa mais detalhada)
  const cargoFoiAlterado = integrante && dados.cargo_nome !== (integrante.cargo_nome || "");

  const observacaoValida = observacao.trim().length >= 10;

  const handleSalvar = async () => {
    // Montar apenas campos que mudaram
    const dadosNovos: Record<string, any> = {};
    
    if (integrante) {
      if (dados.nome_colete !== integrante.nome_colete) dadosNovos.nome_colete = dados.nome_colete;
      if (dados.cargo_nome !== (integrante.cargo_nome || "")) {
        dadosNovos.cargo_nome = dados.cargo_nome;
        dadosNovos.cargo_grau_texto = dados.cargo_grau_texto;
        dadosNovos.grau = dados.grau;
      }
      if (dados.tem_moto !== integrante.tem_moto) dadosNovos.tem_moto = dados.tem_moto;
      if (dados.tem_carro !== integrante.tem_carro) dadosNovos.tem_carro = dados.tem_carro;
      if (dados.sgt_armas !== integrante.sgt_armas) dadosNovos.sgt_armas = dados.sgt_armas;
      if (dados.caveira !== integrante.caveira) dadosNovos.caveira = dados.caveira;
      if (dados.caveira_suplente !== integrante.caveira_suplente) dadosNovos.caveira_suplente = dados.caveira_suplente;
      if (dados.batedor !== integrante.batedor) dadosNovos.batedor = dados.batedor;
      if (dados.ursinho !== integrante.ursinho) dadosNovos.ursinho = dados.ursinho;
      if (dados.lobo !== integrante.lobo) dadosNovos.lobo = dados.lobo;
      if (dados.combate_insano !== integrante.combate_insano) dadosNovos.combate_insano = dados.combate_insano;
    }

    const success = await onSalvar(dadosNovos, observacao);
    if (success) {
      onOpenChange(false);
    }
  };

  const formatarData = (data: string) => {
    if (!data) return "Não informado";
    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano}`;
  };

  if (!integrante) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Integrante</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Informações básicas (não editáveis aqui) */}
          <div className="p-3 rounded-lg bg-muted/50 space-y-1">
            <p className="text-sm">
              <span className="text-muted-foreground">Regional:</span>{" "}
              <span className="font-medium">{integrante.regional_texto}</span>
            </p>
            <p className="text-sm">
              <span className="text-muted-foreground">Divisão:</span>{" "}
              <span className="font-medium">{integrante.divisao_texto}</span>
            </p>
            <p className="text-sm">
              <span className="text-muted-foreground">Registro:</span>{" "}
              <span className="font-medium">#{integrante.registro_id}</span>
            </p>
          </div>

          {/* Contato - se vinculado */}
          {integrante.vinculado && (integrante.email || integrante.telefone) && (
            <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-900/10 space-y-1.5 border border-blue-200/50 dark:border-blue-700/30">
              <p className="text-xs font-medium text-blue-800 dark:text-blue-300 mb-1 flex items-center gap-1">
                📧 Dados de Contato (vinculado ao portal)
              </p>
              {integrante.email && (
                <p className="text-sm flex items-center gap-1.5">
                  <Mail className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">E-mail:</span>{" "}
                  <a href={`mailto:${integrante.email}`} className="font-medium text-primary hover:underline">
                    {integrante.email}
                  </a>
                </p>
              )}
              {integrante.telefone && (
                <p className="text-sm flex items-center gap-1.5">
                  <Phone className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Telefone:</span>{" "}
                  <a href={`tel:${integrante.telefone}`} className="font-medium text-primary hover:underline">
                    {integrante.telefone}
                  </a>
                </p>
              )}
            </div>
          )}

          {/* Nome de Colete */}
          <div className="space-y-2">
            <Label htmlFor="nome_colete">Nome de Colete</Label>
            <Input
              id="nome_colete"
              value={dados.nome_colete}
              onChange={(e) => setDados(prev => ({ ...prev, nome_colete: e.target.value }))}
            />
          </div>

          {/* Cargo - Select */}
          <div className="space-y-2">
            <Label htmlFor="cargo_nome">Cargo</Label>
            <Select
              value={dados.cargo_nome}
              onValueChange={handleCargoChange}
              disabled={loadingCargos}
            >
              <SelectTrigger id="cargo_nome" className="bg-background">
                <SelectValue placeholder="Selecione o cargo" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                {cargos.map(cargo => (
                  <SelectItem key={cargo.id} value={cargo.nome}>
                    {cargo.nome} (Grau {cargo.grau})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {cargoFoiAlterado && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                ⚠️ Alteração de cargo gera pendência para ajuste de permissões
              </p>
            )}
          </div>

          {/* Grau - Auto preenchido (read-only) */}
          <div className="space-y-2">
            <Label className="text-muted-foreground">Grau/Texto (automático)</Label>
            <div className="p-2 bg-muted rounded-md text-sm">
              {dados.cargo_grau_texto || "Será preenchido ao selecionar o cargo"}
            </div>
          </div>

          {/* Campos somente leitura */}
          <div className="grid grid-cols-2 gap-3">
            {/* Estágio - Read Only */}
            <div className="space-y-2">
              <Label className="text-muted-foreground flex items-center gap-1">
                <Briefcase className="h-3 w-3" />
                Estágio
              </Label>
              <div className="p-2 bg-muted rounded-md text-sm min-h-[36px] flex items-center">
                {dadosReadOnly.cargo_estagio ? (
                  <Badge variant="outline">{dadosReadOnly.cargo_estagio}</Badge>
                ) : (
                  <span className="text-muted-foreground text-xs">Não definido</span>
                )}
              </div>
            </div>

            {/* Treinamento - Read Only */}
            <div className="space-y-2">
              <Label className="text-muted-foreground flex items-center gap-1">
                <GraduationCap className="h-3 w-3" />
                Treinamento
              </Label>
              <div className="p-2 bg-muted rounded-md text-sm min-h-[36px] flex items-center">
                {dadosReadOnly.cargo_treinamento_nome ? (
                  <Badge variant="secondary">{dadosReadOnly.cargo_treinamento_nome}</Badge>
                ) : (
                  <span className="text-muted-foreground text-xs">Sem treinamento ativo</span>
                )}
              </div>
            </div>
          </div>

          {/* Data de Entrada - Read Only */}
          <div className="space-y-2">
            <Label className="text-muted-foreground">Data de Entrada</Label>
            <div className="p-2 bg-muted rounded-md text-sm">
              {formatarData(dadosReadOnly.data_entrada)}
            </div>
          </div>

          {/* Flags */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Atributos</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Tem Moto</span>
                <Switch
                  checked={dados.tem_moto}
                  onCheckedChange={(v) => setDados(prev => ({ ...prev, tem_moto: v }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Tem Carro</span>
                <Switch
                  checked={dados.tem_carro}
                  onCheckedChange={(v) => setDados(prev => ({ ...prev, tem_carro: v }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Sgt. Armas</span>
                <Switch
                  checked={dados.sgt_armas}
                  onCheckedChange={(v) => setDados(prev => ({ ...prev, sgt_armas: v }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Caveira</span>
                <Switch
                  checked={dados.caveira}
                  onCheckedChange={(v) => setDados(prev => ({ ...prev, caveira: v }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Caveira Suplente</span>
                <Switch
                  checked={dados.caveira_suplente}
                  onCheckedChange={(v) => setDados(prev => ({ ...prev, caveira_suplente: v }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Batedor</span>
                <Switch
                  checked={dados.batedor}
                  onCheckedChange={(v) => setDados(prev => ({ ...prev, batedor: v }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Ursinho</span>
                <Switch
                  checked={dados.ursinho}
                  onCheckedChange={(v) => setDados(prev => ({ ...prev, ursinho: v }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Lobo</span>
                <Switch
                  checked={dados.lobo}
                  onCheckedChange={(v) => setDados(prev => ({ ...prev, lobo: v }))}
                />
              </div>
              <div className="flex items-center justify-between col-span-2">
                <span className="text-sm">Combate Insano</span>
                <Switch
                  checked={dados.combate_insano}
                  onCheckedChange={(v) => setDados(prev => ({ ...prev, combate_insano: v }))}
                />
              </div>
            </div>
          </div>

          {/* Observação obrigatória */}
          <div className="space-y-2">
            <Label htmlFor="observacao" className="flex items-center gap-1">
              Motivo da Alteração <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="observacao"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Descreva o motivo da alteração (mínimo 10 caracteres)"
              className="min-h-[80px]"
            />
            <p className={`text-xs ${observacaoValida ? 'text-muted-foreground' : 'text-destructive'}`}>
              {observacao.length} / 10 caracteres mínimos
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={operando}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={operando || !observacaoValida}>
            {operando ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Salvar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
