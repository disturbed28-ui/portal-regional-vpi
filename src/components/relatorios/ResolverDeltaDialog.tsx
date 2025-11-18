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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { useTiposDelta } from '@/hooks/useTiposDelta';
import { useAcoesResolucaoDelta } from '@/hooks/useAcoesResolucaoDelta';

interface ResolverDeltaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  delta: {
    id: string;
    tipo_delta: string;
    nome_colete: string;
    registro_id: number;
    divisao_texto: string;
    cargo_grau_texto: string | null;
    dados_adicionais?: any;
    created_at: string;
  } | null;
  onResolve: (observacao: string, acao: string) => Promise<void>;
}

export const ResolverDeltaDialog = ({
  open,
  onOpenChange,
  delta,
  onResolve,
}: ResolverDeltaDialogProps) => {
  const [observacao, setObservacao] = useState('');
  const [acaoSelecionada, setAcaoSelecionada] = useState('');
  const [loading, setLoading] = useState(false);
  const { getTipoByCode } = useTiposDelta();
  const { acoes } = useAcoesResolucaoDelta(delta?.tipo_delta);

  // ✅ Guard crítico: se não houver delta, não renderiza nada
  if (!delta) {
    return null;
  }

  const getTipoDeltaBadge = (tipo: string) => {
    const tipoDelta = getTipoByCode(tipo);
    if (!tipoDelta) return <Badge>{tipo}</Badge>;
    
    return (
      <Badge style={{ backgroundColor: tipoDelta.cor }}>
        {tipoDelta.icone} {tipoDelta.nome}
      </Badge>
    );
  };

  const handleResolver = async () => {
    if (!observacao.trim()) {
      return;
    }

    if (!acaoSelecionada) {
      return;
    }

    setLoading(true);
    await onResolve(observacao, acaoSelecionada);
    setLoading(false);
    setObservacao('');
    setAcaoSelecionada('');
    onOpenChange(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Resolver Delta de Integrante</DialogTitle>
          <DialogDescription>
            Analise o delta e escolha a ação apropriada
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Resumo do Delta */}
          <div className="bg-muted/50 border border-border p-4 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground">Tipo:</span>
              <div className="text-foreground">{getTipoDeltaBadge(delta.tipo_delta)}</div>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground">Integrante:</span>
              <span className="text-foreground">{delta.nome_colete}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground">Registro:</span>
              <span className="font-mono text-sm text-foreground">{delta.registro_id}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground">Divisão:</span>
              <span className="text-foreground">{delta.divisao_texto}</span>
            </div>
            {delta.cargo_grau_texto && (
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">Cargo/Grau:</span>
                <span className="text-foreground">{delta.cargo_grau_texto}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground">Detectado em:</span>
              <span className="text-sm text-foreground">{formatDate(delta.created_at)}</span>
            </div>
          </div>

          {/* Informações Adicionais */}
          {delta.dados_adicionais && (
            <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg text-sm">
              <p className="font-semibold mb-1 text-foreground">Informações adicionais:</p>
              <pre className="text-xs overflow-auto text-foreground">
                {JSON.stringify(delta.dados_adicionais, null, 2)}
              </pre>
            </div>
          )}

          {/* Seleção de Ação */}
          <div className="space-y-2">
            <Label>Selecione a ação apropriada:</Label>
              <RadioGroup value={acaoSelecionada} onValueChange={setAcaoSelecionada}>
                {acoes.map((acao) => (
                  <div key={acao.codigo_acao} className="flex items-center space-x-2">
                    <RadioGroupItem value={acao.codigo_acao} id={acao.codigo_acao} />
                    <Label htmlFor={acao.codigo_acao} className="cursor-pointer">
                      {acao.label}
                    </Label>
                  </div>
                ))}
            </RadioGroup>
          </div>

          {/* Observação */}
          <div className="space-y-2">
            <Label htmlFor="observacao">
              Observação <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="observacao"
              placeholder="Descreva a resolução deste delta (obrigatório para rastreabilidade)"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={4}
            />
            {!observacao.trim() && (
              <p className="text-sm text-muted-foreground">
                A observação é obrigatória para manter o histórico de resoluções
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={handleResolver}
            disabled={!observacao.trim() || !acaoSelecionada || loading}
          >
            {loading ? 'Resolvendo...' : 'Resolver Delta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
