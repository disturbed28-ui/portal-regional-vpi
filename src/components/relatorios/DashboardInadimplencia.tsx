import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { useInadimplenciaFiltrada } from '@/hooks/useInadimplenciaFiltrada';
import { AlertTriangle, Users, DollarSign, ChevronDown, CheckCircle, Loader2 } from 'lucide-react';
import { ReadOnlyBanner } from '@/components/ui/read-only-banner';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useProfile } from '@/hooks/useProfile';
import { useWhatsAppTemplates } from '@/hooks/useWhatsAppTemplates';
import {
  useDiretoresDivisaoRegional,
  useTelefonesIntegrantes,
} from '@/hooks/useContatosInadimplencia';
import { BotaoEnviarWhatsApp } from '@/components/whatsapp/BotaoEnviarWhatsApp';
import { renderTemplate } from '@/lib/whatsapp';
import { normalizeText } from '@/lib/normalizeText';

interface DashboardInadimplenciaProps {
  userId: string | undefined;
  readOnly?: boolean;
}

export const DashboardInadimplencia = ({ userId, readOnly = false }: DashboardInadimplenciaProps) => {
  const { ultimaCargaInfo, devedoresAtivos, devedoresCronicos, nivelAcesso } = useInadimplenciaFiltrada(userId);
  const { profile } = useProfile(userId);
  const [liquidando, setLiquidando] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // === WhatsApp / Cobrança ===
  const { data: templates } = useWhatsAppTemplates();
  const tplDivisao = (templates ?? []).find((t) => t.chave === 'mensalidade_adm_divisao');
  const tplIntegrante = (templates ?? []).find((t) => t.chave === 'mensalidade_integrante');

  // Para Grau V (regional): contatos dos diretores das divisões da regional
  const { diretores } = useDiretoresDivisaoRegional(
    nivelAcesso === 'regional' ? profile?.regional_id ?? null : null,
  );
  const diretorPorDivisao = useMemo(() => {
    const map: Record<string, typeof diretores[number]> = {};
    diretores.forEach((d) => {
      map[normalizeText(d.divisao_nome)] = d;
    });
    return map;
  }, [diretores]);

  // Para Grau VI (divisão): telefone direto dos devedores da própria divisão
  const registroIdsVisiveis = useMemo(
    () => devedoresAtivos.map((d) => d.registro_id).filter((v): v is number => Boolean(v)),
    [devedoresAtivos],
  );
  const { contatos: contatosIntegrantes } = useTelefonesIntegrantes(
    nivelAcesso === 'divisao' ? registroIdsVisiveis : [],
  );

  // Calcular totais a partir da view vw_devedores_ativos
  const totalDevedores = devedoresAtivos.length;
  const totalDebito = devedoresAtivos.reduce((sum, d) => sum + (d.total_devido || 0), 0);
  const totalCronicos = devedoresCronicos.length;

  const handleLiquidarManual = async (registroId: number, nomeColete: string) => {
    if (readOnly) return;
    setLiquidando(String(registroId));
    try {
      // Buscar e atualizar todos os registros deste devedor pelo registro_id
      const { data, error } = await supabase
        .from('mensalidades_atraso')
        .update({ 
          ativo: false, 
          liquidado: true, 
          data_liquidacao: new Date().toISOString() 
        })
        .eq('registro_id', registroId)
        .eq('ativo', true)
        .select();
      
      if (error) throw error;
      
      // Verificar se realmente atualizou algo
      if (!data || data.length === 0) {
        toast({ 
          title: "Nenhum registro atualizado", 
          description: "Verifique suas permissões ou se o registro já foi baixado.", 
          variant: "destructive" 
        });
        return;
      }
      
      toast({ 
        title: "Baixa realizada", 
        description: `${nomeColete} marcado como liquidado (${data.length} registro${data.length > 1 ? 's' : ''})` 
      });
      queryClient.invalidateQueries({ queryKey: ['mensalidades-devedores-ativos'] });
      queryClient.invalidateQueries({ queryKey: ['mensalidades-devedores-cronicos'] });
    } catch (error) {
      console.error('Erro ao dar baixa:', error);
      toast({ 
        title: "Erro", 
        description: "Falha ao dar baixa. Verifique suas permissões.", 
        variant: "destructive" 
      });
    } finally {
      setLiquidando(null);
    }
  };

  return (
    <div className="space-y-3 sm:space-y-6">
      {/* Banner de somente leitura */}
      {readOnly && <ReadOnlyBanner className="mb-4" />}

      {/* Cards: Devedores, Total, Crônicos (removido Média) */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {/* Total Devedores */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 px-3 sm:px-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Devedores</CardTitle>
            <Users className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="text-xl sm:text-2xl font-bold text-orange-600">{totalDevedores}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">com débitos</p>
          </CardContent>
        </Card>

        {/* Total Débitos */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 px-3 sm:px-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Total</CardTitle>
            <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="text-lg sm:text-2xl font-bold text-red-600">
              R$ {totalDebito.toFixed(2)}
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">em atraso</p>
          </CardContent>
        </Card>

        {/* Devedores Crônicos */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 px-3 sm:px-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Crônicos</CardTitle>
            <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="text-xl sm:text-2xl font-bold text-red-700">{totalCronicos}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">3+ meses</p>
          </CardContent>
        </Card>
      </div>

      {/* Top 10 Devedores Crônicos - sem valores monetários */}
      <Card>
        <CardHeader className="px-3 sm:px-6 py-3 sm:py-6">
          <CardTitle className="text-base sm:text-lg">Top 10 Devedores Crônicos</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Integrantes que deveram em 3 ou mais meses diferentes
          </CardDescription>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          <div className="space-y-2 sm:space-y-3">
            {devedoresCronicos.slice(0, 10).map((devedor, index) => (
              <div 
                key={devedor.registro_id}
                className="flex items-center justify-between p-2 sm:p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <Badge variant="destructive" className="text-sm sm:text-lg font-bold w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center flex-shrink-0">
                    {index + 1}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-xs sm:text-sm text-foreground truncate">{devedor.nome_colete}</p>
                    <p className="text-[10px] sm:text-sm text-foreground/80 truncate">{devedor.divisao_texto}</p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-red-600 text-xs sm:text-base">
                    {devedor.total_meses_historico} {devedor.total_meses_historico === 1 ? 'mês' : 'meses'}
                  </p>
                </div>
              </div>
            ))}
            {devedoresCronicos.length === 0 && (
              <p className="text-center text-muted-foreground py-6 sm:py-8 text-xs sm:text-sm">
                Nenhum devedor crônico identificado
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Devedores Ativos por Divisão */}
      <Card>
        <CardHeader className="px-3 sm:px-6 py-3 sm:py-6">
          <CardTitle className="text-base sm:text-lg">Distribuição por Divisão</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Quantidade de devedores ativos em cada divisão
          </CardDescription>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          <div className="space-y-2">
            {(() => {
              // Agrupar devedores por divisão mantendo os objetos completos
              const devedoresPorDivisao = devedoresAtivos.reduce((acc, devedor) => {
                const divisao = devedor.divisao_texto;
                if (!acc[divisao]) {
                  acc[divisao] = [];
                }
                acc[divisao].push(devedor);
                return acc;
              }, {} as Record<string, typeof devedoresAtivos>);

              return Object.entries(devedoresPorDivisao)
                .sort((a, b) => b[1].length - a[1].length)
                .map(([divisao, devedores]) => {
                  const totalDivisao = devedores.reduce((s, d) => s + (d.total_devido || 0), 0);
                  const diretor = nivelAcesso === 'regional'
                    ? diretorPorDivisao[normalizeText(divisao)]
                    : null;
                  const listaDevedoresTxt = devedores
                    .slice()
                    .sort((a, b) => (b.meses_devendo ?? 0) - (a.meses_devendo ?? 0))
                    .map((d) => {
                      const meses = d.meses_devendo ?? d.total_parcelas ?? 0;
                      const sufixo = meses === 1 ? 'mês' : 'meses';
                      const valor = (d.total_devido ?? 0).toFixed(2).replace('.', ',');
                      const nome = d.nome_colete || `Registro ${d.registro_id}`;
                      return `• ${nome} — ${meses} ${sufixo} (R$ ${valor})`;
                    })
                    .join('\n');
                  if (typeof window !== 'undefined') {
                    console.debug('[inadimplencia-wa]', divisao, {
                      qtd: devedores.length,
                      lista: listaDevedoresTxt,
                    });
                  }
                  const msgDivisao = diretor && tplDivisao
                    ? renderTemplate(tplDivisao.corpo, {
                        nome: diretor.diretor_nome ?? 'diretor(a)',
                        divisao,
                        qtd_devedores: devedores.length,
                        valor_total: totalDivisao.toFixed(2).replace('.', ','),
                        lista_devedores: listaDevedoresTxt || '(lista indisponível)',
                      })
                    : '';
                  return (
                  <Collapsible key={divisao}>
                    <div className="border rounded-lg overflow-hidden">
                      <div className="flex items-center gap-1 border-l-4 border-orange-500 hover:bg-muted/50 transition-colors">
                        <CollapsibleTrigger className="flex-1 min-w-0 text-left">
                          <div className="flex items-center justify-between p-2 sm:p-3 gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 transition-transform data-[state=open]:rotate-180 flex-shrink-0" />
                              <span className="text-xs sm:text-sm font-medium truncate">{divisao}</span>
                            </div>
                            <Badge variant="secondary" className="text-[10px] sm:text-xs flex-shrink-0">
                              {devedores.length}
                            </Badge>
                          </div>
                        </CollapsibleTrigger>
                        {!readOnly && nivelAcesso === 'regional' && tplDivisao && (
                          <div className="pr-2 flex-shrink-0">
                            <BotaoEnviarWhatsApp
                              telefone={diretor?.diretor_telefone ?? null}
                              destinatarioNome={diretor?.diretor_nome ?? divisao}
                              destinatarioProfileId={diretor?.diretor_profile_id ?? null}
                              mensagem={msgDivisao}
                              templateChave="mensalidade_adm_divisao"
                              templateTitulo={tplDivisao.titulo ?? null}
                              moduloOrigem="relatorios-inadimplencia"
                              regionalId={profile?.regional_id ?? null}
                              divisaoId={diretor?.divisao_id ?? null}
                              payload={{
                                divisao,
                                qtd_devedores: devedores.length,
                                valor_total: totalDivisao,
                              }}
                              label=""
                              size="sm"
                              variant="outline"
                              className="h-7 px-2"
                            />
                          </div>
                        )}
                      </div>

                      <CollapsibleContent>
                        <div className="px-2 sm:px-4 py-2 sm:py-3 space-y-2 bg-muted/20 border-t">
                          {devedores.map((devedor) => {
                            const contato = contatosIntegrantes[devedor.registro_id];
                            const diasAtraso = devedor.ultimo_vencimento
                              ? Math.max(
                                  0,
                                  Math.floor(
                                    (Date.now() - new Date(devedor.ultimo_vencimento).getTime()) /
                                      (1000 * 60 * 60 * 24),
                                  ),
                                )
                              : 0;
                            const msgIntegrante = tplIntegrante
                              ? renderTemplate(tplIntegrante.corpo, {
                                  nome: devedor.nome_colete,
                                  qtd_parcelas: devedor.total_parcelas ?? devedor.meses_devendo ?? 0,
                                  valor_total: (devedor.total_devido ?? 0)
                                    .toFixed(2)
                                    .replace('.', ','),
                                  dias_atraso: diasAtraso,
                                })
                              : '';
                            return (
                            <div
                              key={devedor.registro_id}
                              className="flex items-center justify-between p-2 bg-background rounded border gap-2"
                            >
                              <div className="flex flex-col min-w-0 flex-1">
                                <span className="font-medium text-xs sm:text-sm text-foreground truncate">{devedor.nome_colete}</span>
                                <span className="font-mono text-[10px] sm:text-xs text-muted-foreground">
                                  ID: {devedor.registro_id}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="text-right flex-shrink-0">
                                  <div className="text-xs sm:text-sm font-semibold text-red-600">
                                    R$ {devedor.total_devido?.toFixed(2)}
                                  </div>
                                  <div className="text-[10px] sm:text-xs font-medium text-foreground/70">
                                    {devedor.meses_devendo}m
                                  </div>
                                </div>
                                {!readOnly && nivelAcesso === 'divisao' && tplIntegrante && (
                                  <BotaoEnviarWhatsApp
                                    telefone={contato?.telefone ?? null}
                                    destinatarioNome={devedor.nome_colete}
                                    destinatarioProfileId={contato?.profile_id ?? null}
                                    mensagem={msgIntegrante}
                                    templateChave="mensalidade_integrante"
                                    templateTitulo={tplIntegrante.titulo ?? null}
                                    moduloOrigem="relatorios-inadimplencia"
                                    regionalId={profile?.regional_id ?? null}
                                    divisaoId={profile?.divisao_id ?? null}
                                    payload={{
                                      registro_id: devedor.registro_id,
                                      qtd_parcelas: devedor.total_parcelas,
                                      valor_total: devedor.total_devido,
                                      dias_atraso: diasAtraso,
                                    }}
                                    label=""
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2"
                                  />
                                )}
                                {!readOnly && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleLiquidarManual(devedor.registro_id, devedor.nome_colete)}
                                    disabled={liquidando === String(devedor.registro_id)}
                                    className="h-7 px-2 text-xs flex-shrink-0"
                                  >
                                    {liquidando === String(devedor.registro_id) ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <>
                                        <CheckCircle className="h-3 w-3 mr-1" />
                                        Baixa
                                      </>
                                    )}
                                  </Button>
                                )}
                              </div>
                            </div>
                            );
                          })}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                  );
                });
            })()}
            {devedoresAtivos.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                Nenhum devedor ativo no momento
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
