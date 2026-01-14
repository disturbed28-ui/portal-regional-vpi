import { useState, useMemo } from 'react';
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
import { CheckCircle, Loader2 } from 'lucide-react';

interface ModalEncerrarEstagioProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cargoEstagioNome: string | null;
  grauEstagio: string | null;
  integranteNome?: string;
  onConfirm: (tipoEncerramento: string, observacoes: string) => Promise<void>;
  loading?: boolean;
}

const TIPOS_ENCERRAMENTO = [
  { 
    value: 'Concluido com aproveitamento', 
    label: 'Concluído com aproveitamento',
    justificativaObrigatoria: false 
  },
  { 
    value: 'Concluido sem aproveitamento', 
    label: 'Concluído sem aproveitamento',
    justificativaObrigatoria: true 
  },
  { 
    value: 'Encerrado para novo estagio', 
    label: 'Encerrar para iniciar novo estágio',
    justificativaObrigatoria: true 
  },
];

const MIN_CHARS = 30;

export function ModalEncerrarEstagio({
  open,
  onOpenChange,
  cargoEstagioNome,
  grauEstagio,
  integranteNome,
  onConfirm,
  loading = false
}: ModalEncerrarEstagioProps) {
  const [tipoEncerramento, setTipoEncerramento] = useState<string>('');
  const [observacoes, setObservacoes] = useState('');

  const tipoSelecionado = useMemo(() => 
    TIPOS_ENCERRAMENTO.find(t => t.value === tipoEncerramento),
    [tipoEncerramento]
  );

  const justificativaObrigatoria = tipoSelecionado?.justificativaObrigatoria ?? false;
  const charsRestantes = MIN_CHARS - observacoes.trim().length;

  const isValid = tipoEncerramento && (
    !justificativaObrigatoria || observacoes.trim().length >= MIN_CHARS
  );

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
            <CheckCircle className="h-5 w-5 text-primary" />
            Encerrar Estágio
          </DialogTitle>
          <DialogDescription className="text-left">
            {integranteNome ? (
              <>
                Encerrar o estágio de{' '}
                <span className="font-medium text-foreground">{integranteNome}</span>
                {cargoEstagioNome && (
                  <> para o cargo <span className="font-medium text-foreground">{cargoEstagioNome}</span></>
                )}
                {grauEstagio && (
                  <> (Grau {grauEstagio})</>
                )}
                .
              </>
            ) : (
              <>
                Encerrar o estágio atual
                {cargoEstagioNome && (
                  <> para o cargo <span className="font-medium text-foreground">{cargoEstagioNome}</span></>
                )}
                {grauEstagio && (
                  <> (Grau {grauEstagio})</>
                )}
                .
              </>
            )}
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
              Observações {justificativaObrigatoria && <span className="text-destructive">*</span>}
            </Label>
            <Textarea
              id="observacoes"
              placeholder={justificativaObrigatoria 
                ? `Descreva o motivo do encerramento (mínimo ${MIN_CHARS} caracteres)...`
                : 'Observações opcionais...'
              }
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
              className="resize-none"
            />
            {justificativaObrigatoria && observacoes.length > 0 && charsRestantes > 0 && (
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
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!isValid || loading}
            className="w-full sm:w-auto"
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmar Encerramento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
