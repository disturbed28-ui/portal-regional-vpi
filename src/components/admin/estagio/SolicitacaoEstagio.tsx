import { useState, useEffect } from 'react';
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
import { Award, Search, Loader2, Send, X, CalendarIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useBuscaIntegranteTodos } from '@/hooks/useIntegrantes';
import { useCargosGrau } from '@/hooks/useCargosGrau';
import { useSolicitacaoEstagio } from '@/hooks/useSolicitacaoEstagio';
import { useProfile } from '@/hooks/useProfile';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { IntegranteEstagioCard } from './IntegranteEstagioCard';
import { ReadOnlyBanner } from '@/components/ui/read-only-banner';
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
  cargo_estagio_id: string | null;
}

interface SolicitacaoEstagioProps {
  userId: string | undefined;
  readOnly?: boolean;
}

export function SolicitacaoEstagio({ userId, readOnly = false }: SolicitacaoEstagioProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [integranteSelecionado, setIntegranteSelecionado] = useState<IntegranteSelecionado | null>(null);
  const [grauEstagio, setGrauEstagio] = useState<'V' | 'VI' | null>(null);
  const [cargoEstagioId, setCargoEstagioId] = useState<string>('');
  const [cargoEstagioNome, setCargoEstagioNome] = useState<string | null>(null);
  const [grauEstagioAtual, setGrauEstagioAtual] = useState<string | null>(null);
  const [dataInicioEstagio, setDataInicioEstagio] = useState<Date | undefined>(new Date());

  const { getSettingTextValue, updateSettingText } = useSystemSettings();
  const tempoGrau5Padrao = getSettingTextValue('tempo_estagio_grau5_padrao') || '9';
  const tempoGrau6Padrao = getSettingTextValue('tempo_estagio_grau6_padrao') || '6';
  const [tempoEstagioMeses, setTempoEstagioMeses] = useState<string>('');

  const { resultados: integrantes, loading: buscando } = useBuscaIntegranteTodos(searchTerm);
  const { cargos: cargosGrau, loading: loadingCargos } = useCargosGrau(grauEstagio);
  const { profile } = useProfile(userId);
  const {
    loading: processando,
    verificarEstagioAtivo,
    encerrarEstagio,
    createSolicitacao
  } = useSolicitacaoEstagio();

  // Atualizar tempo padrão quando mudar o grau
  useEffect(() => {
    setCargoEstagioId(''); // Reset cargo ao mudar grau
    if (grauEstagio === 'V') {
      setTempoEstagioMeses(tempoGrau5Padrao);
    } else if (grauEstagio === 'VI') {
      setTempoEstagioMeses(tempoGrau6Padrao);
    }
  }, [grauEstagio, tempoGrau5Padrao, tempoGrau6Padrao]);

  async function handleSelectIntegrante(integrante: IntegranteSelecionado) {
    setSearchTerm('');
    setIntegranteSelecionado(integrante);
    setCargoEstagioId('');
    setGrauEstagio(null);

    // Verificar se está em estágio
    const { emEstagio, cargoEstagioNome: nome, grauEstagio: grau } = await verificarEstagioAtivo(integrante.id);
    
    if (emEstagio) {
      setCargoEstagioNome(nome);
      setGrauEstagioAtual(grau);
      // Atualizar o integrante com a info de estágio
      setIntegranteSelecionado({
        ...integrante,
        cargo_estagio_id: 'pending' // Marcador temporário
      });
    }
  }

  function handleLimparSelecao() {
    setIntegranteSelecionado(null);
    setCargoEstagioId('');
    setCargoEstagioNome(null);
    setGrauEstagioAtual(null);
    setSearchTerm('');
    setDataInicioEstagio(new Date());
    setGrauEstagio(null);
    // Não resetar tempoEstagioMeses - manter memória
  }

  async function handleEnviarSolicitacao() {
    if (!integranteSelecionado || !cargoEstagioId || !grauEstagio || !profile) return;

    // Verificar novamente se está em estágio
    const { emEstagio, cargoEstagioId: cargoAtualId, cargoEstagioNome: nome, grauEstagio: grau } = 
      await verificarEstagioAtivo(integranteSelecionado.id);

    if (emEstagio && cargoAtualId) {
      setCargoEstagioNome(nome);
      setGrauEstagioAtual(grau);
      setIntegranteSelecionado({
        ...integranteSelecionado,
        cargo_estagio_id: cargoAtualId
      });
      // Mostrar que está em estágio - usuário precisa encerrar manualmente
      return;
    }

    // Criar solicitação diretamente
    await executarCriacao();
  }

  async function executarCriacao() {
    if (!integranteSelecionado || !cargoEstagioId || !grauEstagio || !profile || !dataInicioEstagio) return;

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

    const tempoMeses = parseInt(tempoEstagioMeses, 10);

    const success = await createSolicitacao({
      integrante: {
        ...integranteSelecionado,
        cargo_estagio_id: null // Já foi limpo
      },
      cargoEstagioId,
      grauEstagio,
      solicitante: {
        integrante_id: solicitanteIntegranteId,
        nome_colete: solicitanteNomeColete,
        cargo_id: profile.cargo_id || null,
        divisao_id: profile.divisao_id || null
      },
      dataInicioEstagio,
      tempoEstagioMeses: tempoMeses
    });

    if (success) {
      // Salvar tempo selecionado como novo padrão para o grau
      const settingKey = grauEstagio === 'V' 
        ? 'tempo_estagio_grau5_padrao' 
        : 'tempo_estagio_grau6_padrao';

      await updateSettingText.mutateAsync({
        chave: settingKey,
        valor_texto: tempoEstagioMeses
      });
      
      handleLimparSelecao();
    }
  }

  async function handleEncerrarEstagio() {
    if (!integranteSelecionado?.cargo_estagio_id || !profile) return;

    // Buscar dados do integrante vinculado ao profile
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

    const success = await encerrarEstagio({
      integranteId: integranteSelecionado.id,
      cargoEstagioId: integranteSelecionado.cargo_estagio_id,
      tipoEncerramento: 'manual',
      observacoes: '',
      encerradoPorId,
      encerradoPorNome
    });

    if (success) {
      setCargoEstagioNome(null);
      setGrauEstagioAtual(null);
      setIntegranteSelecionado({
        ...integranteSelecionado,
        cargo_estagio_id: null
      });
    }
  }

  const canSubmit = integranteSelecionado && 
    grauEstagio &&
    cargoEstagioId && 
    dataInicioEstagio &&
    tempoEstagioMeses &&
    !processando && 
    !integranteSelecionado.cargo_estagio_id;

  // Se for readOnly, mostrar apenas informações sem formulário
  if (readOnly) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            Nova Solicitação de Estágio
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ReadOnlyBanner />
          <p className="text-sm text-muted-foreground text-center py-8">
            Você está em modo de visualização. Não é possível criar novas solicitações.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Award className="h-5 w-5 text-primary" />
          Nova Solicitação de Estágio
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
                            cargo_estagio_id: null // Será verificado via hook
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

              <IntegranteEstagioCard
                integrante={integranteSelecionado}
                cargoEstagioNome={cargoEstagioNome}
                grauEstagio={grauEstagioAtual}
              />

              {/* Botão de encerrar se em estágio */}
              {integranteSelecionado.cargo_estagio_id && (
                <Button
                  variant="outline"
                  className="w-full border-purple-500/50 text-purple-600 hover:bg-purple-500/10"
                  onClick={handleEncerrarEstagio}
                  disabled={processando}
                >
                  {processando ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Encerrando...
                    </>
                  ) : (
                    'Encerrar Estágio Anterior'
                  )}
                </Button>
              )}
            </div>

            {/* Formulário de Novo Estágio */}
            {!integranteSelecionado.cargo_estagio_id && (
              <>
                {/* Seletor de Tipo de Estágio */}
                <div className="space-y-2">
                  <Label className="text-sm">Tipo de Estágio</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={grauEstagio === 'V' ? 'default' : 'outline'}
                      onClick={() => setGrauEstagio('V')}
                      className="justify-center"
                    >
                      <Award className="h-4 w-4 mr-2" />
                      Estágio Grau V
                    </Button>
                    <Button
                      type="button"
                      variant={grauEstagio === 'VI' ? 'default' : 'outline'}
                      onClick={() => setGrauEstagio('VI')}
                      className="justify-center"
                    >
                      <Award className="h-4 w-4 mr-2" />
                      Estágio Grau VI
                    </Button>
                  </div>
                </div>

                {/* Seleção de Cargo (dinâmico baseado no grau) */}
                {grauEstagio && (
                  <div className="space-y-2">
                    <Label htmlFor="cargo" className="text-sm">
                      Cargo para Estágio (Grau {grauEstagio})
                    </Label>
                    <Select
                      value={cargoEstagioId}
                      onValueChange={setCargoEstagioId}
                      disabled={loadingCargos}
                    >
                      <SelectTrigger id="cargo">
                        <SelectValue placeholder="Selecione o cargo..." />
                      </SelectTrigger>
                      <SelectContent>
                        {cargosGrau.map((cargo) => (
                          <SelectItem key={cargo.id} value={cargo.id}>
                            {cargo.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Data de Início do Estágio */}
                {grauEstagio && (
                  <div className="space-y-2">
                    <Label className="text-sm">Data de Início do Estágio</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !dataInicioEstagio && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dataInicioEstagio 
                            ? format(dataInicioEstagio, "dd/MM/yyyy", { locale: ptBR })
                            : "Selecione a data..."}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dataInicioEstagio}
                          onSelect={setDataInicioEstagio}
                          locale={ptBR}
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                {/* Tempo de Estágio */}
                {grauEstagio && (
                  <div className="space-y-2">
                    <Label className="text-sm">Tempo de Estágio</Label>
                    <Select
                      value={tempoEstagioMeses}
                      onValueChange={setTempoEstagioMeses}
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
                )}

                {/* Término Previsto (calculado e exibido) */}
                {dataInicioEstagio && tempoEstagioMeses && grauEstagio && (
                  <div className="p-3 bg-muted/50 rounded-lg text-sm">
                    <span className="text-muted-foreground">Término previsto: </span>
                    <span className="font-medium">
                      {format(addMonths(dataInicioEstagio, parseInt(tempoEstagioMeses)), "dd/MM/yyyy", { locale: ptBR })}
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
  );
}
