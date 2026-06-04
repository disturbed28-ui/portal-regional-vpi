import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

const notify = (m: string, e = false) =>
  (e ? toast.error : toast.success)(m, { duration: 6000, dismissible: false });

export interface BaixaPayload {
  contato_em: string | null; // YYYY-MM-DD
  observacao: string;
}

interface BaixaDialogProps {
  candidatoNome: string;
  statusLabel: string;
  /** Texto do botão que abre o diálogo. */
  triggerLabel: string;
  /** Exigir data de contato (efetivado/desistente). */
  requireContato?: boolean;
  onConfirm: (payload: BaixaPayload) => Promise<void> | void;
  buttonVariant?: "default" | "outline" | "ghost" | "secondary" | "destructive";
  buttonSize?: "default" | "sm" | "lg" | "icon";
  buttonClassName?: string;
}

/**
 * Diálogo de baixa de candidato da Expansão.
 * Captura a data do contato (opcional/obrigatória) e a observação (sempre obrigatória).
 */
export function BaixaDialog({
  candidatoNome, statusLabel, triggerLabel, requireContato = false,
  onConfirm, buttonVariant = "outline", buttonSize = "sm", buttonClassName = "text-xs",
}: BaixaDialogProps) {
  const [open, setOpen] = useState(false);
  const [contato, setContato] = useState("");
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);

  const confirmar = async () => {
    if (requireContato && !contato) {
      notify("Informe a data do contato com o candidato.", true);
      return;
    }
    if (!obs.trim()) {
      notify("A observação é obrigatória.", true);
      return;
    }
    setSaving(true);
    try {
      await onConfirm({ contato_em: contato || null, observacao: obs.trim() });
      setOpen(false);
      setContato("");
      setObs("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant={buttonVariant} size={buttonSize} className={buttonClassName}>
          {triggerLabel}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar baixa</AlertDialogTitle>
          <AlertDialogDescription>
            Marcar <strong>{candidatoNome}</strong> como <strong>{statusLabel}</strong>?
            Esta ação pode ser revertida apenas por um administrador.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="contato-data">
              Data do contato com o candidato{requireContato ? " *" : " (opcional)"}
            </Label>
            <Input
              id="contato-data"
              type="date"
              value={contato}
              onChange={(e) => setContato(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="obs">Observação *</Label>
            <Textarea
              id="obs"
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Descreva o resultado / motivo do contato"
              rows={3}
            />
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
          <Button onClick={confirmar} disabled={saving}>
            {saving ? "Salvando..." : "Confirmar"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
