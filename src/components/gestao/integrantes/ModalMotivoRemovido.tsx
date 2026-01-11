import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { MotivoRemovido } from "@/hooks/useConsolidacaoIntegrantes";
import { IntegrantePortal } from "@/hooks/useIntegrantes";
import { useCargosGrau4 } from "@/hooks/useCargosGrau4";
import { useRegionais } from "@/hooks/useRegionais";
import { ArrowUp, Clock, Info } from "lucide-react";

interface ModalMotivoRemovidoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  integrante: IntegrantePortal;
  onConfirmar: (motivo: MotivoRemovido) => void;
}

const MOTIVOS_INATIVACAO = [
  { value: 'transferido', label: 'Transferido para outra regional', badge: 'Inativar', variant: 'destructive' as const },
  { value: 'desligado', label: 'Desligamento voluntário', badge: 'Inativar', variant: 'destructive' as const },
  { value: 'expulso', label: 'Expulsão', badge: 'Inativar', variant: 'destructive' as const },
  { value: 'afastado', label: 'Afastamento temporário', badge: 'Manter ativo', variant: 'secondary' as const },
  { value: 'falecido', label: 'Falecimento', badge: 'Inativar', variant: 'destructive' as const },
  { value: 'promovido', label: 'Promoção para cargo externo (Grau IV)', badge: 'Atualizar', variant: 'default' as const },
  { value: 'outro', label: 'Outro motivo', badge: 'Inativar', variant: 'destructive' as const },
] as const;

export function ModalMotivoRemovido({
  open,
  onOpenChange,
  integrante,
  onConfirmar
}: ModalMotivoRemovidoProps) {
  const [motivo, setMotivo] = useState<string>('outro');
  const [observacao, setObservacao] = useState('');
  
  // Campos extras para promoção
  const [novoCargoId, setNovoCargoId] = useState('');
  const [novaRegionalId, setNovaRegionalId] = useState('');
  
  const { cargosGrau4, loading: loadingCargos } = useCargosGrau4();
  const { regionais, loading: loadingRegionais } = useRegionais();

  useEffect(() => {
    if (open) {
      setMotivo('outro');
      setObservacao('');
      setNovoCargoId('');
      setNovaRegionalId('');
    }
  }, [open]);

  const handleConfirmar = () => {
    const cargoSelecionado = cargosGrau4.find(c => c.id === novoCargoId);
    const regionalSelecionada = regionais.find(r => r.id === novaRegionalId);
    
    onConfirmar({
      integrante_id: integrante.id,
      registro_id: integrante.registro_id,
      nome_colete: integrante.nome_colete,
      motivo_inativacao: motivo as MotivoRemovido['motivo_inativacao'],
      observacao_inativacao: observacao || undefined,
      // Dados de promoção
      novo_cargo_id: novoCargoId || undefined,
      novo_cargo_nome: cargoSelecionado?.nome || undefined,
      nova_regional: regionalSelecionada?.nome || undefined,
      nova_regional_id: novaRegionalId || undefined
    });
  };

  const motivoSelecionado = MOTIVOS_INATIVACAO.find(m => m.value === motivo);
  const mostrarCamposPromocao = motivo === 'promovido';
  const mostrarAvisoAfastado = motivo === 'afastado';
  
  const podeConfirmar = () => {
    if (motivo === 'promovido') {
      return novoCargoId !== '' && novaRegionalId !== '';
    }
    return true;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Motivo da Saída</DialogTitle>
          <DialogDescription>
            Defina o tratamento para <strong>{integrante.nome_colete}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <Label>Motivo</Label>
            <RadioGroup value={motivo} onValueChange={setMotivo}>
              {MOTIVOS_INATIVACAO.map((m) => (
                <div key={m.value} className="flex items-center justify-between space-x-2 py-1">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value={m.value} id={m.value} />
                    <Label htmlFor={m.value} className="text-sm font-normal cursor-pointer">
                      {m.label}
                    </Label>
                  </div>
                  <Badge variant={m.variant} className="text-[10px]">
                    {m.badge}
                  </Badge>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Campos extras para promoção Grau IV */}
          {mostrarCamposPromocao && (
            <div className="space-y-4 p-3 bg-primary/10 rounded-lg border border-primary/20">
              <div className="flex items-center gap-2 text-primary">
                <ArrowUp className="h-4 w-4" />
                <span className="text-sm font-medium">Dados da Promoção</span>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="novoCargo">Novo Cargo (Grau IV)</Label>
                <Select value={novoCargoId} onValueChange={setNovoCargoId} disabled={loadingCargos}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o cargo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {cargosGrau4.map((cargo) => (
                      <SelectItem key={cargo.id} value={cargo.id}>
                        {cargo.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="novaRegional">Nova Regional/Comando</Label>
                <Select value={novaRegionalId} onValueChange={setNovaRegionalId} disabled={loadingRegionais}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a regional..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="comando_nacional">COMANDO NACIONAL</SelectItem>
                    {regionais.map((regional) => (
                      <SelectItem key={regional.id} value={regional.id}>
                        {regional.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <Alert className="bg-primary/5 border-primary/20">
                <Info className="h-4 w-4 text-primary" />
                <AlertDescription className="text-xs text-primary">
                  O integrante será atualizado para Grau IV e permanecerá <strong>ativo</strong>.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Aviso para afastamento */}
          {mostrarAvisoAfastado && (
            <Alert className="bg-amber-500/10 border-amber-500/20">
              <Clock className="h-4 w-4 text-amber-500" />
              <AlertDescription className="text-xs text-amber-600">
                O integrante será <strong>mantido ativo</strong> pois está afastado temporariamente. 
                Verifique se ele está na lista de afastados.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="observacao">Observação (opcional)</Label>
            <Textarea
              id="observacao"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Adicione detalhes se necessário..."
              className="resize-none"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirmar}
            disabled={!podeConfirmar()}
            variant={motivoSelecionado?.variant === 'destructive' ? 'destructive' : 'default'}
          >
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
