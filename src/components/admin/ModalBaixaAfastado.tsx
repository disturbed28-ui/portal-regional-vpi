import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, UserCheck, UserMinus, FileText } from "lucide-react";
import type { IntegranteAfastado } from "@/hooks/useAfastados";

export type MotivoBaixa = 'retornou' | 'desligamento' | 'outro';

interface ModalBaixaAfastadoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  afastado: IntegranteAfastado | null;
  onConfirm: (motivo: MotivoBaixa, observacao?: string) => Promise<void>;
}

const opcoesMotivo = [
  {
    value: 'retornou' as MotivoBaixa,
    label: 'Retornou ao clube',
    descricao: 'O integrante voltou às atividades normais',
    icon: UserCheck,
  },
  {
    value: 'desligamento' as MotivoBaixa,
    label: 'Pediu desligamento',
    descricao: 'O integrante solicitou saída do clube',
    icon: UserMinus,
  },
  {
    value: 'outro' as MotivoBaixa,
    label: 'Outro motivo',
    descricao: 'Especificar no campo de observações',
    icon: FileText,
  },
];

export const ModalBaixaAfastado = ({
  open,
  onOpenChange,
  afastado,
  onConfirm,
}: ModalBaixaAfastadoProps) => {
  const [motivo, setMotivo] = useState<MotivoBaixa>('retornou');
  const [observacao, setObservacao] = useState('');
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (motivo === 'outro' && !observacao.trim()) {
      return;
    }

    setLoading(true);
    try {
      await onConfirm(motivo, observacao.trim() || undefined);
      // Reset form on success
      setMotivo('retornou');
      setObservacao('');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!loading) {
      if (!newOpen) {
        setMotivo('retornou');
        setObservacao('');
      }
      onOpenChange(newOpen);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Saída do Afastamento</DialogTitle>
          {afastado && (
            <DialogDescription>
              <span className="font-medium text-foreground">{afastado.nome_colete}</span>
              <span className="text-muted-foreground"> • {afastado.divisao_texto}</span>
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4 py-4">
          <RadioGroup
            value={motivo}
            onValueChange={(value) => setMotivo(value as MotivoBaixa)}
            className="space-y-3"
          >
            {opcoesMotivo.map((opcao) => (
              <div
                key={opcao.value}
                className={`flex items-start space-x-3 rounded-lg border p-4 transition-colors cursor-pointer ${
                  motivo === opcao.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground/30'
                }`}
                onClick={() => setMotivo(opcao.value)}
              >
                <RadioGroupItem value={opcao.value} id={opcao.value} className="mt-0.5" />
                <div className="flex-1 space-y-1">
                  <Label
                    htmlFor={opcao.value}
                    className="flex items-center gap-2 font-medium cursor-pointer"
                  >
                    <opcao.icon className="h-4 w-4 text-muted-foreground" />
                    {opcao.label}
                  </Label>
                  <p className="text-sm text-muted-foreground">{opcao.descricao}</p>
                </div>
              </div>
            ))}
          </RadioGroup>

          <div className="space-y-2">
            <Label htmlFor="observacao">
              Observações {motivo === 'outro' && <span className="text-destructive">*</span>}
            </Label>
            <Textarea
              id="observacao"
              placeholder={
                motivo === 'outro'
                  ? 'Descreva o motivo da baixa...'
                  : 'Observações adicionais (opcional)'
              }
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={3}
            />
            {motivo === 'outro' && !observacao.trim() && (
              <p className="text-sm text-destructive">
                Campo obrigatório quando "Outro motivo" está selecionado
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading || (motivo === 'outro' && !observacao.trim())}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar Baixa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
