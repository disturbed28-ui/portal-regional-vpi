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

  // ✅ Guard crítico: se não houver delta, não renderiza nada
  if (!delta) {
    return null;
  }

  const getTipoDeltaBadge = (tipo: string) => {
    switch (tipo) {
      case 'SUMIU_ATIVOS':
        return <Badge className="bg-red-600">🚨 Sumiu dos Ativos</Badge>;
      case 'SUMIU_AFASTADOS':
        return <Badge className="bg-orange-600">↩️ Saiu dos Afastados</Badge>;
      case 'NOVO_ATIVOS':
        return <Badge className="bg-green-600">🆕 Novo Ativo</Badge>;
      case 'NOVO_AFASTADOS':
        return <Badge className="bg-blue-600">⏸️ Novo Afastamento</Badge>;
      default:
        return <Badge>{tipo}</Badge>;
    }
  };

  const getAcoesDisponiveis = () => {
    if (!delta) return []; // defensive: redundante mas garante segurança futura
    
    if (delta.tipo_delta === 'SUMIU_ATIVOS') {
      return [
        { value: 'transferido', label: '📤 Transferido para outra divisão/regional' },
        { value: 'desligamento', label: '👋 Pediu desligamento voluntário' },
        { value: 'expulso', label: '⛔ Foi expulso do clube' },
        { value: 'afastado', label: '⏸️ Passou para lista de afastados' },
        { value: 'erro_planilha', label: '📋 Erro na planilha de carga' },
      ];
    } else if (delta.tipo_delta === 'SUMIU_AFASTADOS') {
      return [
        { value: 'retornou', label: 'Retornou ao clube' },
        { value: 'saiu', label: 'Saiu do clube' },
        { value: 'erro', label: 'Erro de planilha' },
      ];
    } else if (delta.tipo_delta === 'NOVO_AFASTADOS') {
      return [{ value: 'confirmar', label: 'Confirmar afastamento' }];
    } else if (delta.tipo_delta === 'NOVO_ATIVOS') {
      return [
        { value: 'confirmar_novo', label: 'Confirmar novo integrante ativo' },
        { value: 'retorno_afastamento', label: 'Retorno de afastamento' },
        { value: 'erro_planilha', label: 'Erro na planilha de carga' },
      ];
    }
    return [];
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
              {getAcoesDisponiveis().map((acao) => (
                <div key={acao.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={acao.value} id={acao.value} />
                  <Label htmlFor={acao.value} className="cursor-pointer">
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
