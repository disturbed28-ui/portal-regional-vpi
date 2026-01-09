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
import { MotivoRemovido } from "@/hooks/useConsolidacaoIntegrantes";
import { IntegrantePortal } from "@/hooks/useIntegrantes";

interface ModalMotivoRemovidoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  integrante: IntegrantePortal;
  onConfirmar: (motivo: MotivoRemovido) => void;
}

const MOTIVOS_INATIVACAO = [
  { value: 'transferido', label: 'Transferido para outra regional' },
  { value: 'desligado', label: 'Desligamento voluntário' },
  { value: 'expulso', label: 'Expulsão' },
  { value: 'afastado', label: 'Afastamento temporário' },
  { value: 'falecido', label: 'Falecimento' },
  { value: 'promovido', label: 'Promoção para cargo externo' },
  { value: 'outro', label: 'Outro motivo' },
] as const;

export function ModalMotivoRemovido({
  open,
  onOpenChange,
  integrante,
  onConfirmar
}: ModalMotivoRemovidoProps) {
  const [motivo, setMotivo] = useState<string>('outro');
  const [observacao, setObservacao] = useState('');

  useEffect(() => {
    if (open) {
      setMotivo('outro');
      setObservacao('');
    }
  }, [open]);

  const handleConfirmar = () => {
    onConfirmar({
      integrante_id: integrante.id,
      registro_id: integrante.registro_id,
      nome_colete: integrante.nome_colete,
      motivo_inativacao: motivo as MotivoRemovido['motivo_inativacao'],
      observacao_inativacao: observacao || undefined
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Motivo da Inativação</DialogTitle>
          <DialogDescription>
            Defina o motivo para inativar <strong>{integrante.nome_colete}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <Label>Motivo</Label>
            <RadioGroup value={motivo} onValueChange={setMotivo}>
              {MOTIVOS_INATIVACAO.map((m) => (
                <div key={m.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={m.value} id={m.value} />
                  <Label htmlFor={m.value} className="text-sm font-normal cursor-pointer">
                    {m.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

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
          <Button onClick={handleConfirmar}>
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
