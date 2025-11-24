import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useIntegrantes, useBuscaIntegrante } from "@/hooks/useIntegrantes";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { normalizeText, getSemanaAtual, formatDateToSQL } from "@/lib/normalizeText";
import { useSubmitRelatorioSemanal, SubmitRelatorioParams } from "@/hooks/useRelatorioSemanal";
import { useAcoesResolucaoDelta } from "@/hooks/useAcoesResolucaoDelta";

// Constante com nomes de dias da semana
const DIAS_SEMANA_NOMES = [
  'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 
  'Quinta-feira', 'Sexta-feira', 'Sábado'
];

// Componente auxiliar: Seção de Saídas
const SecaoSaidas = ({ teveSaidas, setTeveSaidas, saidas, setSaidas }: any) => {
  const { acoes } = useAcoesResolucaoDelta();
  const [buscas, setBuscas] = useState<{ [key: number]: string }>({});

  const adicionarSaida = () => {
    setSaidas([...saidas, {
      integrante_id: "",
      nome_colete: "",
      data_saida: "",
      motivo_codigo: "",
      justificativa: "",
      tem_moto: false,
      tem_carro: false
    }]);
  };

  return (
    <Card className="p-4 sm:p-6 space-y-4">
      <h3 className="font-semibold">Saída de Integrantes</h3>
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Houve saída de integrantes nesta semana?</p>
        <div className="flex gap-2">
          <Button 
            type="button"
            variant={teveSaidas ? "default" : "outline"}
            className="min-h-[44px]"
            onClick={() => setTeveSaidas(true)}
          >
            Sim
          </Button>
          <Button 
            type="button"
            variant={!teveSaidas ? "default" : "outline"}
            className="min-h-[44px]"
            onClick={() => {
              setTeveSaidas(false);
              setSaidas([]);
            }}
          >
            Não
          </Button>
        </div>
      </div>

      {teveSaidas && (
        <div className="space-y-4">
          {saidas.map((saida: any, idx: number) => (
            <ItemSaida
              key={idx}
              saida={saida}
              idx={idx}
              acoes={acoes}
              saidas={saidas}
              setSaidas={setSaidas}
              busca={buscas[idx] || ""}
              setBusca={(valor: string) => setBuscas({ ...buscas, [idx]: valor })}
            />
          ))}

          <Button
            type="button"
            variant="outline"
            className="min-h-[44px]"
            onClick={adicionarSaida}
          >
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Saída
          </Button>
        </div>
      )}
    </Card>
  );
};

// Componente auxiliar: Item de Saída
const ItemSaida = ({ saida, idx, acoes, saidas, setSaidas, busca, setBusca }: any) => {
  const { resultados } = useBuscaIntegrante(busca);
  const [mostrarResultados, setMostrarResultados] = useState(false);

  const selecionarIntegrante = (integrante: any) => {
    const novo = [...saidas];
    novo[idx].integrante_id = integrante.id;
    novo[idx].nome_colete = integrante.nome_colete;
    novo[idx].tem_moto = integrante.tem_moto;
    novo[idx].tem_carro = integrante.tem_carro;
    setSaidas(novo);
    setBusca(integrante.nome_colete);
    setMostrarResultados(false);
  };

  return (
    <Card className="p-4 space-y-3 bg-muted/50">
      <div className="flex justify-between items-start">
        <h4 className="text-sm font-medium">Saída #{idx + 1}</h4>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setSaidas(saidas.filter((_: any, i: number) => i !== idx))}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="space-y-3">
        <div className="relative">
          <label className="text-xs text-muted-foreground">Nome de Colete</label>
          <input
            type="text"
            className="w-full mt-1 p-2 border rounded bg-background"
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setMostrarResultados(true);
            }}
            onFocus={() => setMostrarResultados(true)}
            placeholder="Buscar integrante..."
          />
          {mostrarResultados && resultados.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-background border rounded shadow-lg max-h-48 overflow-auto">
              {resultados.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className="w-full text-left px-3 py-2 hover:bg-muted text-sm"
                  onClick={() => selecionarIntegrante(r)}
                >
                  {r.nome_colete}
                </button>
              ))}
            </div>
          )}
        </div>

        {saida.integrante_id && (
          <div className="p-2 bg-background rounded text-xs">
            <p className="text-muted-foreground">Veículos:</p>
            <div className="flex gap-3 mt-1">
              {saida.tem_moto && <span>✓ Moto</span>}
              {saida.tem_carro && <span>✓ Carro</span>}
              {!saida.tem_moto && !saida.tem_carro && <span>Nenhum</span>}
            </div>
          </div>
        )}

        <div>
          <label className="text-xs text-muted-foreground">Data de Saída</label>
          <input
            type="date"
            className="w-full mt-1 p-2 border rounded bg-background"
            value={saida.data_saida || ""}
            onChange={(e) => {
              const novo = [...saidas];
              novo[idx].data_saida = e.target.value;
              setSaidas(novo);
            }}
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Motivo</label>
          <select
            className="w-full mt-1 p-2 border rounded bg-background"
            value={saida.motivo_codigo || ""}
            onChange={(e) => {
              const novo = [...saidas];
              novo[idx].motivo_codigo = e.target.value;
              setSaidas(novo);
            }}
          >
            <option value="">Selecione...</option>
            {acoes.map((acao: any) => (
              <option key={acao.id} value={acao.codigo_acao}>
                {acao.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Justificativa *</label>
          <Textarea
            className="w-full mt-1"
            rows={2}
            value={saida.justificativa || ""}
            onChange={(e) => {
              const novo = [...saidas];
              novo[idx].justificativa = e.target.value;
              setSaidas(novo);
            }}
            placeholder="Justifique a saída..."
          />
        </div>
      </div>
    </Card>
  );
};

// Componente auxiliar: Seção de Inadimplência
const SecaoInadimplencia = ({ inadimplencias, setInadimplencias, divisaoSelecionada }: any) => {
  const [buscaManual, setBuscaManual] = useState("");
  const [acaoCobranca, setAcaoCobranca] = useState("");
  const { resultados } = useBuscaIntegrante(buscaManual);
  const [mostrarResultados, setMostrarResultados] = useState(false);
  const [integranteSelecionado, setIntegranteSelecionado] = useState<any | null>(null);

  const removerDevedor = (idx: number) => {
    const novo = [...inadimplencias];
    novo[idx].status = "Removido";
    setInadimplencias(novo);
  };

  const adicionarManual = () => {
    if (!integranteSelecionado) {
      alert("Selecione o nome de colete antes de adicionar.");
      return;
    }

    if (!acaoCobranca) {
      alert("Preencha a ação de cobrança antes de adicionar.");
      return;
    }
    
    setInadimplencias([
      ...inadimplencias,
      {
        nome_colete: integranteSelecionado.nome_colete,
        status: "Adicionado_manual",
        acao_cobranca: acaoCobranca,
        justificativa_remocao: null
      }
    ]);
    
    setBuscaManual("");
    setAcaoCobranca("");
    setIntegranteSelecionado(null);
    setMostrarResultados(false);
  };

  return (
    <Card className="p-4 sm:p-6 space-y-4">
      <h3 className="font-semibold">Inadimplência / Mensalidades</h3>
      
      {inadimplencias.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium">Devedores da Divisão:</p>
          <p className="text-xs text-muted-foreground">
            Confirme abaixo os devedores e registre qual ação de cobrança está sendo tomada com cada um.
          </p>
          {inadimplencias.map((inad: any, idx: number) => {
            const getStatusLabel = () => {
              if (inad.status === "Removido") return "Removido (justificado)";
              if (inad.status === "Confirmado") return "Devedor ativo (confirmado)";
              if (inad.status === "Adicionado_manual") return "Devedor adicionado manualmente";
              return inad.status || "—";
            };

            return (
              <Card key={idx} className="p-3 bg-muted/50">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-sm">{inad.nome_colete}</p>
                    <p className="text-xs text-muted-foreground">
                      Status: {getStatusLabel()}
                    </p>
                    {inad.justificativa_remocao && (
                      <p className="text-xs mt-2 p-2 bg-background rounded">
                        Justificativa: {inad.justificativa_remocao}
                      </p>
                    )}
                  </div>
                  {inad.status !== "Removido" && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const justificativa = prompt(
                          "Por que este devedor deve ser removido da lista?"
                        );
                        if (justificativa) {
                          const novo = [...inadimplencias];
                          novo[idx].status = "Removido";
                          novo[idx].justificativa_remocao = justificativa;
                          setInadimplencias(novo);
                        }
                      }}
                    >
                      Remover
                    </Button>
                  )}
                </div>

                {inad.status !== "Removido" && (
                  <div className="mt-3">
                    <label className="text-xs text-muted-foreground">
                      Qual ação está sendo tomada para este devedor?
                    </label>
                    <Textarea
                      className="w-full mt-1"
                      rows={2}
                      value={inad.acao_cobranca || ""}
                      onChange={(e) => {
                        const novo = [...inadimplencias];
                        novo[idx].acao_cobranca = e.target.value;
                        setInadimplencias(novo);
                      }}
                      placeholder="Descreva a ação de cobrança (contato, prazo, tratativa, etc.)..."
                    />
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <div className="pt-4 border-t space-y-3">
        <p className="text-sm font-medium">Adicionar Devedor Manualmente:</p>
        <p className="text-xs text-muted-foreground">
          1) Busque o nome de colete • 2) Informe a ação de cobrança • 3) Clique em "Adicionar Devedor".
        </p>

        <div className="relative">
          <label className="text-xs text-muted-foreground">Buscar Integrante</label>
          <input
            type="text"
            className="w-full mt-1 p-2 border rounded bg-background"
            value={buscaManual}
            onChange={(e) => {
              setBuscaManual(e.target.value);
              setMostrarResultados(true);
            }}
            onFocus={() => setMostrarResultados(true)}
            placeholder="Nome de colete..."
          />
          {mostrarResultados && resultados.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-background border rounded shadow-lg max-h-48 overflow-auto">
              {resultados.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className="w-full text-left px-3 py-2 hover:bg-muted text-sm"
                  onClick={() => {
                    setIntegranteSelecionado(r);
                    setBuscaManual(r.nome_colete);
                    setMostrarResultados(false);
                  }}
                >
                  {r.nome_colete}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Qual ação está sendo tomada?</label>
          <Textarea
            className="w-full mt-1"
            rows={2}
            value={acaoCobranca}
            onChange={(e) => setAcaoCobranca(e.target.value)}
            placeholder="Descreva a ação de cobrança..."
          />
        </div>

        <div className="mt-3 flex justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={adicionarManual}
          >
            Adicionar Devedor
          </Button>
        </div>
      </div>
    </Card>
  );
};

const FormularioRelatorioSemanal = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const { toast } = useToast();
  const { mutate: submitRelatorio } = useSubmitRelatorioSemanal();

  // T6: Estados do formulário
  const [carregando, setCarregando] = useState(true);
  const [dadosResponsavel, setDadosResponsavel] = useState<any>(null);
  const [divisaoSelecionada, setDivisaoSelecionada] = useState<any>(null);
  const [divisoesDisponiveis, setDivisoesDisponiveis] = useState<any[]>([]);
  const [formularioId, setFormularioId] = useState<string | null>(null);
  const [formConfig, setFormConfig] = useState<any>(null);
  const [existingReport, setExistingReport] = useState<any>(null);
  const [modoEdicao, setModoEdicao] = useState<'nova' | 'editar' | null>(null);
  
  // Seções do formulário
  const [teveEntradas, setTeveEntradas] = useState(false);
  const [teveSaidas, setTeveSaidas] = useState(false);
  const [teveConflitos, setTeveConflitos] = useState(false);
  const [teveAcoesSociais, setTeveAcoesSociais] = useState(false);
  
  const [entradas, setEntradas] = useState<any[]>([]);
  const [saidas, setSaidas] = useState<any[]>([]);
  const [inadimplencias, setInadimplencias] = useState<any[]>([]);
  const [conflitos, setConflitos] = useState<any[]>([]);
  const [acoesSociais, setAcoesSociais] = useState<any[]>([]);
  const [estatisticas, setEstatisticas] = useState<any>(null);

  // Calcular dia permitido
  const hoje = new Date();
  const diaHoje = hoje.getDay(); // 0=Dom, 1=Seg, ..., 6=Sab
  const diasPermitidos = formConfig?.dias_semana;
  const hojePermitido = !diasPermitidos || 
                        diasPermitidos.length === 0 || 
                        diasPermitidos.includes(diaHoje);

  // Log de diagnóstico
  console.log('[FormularioRelatorioSemanal] Dia hoje:', diaHoje, DIAS_SEMANA_NOMES[diaHoje]);
  console.log('[FormularioRelatorioSemanal] Dias permitidos:', diasPermitidos);
  console.log('[FormularioRelatorioSemanal] Hoje permitido?', hojePermitido);
  console.log('[FormularioRelatorioSemanal] Limite respostas:', formConfig?.limite_respostas);
  console.log('[FormularioRelatorioSemanal] Relatório existente:', existingReport?.id);
  console.log('[FormularioRelatorioSemanal] Divisão selecionada:', divisaoSelecionada?.nome, divisaoSelecionada?.id);
  console.log('[FormularioRelatorioSemanal] Responsável do relatório existente:', existingReport?.responsavel_nome_colete);

  // T6: Carregar dados iniciais do responsável
  useEffect(() => {
    const carregarDados = async () => {
      if (!user?.id || !profile) return;

      try {
        // Buscar integrante pelo profile_id
        const { data: integrante, error: integranteError } = await supabase
          .from('integrantes_portal')
          .select('*')
          .eq('profile_id', user.id)
          .eq('ativo', true)
          .single();

        if (integranteError) throw integranteError;

        // Buscar regional usando normalização de texto
        const regionalNormalizado = normalizeText(integrante.regional_texto);
        const { data: regionais, error: regionaisError } = await supabase
          .from('regionais')
          .select('*');

        if (regionaisError) throw regionaisError;

        const regional = regionais?.find(r => normalizeText(r.nome) === regionalNormalizado);

        if (!regional) {
          toast({
            title: "Erro",
            description: "Regional não encontrada",
            variant: "destructive"
          });
          return;
        }

        // Buscar divisões da regional
        const { data: divisoes, error: divisoesError } = await supabase
          .from('divisoes')
          .select('*')
          .eq('regional_id', regional.id);

        if (divisoesError) throw divisoesError;

        // Encontrar divisão do integrante
        const divisaoNormalizada = normalizeText(integrante.divisao_texto);
        const divisaoIntegrante = divisoes?.find(d => normalizeText(d.nome) === divisaoNormalizada);

        // Buscar formulário COM todos os campos relevantes
        const { data: formulario, error: formularioError } = await supabase
          .from('formularios_catalogo')
          .select('id, dias_semana, limite_respostas, periodicidade')
          .eq('link_interno', '/formularios/relatorio-semanal-divisao')
          .eq('regional_id', regional.id)
          .eq('ativo', true)
          .single();

        if (formularioError) throw formularioError;

        setFormularioId(formulario?.id || null);
        setFormConfig(formulario);

        // Buscar relatório existente da semana atual para a divisão inicial
        if (formulario?.id && divisaoIntegrante?.id) {
          const { inicio, fim } = getSemanaAtual();
          
          const { data: relatorioExistente } = await supabase
            .from('relatorios_semanais_divisao')
            .select('*')
            .eq('formulario_id', formulario.id)
            .eq('divisao_relatorio_id', divisaoIntegrante.id)
            .eq('semana_inicio', formatDateToSQL(inicio))
            .eq('semana_fim', formatDateToSQL(fim))
            .maybeSingle();
          
          if (relatorioExistente) {
            setExistingReport(relatorioExistente);
            console.log('[FormularioRelatorioSemanal] Relatório existente para divisão:', divisaoIntegrante.nome, relatorioExistente.id);
          } else {
            console.log('[FormularioRelatorioSemanal] Nenhum relatório existente para divisão:', divisaoIntegrante.nome);
          }
        }

        setDadosResponsavel({
          ...integrante,
          regional_id: regional.id,
          regional_nome: regional.nome,
          divisao_id: divisaoIntegrante?.id
        });
        setDivisoesDisponiveis(divisoes || []);
        setDivisaoSelecionada(divisaoIntegrante || divisoes?.[0]);
        setFormularioId(formulario?.id || null);
        setCarregando(false);

      } catch (error: any) {
        console.error("Erro ao carregar dados:", error);
        toast({
          title: "Erro",
          description: error.message,
          variant: "destructive"
        });
        setCarregando(false);
      }
    };

    carregarDados();
  }, [user, profile, toast]);

  // T6: Carregar estatísticas da divisão selecionada
  useEffect(() => {
    if (!divisaoSelecionada) return;

    const carregarEstatisticas = async () => {
      const divisaoNormalizada = normalizeText(divisaoSelecionada.nome);
      
      const { data: integrantesDivisao, error } = await supabase
        .from('integrantes_portal')
        .select('*')
        .eq('ativo', true);

      if (error) {
        console.error("Erro ao carregar estatísticas:", error);
        return;
      }

      // Filtrar por divisão usando normalização
      const integrantesFiltrados = integrantesDivisao?.filter(i => 
        normalizeText(i.divisao_texto) === divisaoNormalizada
      ) || [];

      const stats = {
        total_caveiras: integrantesFiltrados.filter(i => i.caveira).length,
        total_suplentes_caveira: integrantesFiltrados.filter(i => i.caveira_suplente).length,
        total_batedores: integrantesFiltrados.filter(i => i.batedor).length,
        total_lobos: integrantesFiltrados.filter(i => i.lobo).length,
        total_ursos: integrantesFiltrados.filter(i => i.ursinho).length,
        total_tem_moto: integrantesFiltrados.filter(i => i.tem_moto).length,
        total_tem_carro: integrantesFiltrados.filter(i => i.tem_carro).length,
        total_sem_veiculo: integrantesFiltrados.filter(i => !i.tem_moto && !i.tem_carro).length,
        total_combate_insano: integrantesFiltrados.filter(i => i.combate_insano).length,
        estagio: integrantesFiltrados
          .filter(i => i.cargo_estagio && normalizeText(i.cargo_estagio) !== "SEM CARGO")
          .map(i => ({
            nome_colete: i.nome_colete,
            cargo_estagio: i.cargo_estagio
          }))
      };

      setEstatisticas(stats);
    };

    carregarEstatisticas();
  }, [divisaoSelecionada]);

  // T6: Carregar inadimplências da divisão
  useEffect(() => {
    if (!divisaoSelecionada) return;

    const carregarInadimplencias = async () => {
      const divisaoNormalizada = normalizeText(divisaoSelecionada.nome);

      // Usar view se existir, senão mensalidades_atraso
      const { data: devedores, error } = await supabase
        .from('vw_devedores_ativos')
        .select('*');

      if (error) {
        console.error("Erro ao carregar inadimplências:", error);
        return;
      }

      // Filtrar por divisão usando normalização
      const devedoresFiltrados = devedores?.filter(d => 
        normalizeText(d.divisao_texto) === divisaoNormalizada
      ) || [];

      setInadimplencias(devedoresFiltrados.map(d => ({
        nome_colete: d.nome_colete,
        status: "Confirmado",
        justificativa_remocao: null,
        acao_cobranca: ""
      })));
    };

    carregarInadimplencias();
  }, [divisaoSelecionada]);

  // Recarregar relatório existente quando divisão do relatório mudar
  useEffect(() => {
    if (!divisaoSelecionada?.id || !formularioId) return;

    const verificarRelatorioExistente = async () => {
      const { inicio, fim } = getSemanaAtual();
      
      const { data: relatorioExistente } = await supabase
        .from('relatorios_semanais_divisao')
        .select('*')
        .eq('formulario_id', formularioId)
        .eq('divisao_relatorio_id', divisaoSelecionada.id)
        .eq('semana_inicio', formatDateToSQL(inicio))
        .eq('semana_fim', formatDateToSQL(fim))
        .maybeSingle();
      
      if (relatorioExistente) {
        setExistingReport(relatorioExistente);
        setModoEdicao(null); // Reset modo edição ao trocar divisão
        console.log('[FormularioRelatorioSemanal] Relatório existente para divisão:', divisaoSelecionada.nome, relatorioExistente.id);
      } else {
        setExistingReport(null);
        setModoEdicao(null);
        console.log('[FormularioRelatorioSemanal] Nenhum relatório existente para divisão:', divisaoSelecionada.nome);
      }
    };

    verificarRelatorioExistente();
  }, [divisaoSelecionada?.id, formularioId]);

  const carregarRespostasExistentes = (relatorio: any) => {
    // Preencher estados com dados do relatório existente
    setTeveEntradas(relatorio.entradas_json?.length > 0);
    setEntradas(relatorio.entradas_json || []);
    
    setTeveSaidas(relatorio.saidas_json?.length > 0);
    setSaidas(relatorio.saidas_json || []);
    
    setInadimplencias(relatorio.inadimplencias_json || []);
    
    setTeveConflitos(relatorio.conflitos_json?.length > 0);
    setConflitos(relatorio.conflitos_json || []);
    
    setTeveAcoesSociais(relatorio.acoes_sociais_json?.length > 0);
    setAcoesSociais(relatorio.acoes_sociais_json || []);
    
    // Estatísticas permanecem recalculadas (dados atuais da divisão)
    
    toast({
      title: "Respostas carregadas",
      description: "Edite os campos desejados e clique em 'Atualizar Relatório'."
    });
  };

  const limparFormulario = () => {
    setTeveEntradas(false);
    setEntradas([]);
    setTeveSaidas(false);
    setSaidas([]);
    setTeveConflitos(false);
    setConflitos([]);
    setTeveAcoesSociais(false);
    setAcoesSociais([]);
    // Inadimplências e estatísticas são sempre recalculadas automaticamente
    
    toast({
      title: "Formulário limpo",
      description: "Preencha novamente e clique em 'Enviar Relatório' para sobrescrever."
    });
  };

  const handleEnviar = () => {
    // Validação 1: Dia permitido
    if (!hojePermitido) {
      toast({
        title: "Dia não permitido",
        description: `Este formulário só pode ser respondido em: ${
          (formConfig?.dias_semana || [])
            .map((d: number) => DIAS_SEMANA_NOMES[d])
            .join(', ')
        }`,
        variant: "destructive"
      });
      return;
    }

    // Validação 2: Limite 'unica' + já existe para esta divisão
    if (formConfig?.limite_respostas === 'unica' && existingReport) {
      toast({
        title: "Relatório já enviado",
        description: `A divisão "${divisaoSelecionada?.nome}" já possui relatório nesta semana. Apenas 1 relatório por divisão é permitido.`,
        variant: "destructive"
      });
      return;
    }

    // Validação 3: Dados incompletos
    if (!formularioId || !dadosResponsavel || !divisaoSelecionada) {
      toast({
        title: "Erro",
        description: "Dados incompletos",
        variant: "destructive"
      });
      return;
    }

    const { inicio, fim } = getSemanaAtual();

    // T1: Montar dados com estatisticas_divisao_json
    const dados = {
      formulario_id: formularioId,
      profile_id: user!.id,
      integrante_portal_id: dadosResponsavel.id,
      responsavel_nome_colete: dadosResponsavel.nome_colete,
      responsavel_cargo_nome: dadosResponsavel.cargo_nome,
      responsavel_divisao_texto: dadosResponsavel.divisao_texto,
      responsavel_regional_texto: dadosResponsavel.regional_texto,
      responsavel_comando_texto: dadosResponsavel.comando_texto,
      divisao_relatorio_id: divisaoSelecionada.id,
      divisao_relatorio_texto: divisaoSelecionada.nome,
      regional_relatorio_id: dadosResponsavel.regional_id,
      regional_relatorio_texto: dadosResponsavel.regional_nome,
      semana_inicio: formatDateToSQL(inicio),
      semana_fim: formatDateToSQL(fim),
      entradas_json: teveEntradas ? entradas : [],
      saidas_json: teveSaidas ? saidas : [],
      inadimplencias_json: inadimplencias,
      conflitos_json: teveConflitos ? conflitos : [],
      acoes_sociais_json: teveAcoesSociais ? acoesSociais : [],
      estatisticas_divisao_json: estatisticas || {}
    };

    // Preparar parâmetros para o hook
    const params: SubmitRelatorioParams = {
      dados,
      existingReportId: existingReport?.id || null,
      limiteRespostas: formConfig?.limite_respostas
    };

    console.log('[FormularioRelatorioSemanal] Enviando relatório:', {
      modo: existingReport ? 'UPDATE' : 'INSERT',
      existingReportId: existingReport?.id,
      limiteRespostas: formConfig?.limite_respostas
    });

    submitRelatorio(params, {
      onSuccess: () => {
        navigate("/formularios");
      }
    });
  };

  if (carregando) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>Carregando formulário...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-3 sm:p-4">
      <div className="max-w-full sm:max-w-2xl mx-auto space-y-4 sm:space-y-6">
        {/* T6: Cabeçalho */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/formularios")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <p className="text-xs sm:text-sm text-muted-foreground">Regional {dadosResponsavel?.regional_texto}</p>
            <h1 className="text-xl sm:text-2xl font-bold">Relatório Semanal da Divisão</h1>
          </div>
        </div>

        {/* Banner: Dia não permitido */}
        {!hojePermitido && formConfig && (
          <Card className="p-4 bg-amber-50 dark:bg-amber-950 border-amber-300 dark:border-amber-700">
            <div className="flex items-start gap-3">
              <div className="text-2xl">⚠️</div>
              <div>
                <h4 className="font-semibold text-amber-900 dark:text-amber-100 mb-1">
                  Dia não permitido para responder
                </h4>
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  Este formulário só pode ser respondido nos seguintes dias:
                  <strong className="ml-1">
                    {(formConfig.dias_semana || [])
                      .map((d: number) => DIAS_SEMANA_NOMES[d])
                      .join(', ')}
                  </strong>
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-2">
                  Hoje é <strong>{DIAS_SEMANA_NOMES[diaHoje]}</strong>. Volte em um dia permitido.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Banner: Limite 'unica' - já respondeu */}
        {formConfig?.limite_respostas === 'unica' && existingReport && (
          <Card className="p-4 bg-blue-50 dark:bg-blue-950 border-blue-300 dark:border-blue-700">
            <div className="flex items-start gap-3">
              <div className="text-2xl">ℹ️</div>
              <div>
                <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                  Relatório já enviado
                </h4>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Esta divisão (<strong>{divisaoSelecionada?.nome}</strong>) já possui um relatório 
                  enviado nesta semana em{' '}
                  <strong>
                    {new Date(existingReport.created_at).toLocaleString('pt-BR')}
                  </strong>
                  {existingReport.profile_id !== user?.id && (
                    <span> por <strong>{existingReport.responsavel_nome_colete}</strong></span>
                  )}.
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-2">
                  Como este formulário permite apenas <strong>1 relatório por semana para cada divisão</strong>, 
                  não é possível enviar outro. Se precisar corrigir informações, entre em contato com o 
                  ADM Regional.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Banner: Limite 'multipla' - opção de editar ou sobrescrever */}
        {formConfig?.limite_respostas === 'multipla' && existingReport && !modoEdicao && (
          <Card className="p-4 bg-purple-50 dark:bg-purple-950 border-purple-300 dark:border-purple-700">
            <div className="flex items-start gap-3">
              <div className="text-2xl">🔄</div>
              <div className="flex-1">
                <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-1">
                  Relatório já enviado para esta divisão
                </h4>
                <p className="text-sm text-purple-800 dark:text-purple-200 mb-3">
                  A divisão <strong>{divisaoSelecionada?.nome}</strong> já possui um relatório 
                  enviado nesta semana em{' '}
                  <strong>
                    {new Date(existingReport.created_at).toLocaleString('pt-BR')}
                  </strong>
                  {existingReport.profile_id !== user?.id && (
                    <span> por <strong>{existingReport.responsavel_nome_colete}</strong></span>
                  )}.
                  <br />
                  Deseja carregar as respostas anteriores para edição ou sobrescrever com um novo relatório?
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      setModoEdicao('editar');
                      carregarRespostasExistentes(existingReport);
                    }}
                  >
                    Editar respostas anteriores
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setModoEdicao('nova');
                      limparFormulario();
                    }}
                  >
                    Nova resposta (sobrescrever)
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Dados do Responsável */}
        <Card className="p-4 sm:p-6 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Nome:</span>
              <p className="font-medium">{dadosResponsavel?.nome_colete}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Cargo:</span>
              <p className="font-medium">{dadosResponsavel?.cargo_nome || "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Divisão:</span>
              <p className="font-medium">{dadosResponsavel?.divisao_texto}</p>
            </div>
          </div>

          <div className="pt-3 border-t">
            <label className="text-sm text-muted-foreground">Divisão do Relatório</label>
            <select 
              className="w-full mt-1 p-2 border rounded bg-secondary text-secondary-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              value={divisaoSelecionada?.id || ""}
              onChange={(e) => {
                const div = divisoesDisponiveis.find(d => d.id === e.target.value);
                setDivisaoSelecionada(div);
              }}
            >
              {divisoesDisponiveis.map(d => (
                <option key={d.id} value={d.id}>{d.nome}</option>
              ))}
            </select>
          </div>
        </Card>

        {/* Seção: Entradas de Integrantes */}
        <Card className="p-6 space-y-4">
          <h3 className="font-semibold">Entradas de Integrantes</h3>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Houve entrada de integrantes nesta semana?</p>
            <div className="flex gap-2">
              <Button 
                type="button"
                variant={teveEntradas ? "default" : "outline"}
                className="min-h-[44px]"
                onClick={() => setTeveEntradas(true)}
              >
                Sim
              </Button>
              <Button 
                type="button"
                variant={!teveEntradas ? "default" : "outline"}
                className="min-h-[44px]"
                onClick={() => {
                  setTeveEntradas(false);
                  setEntradas([]);
                }}
              >
                Não
              </Button>
            </div>
          </div>

          {teveEntradas && (
            <div className="space-y-4">
              {entradas.map((entrada, idx) => (
                <Card key={idx} className="p-4 space-y-3 bg-muted/50">
                  <div className="flex justify_between items-start">
                    <h4 className="text-sm font-medium">Entrada #{idx + 1}</h4>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setEntradas(entradas.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="grid gap-3">
                    {/* Nome de Colete (único nome digitado) */}
                    <div>
                      <label className="text-xs text-muted-foreground">Nome de Colete</label>
                      <input
                        type="text"
                        className="w-full mt-1 p-2 border rounded bg-background"
                        value={entrada.nome_colete || ""}
                        onChange={(e) => {
                          const novo = [...entradas];
                          novo[idx].nome_colete = e.target.value;
                          setEntradas(novo);
                        }}
                      />
                    </div>

                    {/* Manter Data de Entrada */}
                    <div>
                      <label className="text-xs text-muted-foreground">Data de Entrada</label>
                      <input
                        type="date"
                        className="w-full mt-1 p-2 border rounded bg-background"
                        value={entrada.data_entrada || ""}
                        onChange={(e) => {
                          const novo = [...entradas];
                          novo[idx].data_entrada = e.target.value;
                          setEntradas(novo);
                        }}
                      />
                    </div>

                    {/* Motivo da Entrada */}
                    <div>
                      <label className="text-xs text-muted-foreground">Motivo da Entrada</label>
                      <select
                        className="w-full mt-1 p-2 border rounded bg-background"
                        value={entrada.motivo_entrada || ""}
                        onChange={(e) => {
                          const novo = [...entradas];
                          novo[idx].motivo_entrada = e.target.value;
                          setEntradas(novo);
                        }}
                      >
                        <option value="">Selecione...</option>
                        <option value="Novo">Novo</option>
                        <option value="Transferido">Transferido</option>
                        <option value="Retorno">Retorno</option>
                        <option value="Outro">Outro</option>
                      </select>
                    </div>

                    {/* Veículos */}
                    <div>
                      <label className="text-xs text-muted-foreground">Veículos</label>
                      <div className="flex gap-4 mt-2">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={entrada.possui_carro || false}
                            onChange={(e) => {
                              const novo = [...entradas];
                              novo[idx].possui_carro = e.target.checked;
                              if (e.target.checked) novo[idx].nenhum = false;
                              setEntradas(novo);
                            }}
                          />
                          <span className="text-sm">Carro</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={entrada.possui_moto || false}
                            onChange={(e) => {
                              const novo = [...entradas];
                              novo[idx].possui_moto = e.target.checked;
                              if (e.target.checked) novo[idx].nenhum = false;
                              setEntradas(novo);
                            }}
                          />
                          <span className="text-sm">Moto</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={entrada.nenhum || false}
                            onChange={(e) => {
                              const novo = [...entradas];
                              novo[idx].nenhum = e.target.checked;
                              if (e.target.checked) {
                                novo[idx].possui_carro = false;
                                novo[idx].possui_moto = false;
                              }
                              setEntradas(novo);
                            }}
                          />
                          <span className="text-sm">Nenhum</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEntradas([
                  ...entradas,
                  {
                    nome_colete: "",
                    data_entrada: "",
                    motivo_entrada: "",
                    possui_carro: false,
                    possui_moto: false,
                    nenhum: false
                  }
                ])}
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Entrada
              </Button>
            </div>
          )}
        </Card>

        {/* Seção: Saídas de Integrantes */}
        <SecaoSaidas
          teveSaidas={teveSaidas}
          setTeveSaidas={setTeveSaidas}
          saidas={saidas}
          setSaidas={setSaidas}
        />

        {/* Seção: Inadimplência */}
        <SecaoInadimplencia
          inadimplencias={inadimplencias}
          setInadimplencias={setInadimplencias}
          divisaoSelecionada={divisaoSelecionada}
        />

        {/* Seção: Conflitos */}
        <Card className="p-6 space-y-4">
          <h3 className="font-semibold">Conflitos Internos e Externos</h3>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Houve conflitos esta semana?</p>
            <div className="flex gap-2">
              <Button 
                type="button"
                variant={teveConflitos ? "default" : "outline"}
                className="min-h-[44px]"
                onClick={() => setTeveConflitos(true)}
              >
                Sim
              </Button>
              <Button 
                type="button"
                variant={!teveConflitos ? "default" : "outline"}
                className="min-h-[44px]"
                onClick={() => {
                  setTeveConflitos(false);
                  setConflitos([]);
                }}
              >
                Não
              </Button>
            </div>
          </div>

          {teveConflitos && (
            <div className="space-y-4">
              {conflitos.map((conflito, idx) => (
                <Card key={idx} className="p-4 space-y-3 bg-muted/50">
                  <div className="flex justify-between items-start">
                    <h4 className="text-sm font-medium">Conflito #{idx + 1}</h4>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setConflitos(conflitos.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Data da Ocorrência</label>
                      <input
                        type="date"
                        className="w-full mt-1 p-2 border rounded bg-background"
                        value={conflito.data_ocorrencia || ""}
                        onChange={(e) => {
                          const novo = [...conflitos];
                          novo[idx].data_ocorrencia = e.target.value;
                          setConflitos(novo);
                        }}
                      />
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground">Descrição</label>
                      <Textarea
                        className="w-full mt-1"
                        rows={3}
                        value={conflito.descricao || ""}
                        onChange={(e) => {
                          const novo = [...conflitos];
                          novo[idx].descricao = e.target.value;
                          setConflitos(novo);
                        }}
                        placeholder="Descreva o conflito..."
                      />
                    </div>
                  </div>
                </Card>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConflitos([...conflitos, {
                  data_ocorrencia: "",
                  descricao: ""
                }])}
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Conflito
              </Button>
            </div>
          )}
        </Card>

        {/* Seção: Ações Sociais */}
        <Card className="p-6 space-y-4">
          <h3 className="font-semibold">Ações Sociais</h3>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Houve ações sociais esta semana?</p>
            <div className="flex gap-2">
              <Button 
                type="button"
                variant={teveAcoesSociais ? "default" : "outline"}
                className="min-h-[44px]"
                onClick={() => setTeveAcoesSociais(true)}
              >
                Sim
              </Button>
              <Button 
                type="button"
                variant={!teveAcoesSociais ? "default" : "outline"}
                className="min-h-[44px]"
                onClick={() => {
                  setTeveAcoesSociais(false);
                  setAcoesSociais([]);
                }}
              >
                Não
              </Button>
            </div>
          </div>

          {teveAcoesSociais && (
            <div className="space-y-4">
              {acoesSociais.map((acao, idx) => (
                <Card key={idx} className="p-4 space-y-3 bg-muted/50">
                  <div className="flex justify-between items-start">
                    <h4 className="text-sm font-medium">Ação Social #{idx + 1}</h4>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setAcoesSociais(acoesSociais.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Data da Ação</label>
                      <input
                        type="date"
                        className="w-full mt-1 p-2 border rounded bg-background"
                        value={acao.data_acao || ""}
                        onChange={(e) => {
                          const novo = [...acoesSociais];
                          novo[idx].data_acao = e.target.value;
                          setAcoesSociais(novo);
                        }}
                      />
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground">Título</label>
                      <input
                        type="text"
                        className="w-full mt-1 p-2 border rounded bg-background"
                        value={acao.titulo || ""}
                        onChange={(e) => {
                          const novo = [...acoesSociais];
                          novo[idx].titulo = e.target.value;
                          setAcoesSociais(novo);
                        }}
                      />
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground">Status</label>
                      <select
                        className="w-full mt-1 p-2 border rounded bg-background"
                        value={acao.status || ""}
                        onChange={(e) => {
                          const novo = [...acoesSociais];
                          novo[idx].status = e.target.value;
                          setAcoesSociais(novo);
                        }}
                      >
                        <option value="">Selecione...</option>
                        <option value="Concluida">Concluída</option>
                        <option value="Em andamento">Em andamento</option>
                      </select>
                    </div>
                  </div>
                </Card>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAcoesSociais([...acoesSociais, {
                  data_acao: "",
                  titulo: "",
                  status: ""
                }])}
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Ação Social
              </Button>
            </div>
          )}
        </Card>

        {/* Estatísticas da Divisão */}
        {estatisticas && (
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Estatísticas da Divisão</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>Caveiras: {estatisticas.total_caveiras}</div>
              <div>Suplentes: {estatisticas.total_suplentes_caveira}</div>
              <div>Batedores: {estatisticas.total_batedores}</div>
              <div>Lobos: {estatisticas.total_lobos}</div>
              <div>Ursos: {estatisticas.total_ursos}</div>
              <div>Com Moto: {estatisticas.total_tem_moto}</div>
              <div>Com Carro: {estatisticas.total_tem_carro}</div>
              <div>Sem Veículo: {estatisticas.total_sem_veiculo}</div>
              <div>Combate Insano: {estatisticas.total_combate_insano}</div>
            </div>
            {estatisticas.estagio.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm font-medium mb-2">Em Estágio:</p>
                <ul className="text-sm space-y-1">
                  {estatisticas.estagio.map((e: any, idx: number) => (
                    <li key={idx}>
                      {e.nome_colete} - {e.cargo_estagio}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        )}

        {/* Botões de ação */}
        <div className="flex gap-3">
          <Button onClick={() => navigate("/formularios")} variant="outline" className="flex-1">
            Cancelar
          </Button>
          <Button 
            onClick={handleEnviar} 
            className="flex-1"
            disabled={
              !hojePermitido || 
              (formConfig?.limite_respostas === 'unica' && existingReport)
            }
          >
            {existingReport && modoEdicao === 'editar' 
              ? 'Atualizar Relatório'
              : existingReport && modoEdicao === 'nova'
              ? 'Sobrescrever Relatório'
              : 'Enviar Relatório'
            }
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FormularioRelatorioSemanal;
