import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Loader2, XCircle } from 'lucide-react';

interface ModalRejeicaoTreinamentoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (justificativa: string) => void;
  loading: boolean;
}

const MIN_CARACTERES = 30;

export function ModalRejeicaoTreinamento({
  open,
  onOpenChange,
  onConfirm,
  loading
}: ModalRejeicaoTreinamentoProps) {
  const [justificativa, setJustificativa] = useState('');

  useEffect(() => {
    if (!open) {
      setJustificativa('');
    }
  }, [open]);

  const caracteresFaltando = MIN_CARACTERES - justificativa.length;
  const isValid = justificativa.length >= MIN_CARACTERES;

  function handleConfirm() {
    if (isValid) {
      onConfirm(justificativa.trim());
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Rejeitar Solicitação
          </DialogTitle>
          <DialogDescription>
            Informe o motivo da rejeição. Esta ação encerrará o fluxo de aprovação.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="justificativa" className="text-sm">
              Justificativa <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="justificativa"
              placeholder="Descreva o motivo da rejeição..."
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              className="min-h-[120px] resize-none"
              disabled={loading}
            />
            <div className="flex justify-between text-xs">
              <span className={`${isValid ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                {justificativa.length} caracteres
              </span>
              {!isValid && (
                <span className="text-amber-600">
                  Mínimo: {caracteresFaltando} caracteres restantes
                </span>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isValid || loading}
            className="w-full sm:w-auto"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 mr-2" />
                Confirmar Rejeição
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
