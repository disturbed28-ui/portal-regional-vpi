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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, AlertTriangle } from 'lucide-react';

interface ModalJustificativaEscalacaoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aprovadorNome?: string;
  tipoAprovador?: string;
  onConfirm: (justificativa: string) => Promise<void>;
  loading: boolean;
}

export function ModalJustificativaEscalacao({
  open,
  onOpenChange,
  aprovadorNome,
  tipoAprovador,
  onConfirm,
  loading
}: ModalJustificativaEscalacaoProps) {
  const [justificativa, setJustificativa] = useState('');

  const handleConfirm = async () => {
    if (justificativa.trim().length < 10) return;
    await onConfirm(justificativa.trim());
    setJustificativa('');
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setJustificativa('');
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Aprovação por Escalação Hierárquica
          </DialogTitle>
          <DialogDescription className="text-left space-y-2">
            <p>
              Você está aprovando uma etapa que não é a sua vez na cadeia de aprovação.
            </p>
            {aprovadorNome && (
              <p className="text-sm">
                <strong>Aprovador original:</strong> {aprovadorNome}
                {tipoAprovador && ` (${tipoAprovador})`}
              </p>
            )}
            <p className="text-amber-600 font-medium">
              Por favor, justifique o motivo da aprovação antecipada.
            </p>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-2">
            <Label htmlFor="justificativa">Justificativa *</Label>
            <Textarea
              id="justificativa"
              placeholder="Descreva o motivo pelo qual está aprovando fora da ordem..."
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              className="min-h-[100px]"
              disabled={loading}
            />
            {justificativa.length > 0 && justificativa.length < 10 && (
              <p className="text-xs text-destructive">
                A justificativa deve ter pelo menos 10 caracteres
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading || justificativa.trim().length < 10}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Aprovando...
              </>
            ) : (
              'Confirmar Aprovação'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
