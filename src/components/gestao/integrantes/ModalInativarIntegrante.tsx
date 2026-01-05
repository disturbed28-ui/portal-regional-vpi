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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, AlertTriangle, User } from "lucide-react";
import { IntegrantePortal } from "@/hooks/useIntegrantes";

interface ModalInativarIntegranteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  integrante: IntegrantePortal | null;
  onConfirmar: (motivo: string, justificativa: string) => Promise<boolean>;
  operando: boolean;
}

const MOTIVOS_INATIVACAO = [
  { value: "desligado", label: "Desligado" },
  { value: "transferido", label: "Transferido" },
  { value: "afastado", label: "Afastado" },
  { value: "outro", label: "Outro" },
];

export function ModalInativarIntegrante({
  open,
  onOpenChange,
  integrante,
  onConfirmar,
  operando,
}: ModalInativarIntegranteProps) {
  const [motivo, setMotivo] = useState("");
  const [justificativa, setJustificativa] = useState("");

  useEffect(() => {
    if (open) {
      setMotivo("");
      setJustificativa("");
    }
  }, [open]);

  const justificativaValida = justificativa.trim().length >= 30;
  const formularioValido = motivo && justificativaValida;

  const handleConfirmar = async () => {
    const success = await onConfirmar(motivo, justificativa);
    if (success) {
      onOpenChange(false);
    }
  };

  if (!integrante) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Inativar Integrante
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Card do integrante */}
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-destructive" />
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
            Você está prestes a inativar este integrante. Esta ação pode ser revertida posteriormente.
          </p>

          {/* Motivo */}
          <div className="space-y-3">
            <Label className="flex items-center gap-1">
              Motivo da Inativação <span className="text-destructive">*</span>
            </Label>
            <RadioGroup value={motivo} onValueChange={setMotivo}>
              {MOTIVOS_INATIVACAO.map((m) => (
                <div key={m.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={m.value} id={m.value} />
                  <Label htmlFor={m.value} className="font-normal cursor-pointer">
                    {m.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Justificativa */}
          <div className="space-y-2">
            <Label htmlFor="justificativa" className="flex items-center gap-1">
              Justificativa <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="justificativa"
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Descreva detalhadamente o motivo da inativação (mínimo 30 caracteres)"
              className="min-h-[100px]"
            />
            <p className={`text-xs ${justificativaValida ? 'text-muted-foreground' : 'text-destructive'}`}>
              {justificativa.length} / 30 caracteres mínimos
              {!justificativaValida && justificativa.length > 0 && (
                <span> ({30 - justificativa.length} restantes)</span>
              )}
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={operando}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirmar}
            disabled={operando || !formularioValido}
          >
            {operando ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              "Confirmar Inativação"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
