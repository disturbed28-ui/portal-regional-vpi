import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, User, Building2, MapPin, Briefcase, GraduationCap, Calendar, Clock, XCircle, CheckCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useEncerramentoTreinamento, TreinamentoEncerramento } from '@/hooks/useEncerramentoTreinamento';
import { ModalCancelarSolicitacao } from './ModalCancelarSolicitacao';
import { ModalEncerrarTreinamento } from './ModalEncerrarTreinamento';
import { ReadOnlyBanner } from '@/components/ui/read-only-banner';
import { supabase } from '@/integrations/supabase/client';

interface EncerramentoTreinamentoProps {
  userId: string | undefined;
  readOnly?: boolean;
}

interface DadosUsuario {
  id: string | null;
  nome: string;
  cargo: string | null;
  divisao: string | null;
}

export function EncerramentoTreinamento({ userId, readOnly = false }: EncerramentoTreinamentoProps) {
  const { treinamentos, loading, operando, cancelarSolicitacao, encerrarTreinamento } = useEncerramentoTreinamento(userId);
  
  const [modalCancelar, setModalCancelar] = useState<TreinamentoEncerramento | null>(null);
  const [modalEncerrar, setModalEncerrar] = useState<TreinamentoEncerramento | null>(null);
  const [dadosUsuario, setDadosUsuario] = useState<DadosUsuario>({ id: null, nome: '', cargo: null, divisao: null });

  // Buscar dados do usuário logado
  useEffect(() => {
    async function fetchDadosUsuario() {
      if (!userId) return;
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('nome_colete, cargo, divisao')
        .eq('id', userId)
        .single();
      
      if (profile) {
        // Buscar integrante_id
        let integranteId: string | null = null;
        if (profile.nome_colete) {
          const { data: integrante } = await supabase
            .from('integrantes_portal')
            .select('id')
            .eq('nome_colete', profile.nome_colete)
            .eq('ativo', true)
            .single();
          integranteId = integrante?.id || null;
        }
        
        setDadosUsuario({
          id: integranteId,
          nome: profile.nome_colete || '',
          cargo: profile.cargo || null,
          divisao: profile.divisao || null
        });
      }
    }
    
    fetchDadosUsuario();
  }, [userId]);

  async function handleCancelar(justificativa: string) {
    if (!modalCancelar) return;
    
    const success = await cancelarSolicitacao({
      solicitacaoId: modalCancelar.id,
      integranteId: modalCancelar.integrante_id,
      justificativa,
      canceladoPor: dadosUsuario
    });
    
    if (success) {
      setModalCancelar(null);
    }
  }

  async function handleEncerrar(tipoEncerramento: string, observacoes: string) {
    if (!modalEncerrar) return;
    
    const success = await encerrarTreinamento({
      solicitacaoId: modalEncerrar.id,
      integranteId: modalEncerrar.integrante_id,
      cargoTreinamentoId: modalEncerrar.cargo_treinamento_id,
      tipoEncerramento,
      observacoes,
      encerradoPor: dadosUsuario
    });
    
    if (success) {
      setModalEncerrar(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (treinamentos.length === 0) {
    return (
      <div className="space-y-4">
        {readOnly && <ReadOnlyBanner />}
        <Card className="border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <CheckCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Nenhum treinamento ativo</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Não há treinamentos em andamento ou solicitações pendentes para gerenciar.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {readOnly && <ReadOnlyBanner />}
      
      {treinamentos.map((t) => (
        <Card key={t.id} className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-primary" />
                {t.cargo_treinamento_nome}
              </CardTitle>
              <Badge 
                variant={t.status === 'Em Aprovacao' ? 'secondary' : 'default'}
                className={t.status === 'Em Treinamento' ? 'bg-green-600 hover:bg-green-700' : ''}
              >
                {t.status === 'Em Aprovacao' ? 'Em Aprovação' : t.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Dados do Integrante */}
            <div className="grid gap-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="h-4 w-4 shrink-0" />
                <span>Integrante:</span>
                <span className="text-foreground font-medium">{t.integrante_nome_colete}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="h-4 w-4 shrink-0" />
                <span>Divisão:</span>
                <span className="text-foreground">{t.integrante_divisao_texto}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0" />
                <span>Regional:</span>
                <span className="text-foreground">{t.integrante_regional_texto}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Briefcase className="h-4 w-4 shrink-0" />
                <span>Cargo Atual:</span>
                <span className="text-foreground">{t.integrante_cargo_atual}</span>
              </div>
            </div>

            {/* Dados do Treinamento */}
            {t.status === 'Em Treinamento' && (
              <div className="grid gap-2 text-sm border-t pt-3">
                {t.data_inicio_treinamento && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4 shrink-0" />
                    <span>Data Início:</span>
                    <span className="text-foreground">
                      {format(parseISO(t.data_inicio_treinamento), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4 shrink-0" />
                  <span>SLA:</span>
                  <span className="text-foreground">{t.tempo_treinamento_meses} meses</span>
                </div>
                {t.data_termino_previsto && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4 shrink-0" />
                    <span>Término Previsto:</span>
                    <span className="text-foreground">
                      {format(parseISO(t.data_termino_previsto), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Ações - só aparecem se NÃO for readOnly */}
            {!readOnly && (
              <div className="flex gap-2 pt-2 border-t">
                {t.status === 'Em Aprovacao' && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setModalCancelar(t)}
                    disabled={operando}
                    className="flex-1"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancelar Solicitação
                  </Button>
                )}
                {t.status === 'Em Treinamento' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setModalEncerrar(t)}
                    disabled={operando}
                    className="flex-1"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Encerrar Treinamento
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Modais - só renderizam se não for readOnly */}
      {!readOnly && (
        <>
          {modalCancelar && (
            <ModalCancelarSolicitacao
              open={!!modalCancelar}
              onOpenChange={(open) => !open && setModalCancelar(null)}
              cargoTreinamentoNome={modalCancelar.cargo_treinamento_nome}
              integranteNome={modalCancelar.integrante_nome_colete}
              onConfirm={handleCancelar}
              loading={operando}
            />
          )}

          {modalEncerrar && (
            <ModalEncerrarTreinamento
              open={!!modalEncerrar}
              onOpenChange={(open) => !open && setModalEncerrar(null)}
              cargoTreinamentoNome={modalEncerrar.cargo_treinamento_nome}
              integranteNome={modalEncerrar.integrante_nome_colete}
              onConfirm={handleEncerrar}
              loading={operando}
            />
          )}
        </>
      )}
    </div>
  );
}
