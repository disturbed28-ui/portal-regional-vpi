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
import { Loader2, Save } from "lucide-react";
import { IntegrantePortal } from "@/hooks/useIntegrantes";

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
  const [observacao, setObservacao] = useState("");
  const [dados, setDados] = useState({
    nome_colete: "",
    cargo_nome: "",
    cargo_grau_texto: "",
    cargo_estagio: "",
    data_entrada: "",
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

  useEffect(() => {
    if (integrante) {
      setDados({
        nome_colete: integrante.nome_colete || "",
        cargo_nome: integrante.cargo_nome || "",
        cargo_grau_texto: integrante.cargo_grau_texto || "",
        cargo_estagio: integrante.cargo_estagio || "",
        data_entrada: integrante.data_entrada || "",
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
      setObservacao("");
    }
  }, [integrante]);

  const observacaoValida = observacao.trim().length >= 10;

  const handleSalvar = async () => {
    // Montar apenas campos que mudaram
    const dadosNovos: Record<string, any> = {};
    
    if (integrante) {
      if (dados.nome_colete !== integrante.nome_colete) dadosNovos.nome_colete = dados.nome_colete;
      if (dados.cargo_nome !== (integrante.cargo_nome || "")) dadosNovos.cargo_nome = dados.cargo_nome;
      if (dados.cargo_grau_texto !== integrante.cargo_grau_texto) dadosNovos.cargo_grau_texto = dados.cargo_grau_texto;
      if (dados.cargo_estagio !== (integrante.cargo_estagio || "")) dadosNovos.cargo_estagio = dados.cargo_estagio;
      if (dados.data_entrada !== (integrante.data_entrada || "")) dadosNovos.data_entrada = dados.data_entrada || null;
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

          {/* Nome de Colete */}
          <div className="space-y-2">
            <Label htmlFor="nome_colete">Nome de Colete</Label>
            <Input
              id="nome_colete"
              value={dados.nome_colete}
              onChange={(e) => setDados(prev => ({ ...prev, nome_colete: e.target.value }))}
            />
          </div>

          {/* Cargo */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="cargo_nome">Cargo</Label>
              <Input
                id="cargo_nome"
                value={dados.cargo_nome}
                onChange={(e) => setDados(prev => ({ ...prev, cargo_nome: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cargo_grau_texto">Grau/Texto</Label>
              <Input
                id="cargo_grau_texto"
                value={dados.cargo_grau_texto}
                onChange={(e) => setDados(prev => ({ ...prev, cargo_grau_texto: e.target.value }))}
              />
            </div>
          </div>

          {/* Estágio e Data de Entrada */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="cargo_estagio">Estágio</Label>
              <Input
                id="cargo_estagio"
                value={dados.cargo_estagio}
                onChange={(e) => setDados(prev => ({ ...prev, cargo_estagio: e.target.value }))}
                placeholder="Ex: 1º estágio"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="data_entrada">Data de Entrada</Label>
              <Input
                id="data_entrada"
                type="date"
                value={dados.data_entrada}
                onChange={(e) => setDados(prev => ({ ...prev, data_entrada: e.target.value }))}
              />
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
