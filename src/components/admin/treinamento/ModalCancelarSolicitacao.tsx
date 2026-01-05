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
import { AlertTriangle, Loader2 } from 'lucide-react';

interface ModalCancelarSolicitacaoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cargoTreinamentoNome: string;
  integranteNome: string;
  onConfirm: (justificativa: string) => Promise<void>;
  loading?: boolean;
}

const MIN_CHARS = 30;

export function ModalCancelarSolicitacao({
  open,
  onOpenChange,
  cargoTreinamentoNome,
  integranteNome,
  onConfirm,
  loading = false
}: ModalCancelarSolicitacaoProps) {
  const [justificativa, setJustificativa] = useState('');

  const isValid = justificativa.trim().length >= MIN_CHARS;
  const charsRestantes = MIN_CHARS - justificativa.trim().length;

  async function handleConfirm() {
    if (!isValid) return;
    await onConfirm(justificativa.trim());
    setJustificativa('');
  }

  function handleCancel() {
    setJustificativa('');
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Cancelar Solicitação de Treinamento
          </DialogTitle>
          <DialogDescription className="text-left">
            Você está prestes a cancelar a solicitação de treinamento de{' '}
            <span className="font-medium text-foreground">{integranteNome}</span> para o cargo{' '}
            <span className="font-medium text-foreground">{cargoTreinamentoNome}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="justificativa" className="text-sm font-medium">
              Justificativa <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="justificativa"
              placeholder="Descreva o motivo do cancelamento (mínimo 30 caracteres)..."
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              rows={4}
              className="resize-none"
            />
            {justificativa.length > 0 && charsRestantes > 0 && (
              <p className="text-xs text-muted-foreground">
                {charsRestantes} caracteres restantes
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
            Voltar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isValid || loading}
            className="w-full sm:w-auto"
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmar Cancelamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
