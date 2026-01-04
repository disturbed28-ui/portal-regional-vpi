import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { GraduationCap, Search, Loader2, Send, X, CalendarIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useBuscaIntegranteTodos } from '@/hooks/useIntegrantes';
import { useCargosGrau6 } from '@/hooks/useCargosGrau6';
import { useSolicitacaoTreinamento } from '@/hooks/useSolicitacaoTreinamento';
import { useProfile } from '@/hooks/useProfile';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { IntegranteTreinamentoCard } from './IntegranteTreinamentoCard';
import { ModalEncerrarTreinamento } from './ModalEncerrarTreinamento';
import { format, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface IntegranteSelecionado {
  id: string;
  nome_colete: string;
  cargo_grau_texto: string;
  divisao_texto: string;
  divisao_id: string | null;
  regional_id: string | null;
  cargo_treinamento_id: string | null;
}

interface SolicitacaoTreinamentoProps {
  userId: string | undefined;
}

export function SolicitacaoTreinamento({ userId }: SolicitacaoTreinamentoProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [integranteSelecionado, setIntegranteSelecionado] = useState<IntegranteSelecionado | null>(null);
  const [cargoTreinamentoId, setCargoTreinamentoId] = useState<string>('');
  const [cargoTreinamentoNome, setCargoTreinamentoNome] = useState<string | null>(null);
  const [showEncerrarModal, setShowEncerrarModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<'verificar' | 'criar' | null>(null);
  const [dataInicioTreinamento, setDataInicioTreinamento] = useState<Date | undefined>(new Date());

  const { getSettingTextValue, updateSettingText } = useSystemSettings();
  const tempoTreinamentoPadrao = getSettingTextValue('tempo_treinamento_padrao') || '3';
  const [tempoTreinamentoMeses, setTempoTreinamentoMeses] = useState<string>(tempoTreinamentoPadrao);

  const { resultados: integrantes, loading: buscando } = useBuscaIntegranteTodos(searchTerm);
  const { cargos: cargosGrau6, loading: loadingCargos } = useCargosGrau6();
  const { profile } = useProfile(userId);
  const {
    loading: processando,
    verificarTreinamentoAtivo,
    encerrarTreinamento,
    createSolicitacao
  } = useSolicitacaoTreinamento();

  async function handleSelectIntegrante(integrante: IntegranteSelecionado) {
    setSearchTerm('');
    setIntegranteSelecionado(integrante);
    setCargoTreinamentoId('');

    // Verificar se está em treinamento
    const { emTreinamento, cargoTreinamentoNome: nome } = await verificarTreinamentoAtivo(integrante.id);
    
    if (emTreinamento) {
      setCargoTreinamentoNome(nome);
      // Atualizar o integrante com a info de treinamento
      setIntegranteSelecionado({
        ...integrante,
        cargo_treinamento_id: 'pending' // Marcador temporário
      });
    }
  }

  function handleLimparSelecao() {
    setIntegranteSelecionado(null);
    setCargoTreinamentoId('');
    setCargoTreinamentoNome(null);
    setSearchTerm('');
    setDataInicioTreinamento(new Date());
    // Manter tempoTreinamentoMeses - não resetar (memória)
  }

  async function handleEnviarSolicitacao() {
    if (!integranteSelecionado || !cargoTreinamentoId || !profile) return;

    // Verificar novamente se está em treinamento
    const { emTreinamento, cargoTreinamentoId: cargoAtualId, cargoTreinamentoNome: nome } = 
      await verificarTreinamentoAtivo(integranteSelecionado.id);

    if (emTreinamento && cargoAtualId) {
      setCargoTreinamentoNome(nome);
      setIntegranteSelecionado({
        ...integranteSelecionado,
        cargo_treinamento_id: cargoAtualId
      });
      setPendingAction('criar');
      setShowEncerrarModal(true);
      return;
    }

    // Criar solicitação diretamente
    await executarCriacao();
  }

async function executarCriacao() {
    if (!integranteSelecionado || !cargoTreinamentoId || !profile || !dataInicioTreinamento) return;

    // Buscar dados do integrante vinculado ao profile
    let solicitanteIntegranteId: string | null = null;
    let solicitanteNomeColete = profile.name || 'Desconhecido';

    if (profile.id) {
      const { data: integranteProfile } = await supabase
        .from('integrantes_portal')
        .select('id, nome_colete')
        .eq('profile_id', profile.id)
        .single();
      
      if (integranteProfile) {
        solicitanteIntegranteId = integranteProfile.id;
        solicitanteNomeColete = integranteProfile.nome_colete;
      }
    }

    const tempoMeses = parseInt(tempoTreinamentoMeses, 10);

    const success = await createSolicitacao({
      integrante: {
        ...integranteSelecionado,
        cargo_treinamento_id: null // Já foi limpo
      },
      cargoTreinamentoId,
      solicitante: {
        integrante_id: solicitanteIntegranteId,
        nome_colete: solicitanteNomeColete,
        cargo_id: profile.cargo_id || null,
        divisao_id: profile.divisao_id || null
      },
      dataInicioTreinamento,
      tempoTreinamentoMeses: tempoMeses
    });

    if (success) {
      // Salvar tempo selecionado como novo padrão
      await updateSettingText.mutateAsync({
        chave: 'tempo_treinamento_padrao',
        valor_texto: tempoTreinamentoMeses
      });
      handleLimparSelecao();
    }
  }

  async function handleConfirmEncerramento(tipoEncerramento: string, observacoes: string) {
    if (!integranteSelecionado?.cargo_treinamento_id || !profile) return;

    // Buscar dados do integrante vinculado ao profile para encerramento
    let encerradoPorId: string | null = null;
    let encerradoPorNome = profile.name || 'Desconhecido';

    if (profile.id) {
      const { data: integranteProfile } = await supabase
        .from('integrantes_portal')
        .select('id, nome_colete')
        .eq('profile_id', profile.id)
        .single();
      
      if (integranteProfile) {
        encerradoPorId = integranteProfile.id;
        encerradoPorNome = integranteProfile.nome_colete;
      }
    }

    const success = await encerrarTreinamento({
      integranteId: integranteSelecionado.id,
      cargoTreinamentoId: integranteSelecionado.cargo_treinamento_id,
      tipoEncerramento,
      observacoes,
      encerradoPorId,
      encerradoPorNome
    });

    if (success) {
      setShowEncerrarModal(false);
      setCargoTreinamentoNome(null);
      setIntegranteSelecionado({
        ...integranteSelecionado,
        cargo_treinamento_id: null
      });

      // Se estava tentando criar, continuar
      if (pendingAction === 'criar') {
        await executarCriacao();
      }
      setPendingAction(null);
    }
  }

  const canSubmit = integranteSelecionado && 
    cargoTreinamentoId && 
    dataInicioTreinamento &&
    tempoTreinamentoMeses &&
    !processando && 
    !integranteSelecionado.cargo_treinamento_id;

  return (
    <>
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            Nova Solicitação de Treinamento
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Busca de Integrante */}
          {!integranteSelecionado ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="busca" className="text-sm">Buscar Integrante</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="busca"
                    placeholder="Digite o nome de colete..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Resultados da busca */}
              {searchTerm.length >= 2 && (
                <div className="border border-border/50 rounded-lg overflow-hidden">
                  {buscando ? (
                    <div className="p-4 flex items-center justify-center text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Buscando...
                    </div>
                  ) : integrantes.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground text-sm">
                      Nenhum integrante encontrado
                    </div>
                  ) : (
                    <ScrollArea className="max-h-48">
                      <div className="divide-y divide-border/50">
                        {integrantes.map((int) => (
                          <button
                            key={int.id}
                            onClick={() => handleSelectIntegrante({
                              id: int.id,
                              nome_colete: int.nome_colete,
                              cargo_grau_texto: int.cargo_grau_texto,
                              divisao_texto: int.divisao_texto,
                              divisao_id: int.divisao_id,
                              regional_id: int.regional_id,
                              cargo_treinamento_id: int.cargo_treinamento_id
                            })}
                            className="w-full p-3 text-left hover:bg-muted/50 transition-colors"
                          >
                            <p className="font-medium text-sm">{int.nome_colete}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {int.divisao_texto}
                            </p>
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Integrante Selecionado */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Integrante Selecionado</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLimparSelecao}
                    className="h-7 px-2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Limpar
                  </Button>
                </div>

                <IntegranteTreinamentoCard
                  integrante={integranteSelecionado}
                  cargoTreinamentoNome={cargoTreinamentoNome}
                />

                {/* Botão de encerrar se em treinamento */}
                {integranteSelecionado.cargo_treinamento_id && (
                  <Button
                    variant="outline"
                    className="w-full border-amber-500/50 text-amber-600 hover:bg-amber-500/10"
                    onClick={() => {
                      setPendingAction('verificar');
                      setShowEncerrarModal(true);
                    }}
                  >
                    Encerrar Treinamento Anterior
                  </Button>
                )}
              </div>

              {/* Seleção de Cargo para Treinamento */}
              {!integranteSelecionado.cargo_treinamento_id && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="cargo" className="text-sm">
                      Cargo para Treinamento (Grau VI)
                    </Label>
                    <Select
                      value={cargoTreinamentoId}
                      onValueChange={setCargoTreinamentoId}
                      disabled={loadingCargos}
                    >
                      <SelectTrigger id="cargo">
                        <SelectValue placeholder="Selecione o cargo..." />
                      </SelectTrigger>
                      <SelectContent>
                        {cargosGrau6.map((cargo) => (
                          <SelectItem key={cargo.id} value={cargo.id}>
                            {cargo.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Data de Início do Treinamento */}
                  <div className="space-y-2">
                    <Label className="text-sm">Data de Início do Treinamento</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !dataInicioTreinamento && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dataInicioTreinamento 
                            ? format(dataInicioTreinamento, "dd/MM/yyyy", { locale: ptBR })
                            : "Selecione a data..."}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dataInicioTreinamento}
                          onSelect={setDataInicioTreinamento}
                          locale={ptBR}
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Tempo de Treinamento */}
                  <div className="space-y-2">
                    <Label className="text-sm">Tempo de Treinamento</Label>
                    <Select
                      value={tempoTreinamentoMeses}
                      onValueChange={setTempoTreinamentoMeses}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((meses) => (
                          <SelectItem key={meses} value={meses.toString()}>
                            {meses} {meses === 1 ? 'mês' : 'meses'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Término Previsto (calculado e exibido) */}
                  {dataInicioTreinamento && tempoTreinamentoMeses && (
                    <div className="p-3 bg-muted/50 rounded-lg text-sm">
                      <span className="text-muted-foreground">Término previsto: </span>
                      <span className="font-medium">
                        {format(addMonths(dataInicioTreinamento, parseInt(tempoTreinamentoMeses)), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    </div>
                  )}
                </>
              )}

              {/* Botão de Enviar */}
              <Button
                className="w-full"
                onClick={handleEnviarSolicitacao}
                disabled={!canSubmit}
              >
                {processando ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Enviar Solicitação
                  </>
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal de Encerramento */}
      <ModalEncerrarTreinamento
        open={showEncerrarModal}
        onOpenChange={(open) => {
          setShowEncerrarModal(open);
          if (!open) setPendingAction(null);
        }}
        cargoTreinamentoNome={cargoTreinamentoNome}
        onConfirm={handleConfirmEncerramento}
        loading={processando}
      />
    </>
  );
}
