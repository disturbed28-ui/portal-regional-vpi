import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RelatorioSemanalDetalheDialogProps {
  open: boolean;
  onClose: () => void;
  divisaoId: string;
  ano: number;
  mes: number;
  semana: number;
}

const formatarData = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '—';
  try {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
  } catch {
    return '—';
  }
};

const formatarDataHora = (isoStr: string | null | undefined): string => {
  if (!isoStr) return '—';
  try {
    const date = new Date(isoStr);
    return date.toLocaleString('pt-BR');
  } catch {
    return '—';
  }
};

export const RelatorioSemanalDetalheDialog = ({
  open,
  onClose,
  divisaoId,
  ano,
  mes,
  semana
}: RelatorioSemanalDetalheDialogProps) => {
  const [relatorio, setRelatorio] = useState<any>(null);
  const [divisao, setDivisao] = useState<any>(null);
  const [regional, setRegional] = useState<any>(null);
  const [grauResponsavel, setGrauResponsavel] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open || !divisaoId) return;
    buscarRelatorio();
  }, [open, divisaoId, ano, mes, semana]);

  const buscarRelatorio = async () => {
    setLoading(true);
    setError(false);

    try {
      // 1. Buscar relatório (mais recente se houver múltiplos)
      const { data: relatorios, error: relError } = await supabase
        .from('relatorios_semanais_divisao')
        .select('*')
        .eq('divisao_relatorio_id', divisaoId)
        .eq('ano_referencia', ano)
        .eq('mes_referencia', mes)
        .eq('semana_no_mes', semana)
        .order('created_at', { ascending: false })
        .limit(1);

      if (relError || !relatorios || relatorios.length === 0) {
        setError(true);
        setLoading(false);
        return;
      }

      const rel = relatorios[0];
      setRelatorio(rel);

      // 2. Buscar divisão por ID
      const { data: div } = await supabase
        .from('divisoes')
        .select('id, nome, regional_id')
        .eq('id', divisaoId)
        .single();
      setDivisao(div);

      // 3. Buscar regional por ID
      if (rel.regional_relatorio_id) {
        const { data: reg } = await supabase
          .from('regionais')
          .select('id, nome')
          .eq('id', rel.regional_relatorio_id)
          .single();
        setRegional(reg);
      }

      // 4. Buscar grau do responsável via integrante_portal_id
      if (rel.integrante_portal_id) {
        const { data: integrante } = await supabase
          .from('integrantes_portal')
          .select('cargo_grau_texto')
          .eq('id', rel.integrante_portal_id)
          .single();

        if (integrante?.cargo_grau_texto) {
          // Extrair grau do formato "Diretor Regional (Grau V)"
          const match = integrante.cargo_grau_texto.match(/\(Grau\s+(\w+)\)/);
          setGrauResponsavel(match ? match[1] : '');
        }
      }
    } catch (err) {
      console.error('Erro ao buscar relatório:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] sm:max-h-[85vh] p-0">
        <ScrollArea className="h-full max-h-[90vh] sm:max-h-[85vh]">
          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : error || !relatorio ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">
                  Não foi possível carregar o relatório.
                </p>
                <Button onClick={onClose}>Fechar</Button>
              </div>
            ) : (
              <>
                <DialogHeader className="space-y-2 border-b pb-4 mb-6">
                  <div className="flex items-start justify-between">
                    <DialogTitle className="text-lg">
                      Relatório Semanal – {divisao?.nome || relatorio.divisao_relatorio_texto}
                    </DialogTitle>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={onClose}
                      className="h-6 w-6 rounded-full"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="text-sm text-muted-foreground">
                    Regional: {regional?.nome || relatorio.regional_relatorio_texto}
                  </div>

                  <div className="text-sm">
                    Semana {relatorio.semana_no_mes} – {formatarData(relatorio.semana_inicio)} até {formatarData(relatorio.semana_fim)}
                  </div>

                  <div className="text-sm">
                    Preenchido por: {relatorio.responsavel_nome_colete}
                  </div>

                  <div className="text-sm">
                    Cargo: {relatorio.responsavel_cargo_nome || '—'}
                  </div>

                  {grauResponsavel && (
                    <div className="text-sm">
                      Grau: {grauResponsavel}
                    </div>
                  )}

                  <div className="text-sm text-muted-foreground">
                    Data/Hora de envio: {formatarDataHora(relatorio.created_at)}
                  </div>
                </DialogHeader>

                <div className="space-y-6">
                  {/* Seção Entradas */}
                  <Card>
                    <CardContent className="p-4">
                      <h4 className="font-semibold mb-3 text-base">Entradas de Integrantes</h4>
                      {relatorio.entradas_json && Array.isArray(relatorio.entradas_json) && relatorio.entradas_json.length > 0 ? (
                        <div className="space-y-3">
                          {relatorio.entradas_json.map((entrada: any, idx: number) => (
                            <div key={idx} className="border-b last:border-0 pb-3 last:pb-0">
                              <p className="text-sm"><strong>Nome:</strong> {entrada.nome_colete}</p>
                              <p className="text-sm"><strong>Data:</strong> {formatarData(entrada.data_entrada)}</p>
                              <p className="text-sm"><strong>Motivo:</strong> {entrada.motivo_entrada}</p>
                              <p className="text-sm">
                                <strong>Veículos:</strong>{' '}
                                {[
                                  entrada.possui_carro && 'Carro',
                                  entrada.possui_moto && 'Moto',
                                  entrada.nenhum && 'Nenhum'
                                ].filter(Boolean).join(', ') || '—'}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Nenhuma entrada nesta semana</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Seção Saídas */}
                  <Card>
                    <CardContent className="p-4">
                      <h4 className="font-semibold mb-3 text-base">Saídas de Integrantes</h4>
                      {relatorio.saidas_json && Array.isArray(relatorio.saidas_json) && relatorio.saidas_json.length > 0 ? (
                        <div className="space-y-3">
                          {relatorio.saidas_json.map((saida: any, idx: number) => (
                            <div key={idx} className="border-b last:border-0 pb-3 last:pb-0">
                              <p className="text-sm"><strong>Nome:</strong> {saida.nome_colete}</p>
                              <p className="text-sm"><strong>Data:</strong> {formatarData(saida.data_saida)}</p>
                              <p className="text-sm"><strong>Motivo:</strong> {saida.motivo_codigo}</p>
                              {saida.justificativa && (
                                <p className="text-sm"><strong>Justificativa:</strong> {saida.justificativa}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Nenhuma saída nesta semana</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Seção Inadimplência */}
                  <Card>
                    <CardContent className="p-4">
                      <h4 className="font-semibold mb-3 text-base">Inadimplência</h4>
                      {relatorio.inadimplencias_json && Array.isArray(relatorio.inadimplencias_json) && relatorio.inadimplencias_json.length > 0 ? (
                        <div className="space-y-3">
                          {relatorio.inadimplencias_json.map((inad: any, idx: number) => (
                            <div key={idx} className="border-b last:border-0 pb-3 last:pb-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-sm font-medium">{inad.nome_colete}</p>
                                <Badge variant={inad.status === 'removido' ? 'secondary' : 'destructive'}>
                                  {inad.status}
                                </Badge>
                              </div>
                              {inad.acao_cobranca && (
                                <p className="text-sm"><strong>Ação de cobrança:</strong> {inad.acao_cobranca}</p>
                              )}
                              {inad.justificativa_remocao && (
                                <p className="text-sm"><strong>Justificativa:</strong> {inad.justificativa_remocao}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Nenhum registro de inadimplência</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Seção Conflitos */}
                  <Card>
                    <CardContent className="p-4">
                      <h4 className="font-semibold mb-3 text-base">Conflitos</h4>
                      {relatorio.conflitos_json && Array.isArray(relatorio.conflitos_json) && relatorio.conflitos_json.length > 0 ? (
                        <div className="space-y-3">
                          {relatorio.conflitos_json.map((conflito: any, idx: number) => (
                            <div key={idx} className="border-b last:border-0 pb-3 last:pb-0">
                              <p className="text-sm"><strong>Data:</strong> {formatarData(conflito.data_ocorrencia)}</p>
                              <p className="text-sm whitespace-pre-wrap">{conflito.descricao}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Nenhum conflito registrado</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Seção Ações Sociais */}
                  <Card>
                    <CardContent className="p-4">
                      <h4 className="font-semibold mb-3 text-base">Ações Sociais</h4>
                      {relatorio.acoes_sociais_json && Array.isArray(relatorio.acoes_sociais_json) && relatorio.acoes_sociais_json.length > 0 ? (
                        <div className="space-y-3">
                          {relatorio.acoes_sociais_json.map((acao: any, idx: number) => (
                            <div key={idx} className="border-b last:border-0 pb-3 last:pb-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-sm font-medium">{acao.titulo || 'Sem título'}</p>
                                {acao.status && (
                                  <Badge variant="outline">{acao.status}</Badge>
                                )}
                              </div>
                              {acao.descricao && (
                                <p className="text-sm text-muted-foreground mb-1 whitespace-pre-wrap">
                                  {acao.descricao}
                                </p>
                              )}
                              <p className="text-sm"><strong>Data:</strong> {formatarData(acao.data_acao)}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Nenhuma ação social registrada</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Seção Estatísticas */}
                  <Card>
                    <CardContent className="p-4">
                      <h4 className="font-semibold mb-3 text-base">Estatísticas da Divisão</h4>
                        {relatorio.estatisticas_divisao_json ? (
                        <div className="space-y-3">
                          {/* Estatísticas Gerais - Novos campos ou Fallback para relatórios antigos */}
                          {relatorio.estatisticas_divisao_json.total_integrantes !== undefined ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              <div className="p-3 border rounded-lg">
                                <p className="text-xs text-muted-foreground">Total de Integrantes</p>
                                <p className="text-lg font-semibold">{relatorio.estatisticas_divisao_json.total_integrantes || 0}</p>
                              </div>
                              <div className="p-3 border rounded-lg">
                                <p className="text-xs text-muted-foreground">Total Aptos</p>
                                <p className="text-lg font-semibold">{relatorio.estatisticas_divisao_json.total_aptos || 0}</p>
                              </div>
                              <div className="p-3 border rounded-lg">
                                <p className="text-xs text-muted-foreground">Total Estagiários</p>
                                <p className="text-lg font-semibold">{relatorio.estatisticas_divisao_json.total_estagiarios || 0}</p>
                              </div>
                              <div className="p-3 border rounded-lg">
                                <p className="text-xs text-muted-foreground">Total Afastados</p>
                                <p className="text-lg font-semibold">{relatorio.estatisticas_divisao_json.total_afastados || 0}</p>
                              </div>
                              <div className="p-3 border rounded-lg">
                                <p className="text-xs text-muted-foreground">Devedores</p>
                                <p className="text-lg font-semibold">{relatorio.estatisticas_divisao_json.total_devedores || 0}</p>
                              </div>
                              <div className="p-3 border rounded-lg">
                                <p className="text-xs text-muted-foreground">Veículos Disponíveis</p>
                                <p className="text-lg font-semibold">{relatorio.estatisticas_divisao_json.total_veiculos || 0}</p>
                              </div>
                            </div>
                          ) : (
                            /* Fallback para relatórios antigos */
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              <div className="p-3 border rounded-lg">
                                <p className="text-xs text-muted-foreground">Possuem Moto</p>
                                <p className="text-lg font-semibold">{relatorio.estatisticas_divisao_json.total_tem_moto || 0}</p>
                              </div>
                              <div className="p-3 border rounded-lg">
                                <p className="text-xs text-muted-foreground">Possuem Carro</p>
                                <p className="text-lg font-semibold">{relatorio.estatisticas_divisao_json.total_tem_carro || 0}</p>
                              </div>
                              <div className="p-3 border rounded-lg">
                                <p className="text-xs text-muted-foreground">Sem Veículo</p>
                                <p className="text-lg font-semibold">{relatorio.estatisticas_divisao_json.total_sem_veiculo || 0}</p>
                              </div>
                            </div>
                          )}

                          {/* Estatísticas Detalhadas (se existirem) */}
                          {(relatorio.estatisticas_divisao_json.total_caveiras > 0 ||
                            relatorio.estatisticas_divisao_json.total_suplentes_caveira > 0 ||
                            relatorio.estatisticas_divisao_json.total_batedores > 0 ||
                            relatorio.estatisticas_divisao_json.total_lobos > 0 ||
                            relatorio.estatisticas_divisao_json.total_ursos > 0 ||
                            relatorio.estatisticas_divisao_json.total_combate_insano > 0) && (
                            <>
                              <Separator className="my-4" />
                              <p className="text-sm font-medium mb-2">Detalhes Especiais:</p>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                                {relatorio.estatisticas_divisao_json.total_caveiras > 0 && (
                                  <div className="p-2 bg-secondary border border-border rounded">
                                    <span className="text-muted-foreground">Caveiras:</span>{' '}
                                    <span className="font-semibold text-foreground">{relatorio.estatisticas_divisao_json.total_caveiras}</span>
                                  </div>
                                )}
                                {relatorio.estatisticas_divisao_json.total_suplentes_caveira > 0 && (
                                  <div className="p-2 bg-secondary border border-border rounded">
                                    <span className="text-muted-foreground">Suplentes:</span>{' '}
                                    <span className="font-semibold text-foreground">{relatorio.estatisticas_divisao_json.total_suplentes_caveira}</span>
                                  </div>
                                )}
                                {relatorio.estatisticas_divisao_json.total_batedores > 0 && (
                                  <div className="p-2 bg-secondary border border-border rounded">
                                    <span className="text-muted-foreground">Batedores:</span>{' '}
                                    <span className="font-semibold text-foreground">{relatorio.estatisticas_divisao_json.total_batedores}</span>
                                  </div>
                                )}
                                {relatorio.estatisticas_divisao_json.total_lobos > 0 && (
                                  <div className="p-2 bg-secondary border border-border rounded">
                                    <span className="text-muted-foreground">Lobos:</span>{' '}
                                    <span className="font-semibold text-foreground">{relatorio.estatisticas_divisao_json.total_lobos}</span>
                                  </div>
                                )}
                                {relatorio.estatisticas_divisao_json.total_ursos > 0 && (
                                  <div className="p-2 bg-secondary border border-border rounded">
                                    <span className="text-muted-foreground">Ursos:</span>{' '}
                                    <span className="font-semibold text-foreground">{relatorio.estatisticas_divisao_json.total_ursos}</span>
                                  </div>
                                )}
                                {relatorio.estatisticas_divisao_json.total_combate_insano > 0 && (
                                  <div className="p-2 bg-secondary border border-border rounded">
                                    <span className="text-muted-foreground">C. Insano:</span>{' '}
                                    <span className="font-semibold text-foreground">{relatorio.estatisticas_divisao_json.total_combate_insano}</span>
                                  </div>
                                )}
                              </div>
                            </>
                          )}

                          {/* Lista de Estagiários */}
                          {((relatorio.estatisticas_divisao_json.estagiarios && 
                            Array.isArray(relatorio.estatisticas_divisao_json.estagiarios) && 
                            relatorio.estatisticas_divisao_json.estagiarios.length > 0) ||
                           (relatorio.estatisticas_divisao_json.estagio && 
                            Array.isArray(relatorio.estatisticas_divisao_json.estagio) && 
                            relatorio.estatisticas_divisao_json.estagio.length > 0)) && (
                            <>
                              <Separator className="my-4" />
                              <div>
                                <p className="text-sm font-medium mb-2">Lista de Estagiários:</p>
                                <ul className="text-sm space-y-1 list-disc list-inside">
                                  {(relatorio.estatisticas_divisao_json.estagiarios || relatorio.estatisticas_divisao_json.estagio || []).map((est: any, idx: number) => (
                                    <li key={idx}>{est.nome_colete} - {est.estagio || est.cargo_estagio || 'Estagiário'}</li>
                                  ))}
                                </ul>
                              </div>
                            </>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Nenhuma estatística registrada</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
