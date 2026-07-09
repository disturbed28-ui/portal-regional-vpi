import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, UserCheck, User } from "lucide-react";
import { IntegrantePortal } from "@/hooks/useIntegrantes";

interface ModalReativarIntegranteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  integrante: IntegrantePortal | null;
  onConfirmar: (justificativa: string) => Promise<boolean>;
  operando: boolean;
}

export function ModalReativarIntegrante({
  open,
  onOpenChange,
  integrante,
  onConfirmar,
  operando,
}: ModalReativarIntegranteProps) {
  const [justificativa, setJustificativa] = useState("");

  useEffect(() => {
    if (open) {
      setJustificativa("");
    }
  }, [open]);

  const justificativaValida = justificativa.trim().length >= 10;

  const handleConfirmar = async () => {
    const success = await onConfirmar(justificativa);
    if (success) {
      onOpenChange(false);
    }
  };

  if (!integrante) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-emerald-600">
            <UserCheck className="h-5 w-5" />
            Reativar Integrante
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground">{integrante.nome_colete}</p>
                  <p className="text-sm text-muted-foreground">{integrante.cargo_grau_texto}</p>
                  <p className="text-xs text-muted-foreground">{integrante.divisao_texto}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <p className="text-sm text-muted-foreground">
            O integrante voltará a constar como <strong>ativo</strong> e a marcação de
            desligamento/inativação será removida. A ação fica registrada no histórico.
          </p>

          <div className="space-y-2">
            <Label htmlFor="justificativa-reativar" className="flex items-center gap-1">
              Justificativa <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="justificativa-reativar"
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Ex.: Retornou do afastamento; marcado como desligado por engano na carga (mínimo 10 caracteres)."
              className="min-h-[90px]"
            />
            <p className={`text-xs ${justificativaValida ? 'text-muted-foreground' : 'text-destructive'}`}>
              {justificativa.trim().length} / 10 caracteres mínimos
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={operando}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmar}
            disabled={operando || !justificativaValida}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {operando ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              "Confirmar Reativação"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
