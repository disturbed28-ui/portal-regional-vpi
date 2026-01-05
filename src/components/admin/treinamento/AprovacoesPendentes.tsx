import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, ClipboardCheck, Inbox } from 'lucide-react';
import { useAprovacoesPendentes } from '@/hooks/useAprovacoesPendentes';
import { CardAprovacaoTreinamento } from './CardAprovacaoTreinamento';
import { ModalRejeicaoTreinamento } from './ModalRejeicaoTreinamento';
import { ReadOnlyBanner } from '@/components/ui/read-only-banner';

interface AprovacoesPendentesProps {
  userId: string | undefined;
  readOnly?: boolean;
}

export function AprovacoesPendentes({ userId, readOnly = false }: AprovacoesPendentesProps) {
  const { solicitacoes, loading, operando, aprovar, rejeitar } = useAprovacoesPendentes(userId);
  const [rejeicaoModal, setRejeicaoModal] = useState<{
    open: boolean;
    aprovacaoId: string;
    solicitacaoId: string;
  }>({ open: false, aprovacaoId: '', solicitacaoId: '' });

  async function handleAprovar(aprovacaoId: string, solicitacaoId: string) {
    if (readOnly) return;
    await aprovar(aprovacaoId, solicitacaoId);
  }

  function handleRejeitar(aprovacaoId: string, solicitacaoId: string) {
    if (readOnly) return;
    setRejeicaoModal({ open: true, aprovacaoId, solicitacaoId });
  }

  async function handleConfirmRejeicao(justificativa: string) {
    const success = await rejeitar(
      rejeicaoModal.aprovacaoId,
      rejeicaoModal.solicitacaoId,
      justificativa
    );
    if (success) {
      setRejeicaoModal({ open: false, aprovacaoId: '', solicitacaoId: '' });
    }
  }

  if (loading) {
    return (
      <Card className="border-border/50">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-sm text-muted-foreground">Carregando aprovações...</p>
        </CardContent>
      </Card>
    );
  }

  if (solicitacoes.length === 0) {
    return (
      <div className="space-y-4">
        {readOnly && <ReadOnlyBanner />}
        <Card className="border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <Inbox className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Nenhuma aprovação pendente</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Não há solicitações de treinamento aguardando aprovação no momento.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {readOnly && <ReadOnlyBanner />}
        
        <div className="flex items-center gap-2 px-1">
          <ClipboardCheck className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold">
            Aprovações Pendentes ({solicitacoes.length})
          </h2>
        </div>

        <div className="space-y-4">
          {solicitacoes.map((solicitacao) => (
            <CardAprovacaoTreinamento
              key={solicitacao.id}
              solicitacao={solicitacao}
              onAprovar={readOnly ? undefined : handleAprovar}
              onRejeitar={readOnly ? undefined : handleRejeitar}
              operando={operando}
              readOnly={readOnly}
            />
          ))}
        </div>
      </div>

      {!readOnly && (
        <ModalRejeicaoTreinamento
          open={rejeicaoModal.open}
          onOpenChange={(open) => setRejeicaoModal(prev => ({ ...prev, open }))}
          onConfirm={handleConfirmRejeicao}
          loading={operando}
        />
      )}
    </>
  );
}
