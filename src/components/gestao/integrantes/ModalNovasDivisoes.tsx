import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { DivisaoNova, RegionalBase } from "@/lib/estruturaNovasDivisoes";

interface Props {
  open: boolean;
  pendentes: DivisaoNova[];
  regionais: RegionalBase[];
  onCancelar: () => void;
  onConfirmar: (escolhas: Record<string, string>) => void;
}

export function ModalNovasDivisoes({ open, pendentes, regionais, onCancelar, onConfirmar }: Props) {
  const [escolhas, setEscolhas] = useState<Record<string, string>>({});
  useEffect(() => { if (open) setEscolhas({}); }, [open]);
  const completo = pendentes.every((p) => escolhas[p.divisao]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancelar()}>
      <DialogContent className="w-[98vw] max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Divisões novas na carga</DialogTitle>
          <DialogDescription>
            Não consegui identificar a regional destas divisões. Escolha a regional de cada uma para que sejam criadas.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {pendentes.map((p) => (
            <div key={p.divisao} className="space-y-1">
              <p className="font-medium break-words">{p.divisao}</p>
              <p className="text-xs text-muted-foreground break-words">
                {p.integrantes} integrante(s) · Regional na lista: {p.regionalTexto || "não informada"}
              </p>
              <Select value={escolhas[p.divisao]} onValueChange={(v) => setEscolhas((e) => ({ ...e, [p.divisao]: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione a regional" /></SelectTrigger>
                <SelectContent>
                  {regionais.map((r) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancelar}>Cancelar</Button>
          <Button disabled={!completo} onClick={() => onConfirmar(escolhas)}>Criar e continuar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
