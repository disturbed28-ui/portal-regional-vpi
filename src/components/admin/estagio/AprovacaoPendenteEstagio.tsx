import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, ClipboardCheck, Inbox } from 'lucide-react';
import { useAprovacoesEstagiosPendentes } from '@/hooks/useAprovacoesEstagiosPendentes';
import { CardAprovacaoEstagio } from './CardAprovacaoEstagio';
import { ModalRejeicaoEstagio } from './ModalRejeicaoEstagio';
import { ModalJustificativaEscalacao } from '@/components/admin/treinamento/ModalJustificativaEscalacao';
import { ReadOnlyBanner } from '@/components/ui/read-only-banner';

interface AprovacaoPendenteEstagioProps {
  userId: string | undefined;
  readOnly?: boolean;
}

export function AprovacaoPendenteEstagio({ userId, readOnly = false }: AprovacaoPendenteEstagioProps) {
  const { solicitacoes, loading, operando, aprovar, rejeitar, aprovarPorEscalacao } = useAprovacoesEstagiosPendentes(userId);
  const [rejeicaoModal, setRejeicaoModal] = useState<{
    open: boolean;
    aprovacaoId: string;
    solicitacaoId: string;
  }>({ open: false, aprovacaoId: '', solicitacaoId: '' });
  
  const [escalacaoModal, setEscalacaoModal] = useState<{
    open: boolean;
    aprovacaoId: string;
    solicitacaoId: string;
    aprovadorNome: string | null;
    tipoAprovador: string;
  }>({ open: false, aprovacaoId: '', solicitacaoId: '', aprovadorNome: null, tipoAprovador: '' });

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

  function handleAbrirEscalacao(
    aprovacaoId: string, 
    solicitacaoId: string, 
    aprovadorNome: string | null, 
    tipoAprovador: string
  ) {
    if (readOnly) return;
    setEscalacaoModal({ open: true, aprovacaoId, solicitacaoId, aprovadorNome, tipoAprovador });
  }

  async function handleConfirmEscalacao(justificativa: string) {
    const success = await aprovarPorEscalacao(
      escalacaoModal.aprovacaoId,
      escalacaoModal.solicitacaoId,
      justificativa
    );
    if (success) {
      setEscalacaoModal({ open: false, aprovacaoId: '', solicitacaoId: '', aprovadorNome: null, tipoAprovador: '' });
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
              Não há solicitações de estágio aguardando aprovação no momento.
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
            Aprovações Pendentes de Estágio ({solicitacoes.length})
          </h2>
        </div>

        <div className="space-y-4">
          {solicitacoes.map((solicitacao) => (
            <CardAprovacaoEstagio
              key={solicitacao.id}
              solicitacao={solicitacao}
              onAprovar={readOnly ? undefined : handleAprovar}
              onRejeitar={readOnly ? undefined : handleRejeitar}
              onAprovarPorEscalacao={readOnly ? undefined : handleAbrirEscalacao}
              operando={operando}
              readOnly={readOnly}
            />
          ))}
        </div>
      </div>

      {!readOnly && (
        <>
          <ModalRejeicaoEstagio
            open={rejeicaoModal.open}
            onOpenChange={(open) => setRejeicaoModal(prev => ({ ...prev, open }))}
            onConfirm={handleConfirmRejeicao}
            loading={operando}
          />
          <ModalJustificativaEscalacao
            open={escalacaoModal.open}
            onOpenChange={(open) => setEscalacaoModal(prev => ({ ...prev, open }))}
            aprovadorNome={escalacaoModal.aprovadorNome || undefined}
            tipoAprovador={escalacaoModal.tipoAprovador}
            onConfirm={handleConfirmEscalacao}
            loading={operando}
          />
        </>
      )}
    </>
  );
}
