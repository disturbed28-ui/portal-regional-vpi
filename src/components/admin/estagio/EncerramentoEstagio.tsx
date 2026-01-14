import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, User, Building2, MapPin, Briefcase, GraduationCap, Calendar, Clock, XCircle, CheckCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useEncerramentoEstagio, EstagioEncerramento } from '@/hooks/useEncerramentoEstagio';
import { ModalCancelarSolicitacao } from '@/components/admin/treinamento/ModalCancelarSolicitacao';
import { ModalEncerrarEstagio } from './ModalEncerrarEstagio';
import { ReadOnlyBanner } from '@/components/ui/read-only-banner';
import { supabase } from '@/integrations/supabase/client';

interface EncerramentoEstagioProps {
  userId: string | undefined;
  readOnly?: boolean;
}

interface DadosUsuario {
  id: string | null;
  nome: string;
  cargo: string | null;
  divisao: string | null;
}

export function EncerramentoEstagio({ userId, readOnly = false }: EncerramentoEstagioProps) {
  const { estagios, loading, operando, cancelarSolicitacao, encerrarEstagio } = useEncerramentoEstagio(userId);
  
  const [modalCancelar, setModalCancelar] = useState<EstagioEncerramento | null>(null);
  const [modalEncerrar, setModalEncerrar] = useState<EstagioEncerramento | null>(null);
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
    
    const success = await encerrarEstagio({
      solicitacaoId: modalEncerrar.id,
      integranteId: modalEncerrar.integrante_id,
      cargoEstagioId: modalEncerrar.cargo_estagio_id,
      grauEstagio: modalEncerrar.grau_estagio,
      tipoEncerramento,
      observacoes,
      encerradoPor: dadosUsuario,
      dataInicio: modalEncerrar.data_inicio_estagio
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

  if (estagios.length === 0) {
    return (
      <div className="space-y-4">
        {readOnly && <ReadOnlyBanner />}
        <Card className="border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <CheckCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Nenhum estágio ativo</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Não há estágios em andamento ou solicitações pendentes para gerenciar.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {readOnly && <ReadOnlyBanner />}
      
      {estagios.map((e) => (
        <Card key={e.id} className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-primary" />
                {e.cargo_estagio_nome}
                {e.grau_estagio && (
                  <Badge variant="outline" className="text-xs">
                    Grau {e.grau_estagio}
                  </Badge>
                )}
              </CardTitle>
              <Badge 
                variant={e.status === 'Em Aprovacao' ? 'secondary' : 'default'}
                className={e.status === 'Em Estagio' ? 'bg-fuchsia-600 hover:bg-fuchsia-700' : ''}
              >
                {e.status === 'Em Aprovacao' ? 'Em Aprovação' : e.status === 'Em Estagio' ? 'Em Estágio' : e.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Dados do Integrante */}
            <div className="grid gap-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="h-4 w-4 shrink-0" />
                <span>Integrante:</span>
                <span className="text-foreground font-medium">{e.integrante_nome_colete}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="h-4 w-4 shrink-0" />
                <span>Divisão:</span>
                <span className="text-foreground">{e.integrante_divisao_texto}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0" />
                <span>Regional:</span>
                <span className="text-foreground">{e.integrante_regional_texto}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Briefcase className="h-4 w-4 shrink-0" />
                <span>Cargo Atual:</span>
                <span className="text-foreground">{e.integrante_cargo_atual}</span>
              </div>
            </div>

            {/* Dados do Estágio */}
            {e.status === 'Em Estagio' && (
              <div className="grid gap-2 text-sm border-t pt-3">
                {e.data_inicio_estagio && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4 shrink-0" />
                    <span>Data Início:</span>
                    <span className="text-foreground">
                      {format(parseISO(e.data_inicio_estagio), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4 shrink-0" />
                  <span>SLA:</span>
                  <span className="text-foreground">{e.tempo_estagio_meses} meses</span>
                </div>
                {e.data_termino_previsto && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4 shrink-0" />
                    <span>Término Previsto:</span>
                    <span className="text-foreground">
                      {format(parseISO(e.data_termino_previsto), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Ações - só aparecem se NÃO for readOnly */}
            {!readOnly && (
              <div className="flex gap-2 pt-2 border-t">
                {e.status === 'Em Aprovacao' && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setModalCancelar(e)}
                    disabled={operando}
                    className="flex-1"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancelar Solicitação
                  </Button>
                )}
                {e.status === 'Em Estagio' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setModalEncerrar(e)}
                    disabled={operando}
                    className="flex-1"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Encerrar Estágio
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
              cargoTreinamentoNome={modalCancelar.cargo_estagio_nome}
              integranteNome={modalCancelar.integrante_nome_colete}
              onConfirm={handleCancelar}
              loading={operando}
            />
          )}

          {modalEncerrar && (
            <ModalEncerrarEstagio
              open={!!modalEncerrar}
              onOpenChange={(open) => !open && setModalEncerrar(null)}
              cargoEstagioNome={modalEncerrar.cargo_estagio_nome}
              grauEstagio={modalEncerrar.grau_estagio}
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
