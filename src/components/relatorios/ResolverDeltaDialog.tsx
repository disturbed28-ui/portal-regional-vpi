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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTiposDelta } from '@/hooks/useTiposDelta';
import { useAcoesResolucaoDelta } from '@/hooks/useAcoesResolucaoDelta';
import { useCargosGrau4 } from '@/hooks/useCargosGrau4';
import { useRegionais } from '@/hooks/useRegionais';
import { Card } from '@/components/ui/card';
import { ArrowUp } from 'lucide-react';
import type { DadosPromocaoGrau4 } from '@/hooks/useResolverDelta';

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
  onResolve: (observacao: string, acao: string, dadosPromocao?: DadosPromocaoGrau4) => Promise<void>;
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
  
  // Estados para promoção Grau IV
  const [novoCargoId, setNovoCargoId] = useState('');
  const [novaRegionalId, setNovaRegionalId] = useState('');
  
  const { getTipoByCode } = useTiposDelta();
  const { acoes } = useAcoesResolucaoDelta(delta?.tipo_delta);
  const { cargosGrau4 } = useCargosGrau4();
  const { regionais } = useRegionais();

  // Reset campos quando dialog abre/fecha
  useEffect(() => {
    if (!open) {
      setObservacao('');
      setAcaoSelecionada('');
      setNovoCargoId('');
      setNovaRegionalId('');
    }
  }, [open]);

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

  const isPromocaoGrau4 = acaoSelecionada === 'promovido_grau4';
  
  // Validação: se for promoção, precisa dos campos extras
  const canSubmit = observacao.trim() && acaoSelecionada && 
    (!isPromocaoGrau4 || (novoCargoId && novaRegionalId));

  const handleResolver = async () => {
    if (!canSubmit) return;

    setLoading(true);
    
    let dadosPromocao: DadosPromocaoGrau4 | undefined;
    
    if (isPromocaoGrau4) {
      const cargoSelecionado = cargosGrau4.find(c => c.id === novoCargoId);
      
      // Tratar "COMANDO NACIONAL" como caso especial
      const isComandoNacional = novaRegionalId === 'COMANDO_NACIONAL';
      const regionalSelecionada = isComandoNacional ? null : regionais.find(r => r.id === novaRegionalId);
      
      dadosPromocao = {
        novoCargoId: novoCargoId,
        novoCargoNome: cargoSelecionado?.nome || '',
        novaRegional: isComandoNacional ? 'COMANDO NACIONAL' : (regionalSelecionada?.nome || ''),
        novaRegionalId: isComandoNacional ? undefined : novaRegionalId
      };
    }
    
    await onResolve(observacao, acaoSelecionada, dadosPromocao);
    setLoading(false);
    setObservacao('');
    setAcaoSelecionada('');
    setNovoCargoId('');
    setNovaRegionalId('');
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
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
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
            <div className="bg-muted border border-border rounded-lg p-3 text-sm space-y-2">
              <p className="font-semibold text-foreground">Informações adicionais:</p>
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

          {/* Campos extras para Promoção Grau IV */}
          {isPromocaoGrau4 && (
            <Card className="p-4 border-primary/30 bg-primary/5 space-y-4">
              <div className="flex items-center gap-2 text-primary">
                <ArrowUp className="h-4 w-4" />
                <span className="font-medium">Dados da Promoção para Grau IV</span>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="novo-cargo">Novo Cargo (Grau IV) *</Label>
                <Select value={novoCargoId} onValueChange={setNovoCargoId}>
                  <SelectTrigger id="novo-cargo">
                    <SelectValue placeholder="Selecione o cargo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {cargosGrau4.map((cargo) => (
                      <SelectItem key={cargo.id} value={cargo.id}>
                        {cargo.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="nova-regional">Nova Regional/Comando *</Label>
                <Select value={novaRegionalId} onValueChange={setNovaRegionalId}>
                  <SelectTrigger id="nova-regional">
                    <SelectValue placeholder="Selecione a regional..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="COMANDO_NACIONAL">
                      🏛️ COMANDO NACIONAL
                    </SelectItem>
                    {regionais.map((regional) => (
                      <SelectItem key={regional.id} value={regional.id}>
                        {regional.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <p className="text-xs text-muted-foreground">
                O integrante será atualizado para Grau IV, com divisão definida como "COMANDO".
              </p>
            </Card>
          )}

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
            disabled={!canSubmit || loading}
          >
            {loading ? 'Resolvendo...' : 'Resolver Delta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
