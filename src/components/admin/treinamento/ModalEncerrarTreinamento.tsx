import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface ModalEncerrarTreinamentoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cargoTreinamentoNome: string | null;
  onConfirm: (tipoEncerramento: string, observacoes: string) => Promise<void>;
  loading?: boolean;
}

const TIPOS_ENCERRAMENTO = [
  { value: 'Concluido com aproveitamento', label: 'Concluído com aproveitamento' },
  { value: 'Concluido sem aproveitamento', label: 'Concluído sem aproveitamento' },
];

export function ModalEncerrarTreinamento({
  open,
  onOpenChange,
  cargoTreinamentoNome,
  onConfirm,
  loading = false
}: ModalEncerrarTreinamentoProps) {
  const [tipoEncerramento, setTipoEncerramento] = useState<string>('');
  const [observacoes, setObservacoes] = useState('');

  const isValid = tipoEncerramento && observacoes.trim().length >= 10;

  async function handleConfirm() {
    if (!isValid) return;
    await onConfirm(tipoEncerramento, observacoes.trim());
    // Reset form
    setTipoEncerramento('');
    setObservacoes('');
  }

  function handleCancel() {
    setTipoEncerramento('');
    setObservacoes('');
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Encerrar Treinamento Anterior
          </DialogTitle>
          <DialogDescription className="text-left">
            Este integrante já possui um treinamento em andamento
            {cargoTreinamentoNome && (
              <span className="font-medium text-foreground"> ({cargoTreinamentoNome})</span>
            )}
            . Deseja encerrar o treinamento anterior para iniciar um novo?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Tipo de Encerramento <span className="text-destructive">*</span>
            </Label>
            <RadioGroup
              value={tipoEncerramento}
              onValueChange={setTipoEncerramento}
              className="space-y-2"
            >
              {TIPOS_ENCERRAMENTO.map((tipo) => (
                <div key={tipo.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={tipo.value} id={tipo.value} />
                  <Label htmlFor={tipo.value} className="text-sm font-normal cursor-pointer">
                    {tipo.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes" className="text-sm font-medium">
              Observações <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="observacoes"
              placeholder="Descreva o motivo do encerramento (mínimo 10 caracteres)..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
              className="resize-none"
            />
            {observacoes.length > 0 && observacoes.length < 10 && (
              <p className="text-xs text-muted-foreground">
                {10 - observacoes.length} caracteres restantes
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            Não, Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!isValid || loading}
            className="w-full sm:w-auto"
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmar e Prosseguir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
