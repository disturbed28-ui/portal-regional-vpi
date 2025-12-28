import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Check, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useBuscaIntegrante, useBuscaIntegranteTodos } from "@/hooks/useIntegrantes";
import { useMovimentacoesConsolidadas } from "@/hooks/useMovimentacoesConsolidadas";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { normalizeText, calcularSemanaOperacional, formatDateToSQL, SemanaOperacional } from "@/lib/normalizeText";
import { cn } from "@/lib/utils";
import { useSubmitRelatorioSemanal, SubmitRelatorioParams } from "@/hooks/useRelatorioSemanal";
import { useAcoesResolucaoDelta } from "@/hooks/useAcoesResolucaoDelta";
import { format } from "date-fns";

// Constante com nomes de dias da semana
const DIAS_SEMANA_NOMES = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

// Helpers (novos): normalizacao e validacao de acao de cobranca
const normalizeAcaoCobranca = (v?: string | null) => {
  const s = (v ?? "").trim();
  return s === "-" ? "" : s;
};

const isAcaoCobrancaValida = (v?: string | null) => {
  const s = (v ?? "").trim();
  return s.length > 0 && s !== "-";
};

// Componente auxiliar: Seção de Saídas
const SecaoSaidas = ({
  teveSaidas,
  setTeveSaidas,
  saidas,
  setSaidas,
  divisaoAtual,
  saidasAplicadasAuto,
}: any) => {
  const { acoes } = useAcoesResolucaoDelta();
  const [buscas, setBuscas] = useState<{ [key: number]: string }>({});

  const adicionarSaida = () => {
    setSaidas([
      ...saidas,
      {
        integrante_id: "",
        nome_colete: "",
        data_saida: "",
        motivo_codigo: "",
        justificativa: "",
        tem_moto: false,
        tem_carro: false,
      },
    ]);
  };

  return (
    <Card className="p-4 sm:p-6 space-y-4">
      <h3 className="font-semibold">Saída de Integrantes</h3>

      {/* Banner informativo se houve preenchimento automático */}
      {saidasAplicadasAuto && saidas.length > 0 && saidas.some((s: any) => s.origem === "automatico") && (
        <Alert className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
          <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertTitle className="text-green-800 dark:text-green-200">
            Saídas Detectadas Automaticamente
          </AlertTitle>
          <AlertDescription className="text-green-700 dark:text-green-300">
            {saidas.filter((s: any) => s.origem === "automatico").length} saída(s) foi(ram) preenchida(s)
            automaticamente. Revise e complete os dados conforme necessário.
          </AlertDescription>
        </Alert>
      )}

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
              busca={buscas[idx] || saida.nome_colete || ""}
              setBusca={(valor: string) => setBuscas({ ...buscas, [idx]: valor })}
              divisaoAtual={divisaoAtual}
            />
          ))}

          <Button type="button" variant="outline" className="min-h-[44px]" onClick={adicionarSaida}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Saída
          </Button>
        </div>
      )}
    </Card>
  );
};

// Componente auxiliar: Item de Saída (usa busca sem filtro de status)
const ItemSaida = ({ saida, idx, acoes, saidas, setSaidas, busca, setBusca, divisaoAtual }: any) => {
  const { resultados } = useBuscaIntegranteTodos(busca, undefined); // Sem filtro de divisão para encontrar quem saiu
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

  // Função para determinar badge de status
  const getStatusBadge = (integrante: any) => {
    if (!integrante.ativo) {
      return (
        <Badge variant="destructive" className="ml-2 text-xs">
          Inativo
        </Badge>
      );
    }
    if (divisaoAtual && integrante.divisao_texto !== divisaoAtual) {
      return (
        <Badge
          variant="secondary"
          className="ml-2 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
        >
          Transferido
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="ml-2 text-xs">
        Ativo
      </Badge>
    );
  };

  return (
    <Card className="p-4 space-y-3 bg-muted/50">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium">Saída #{idx + 1}</h4>
          {saida.origem === "delta" && (
            <span className="text-xs bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 px-2 py-0.5 rounded">
              Detectado na carga
            </span>
          )}
          {(saida.origem === "sugestao" || saida.origem === "automatico") && (
            <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-0.5 rounded">
              Detectado automaticamente
            </span>
          )}
        </div>
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
            onBlur={() => {
              // Sincroniza o texto digitado com nome_colete se não selecionou da lista
              if (busca && !saida.integrante_id) {
                const novo = [...saidas];
                novo[idx].nome_colete = busca;
                setSaidas(novo);
              }
              setTimeout(() => setMostrarResultados(false), 200);
            }}
            placeholder="Buscar integrante (ativos e inativos)..."
          />
          {mostrarResultados && resultados.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-background border rounded shadow-lg max-h-48 overflow-auto">
              {resultados.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex items-center justify-between"
                  onClick={() => selecionarIntegrante(r)}
                >
                  <span>{r.nome_colete}</span>
                  {getStatusBadge(r)}
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
const SecaoInadimplencia = ({ inadimplencias, setInadimplencias }: any) => {
  const [buscaManual, setBuscaManual] = useState("");
  const [acaoCobranca, setAcaoCobranca] = useState("");
  const { resultados } = useBuscaIntegrante(buscaManual);
  const [mostrarResultados, setMostrarResultados] = useState(false);
  const [integranteSelecionado, setIntegranteSelecionado] = useState<any | null>(null);

  const adicionarManual = () => {
    if (!integranteSelecionado) {
      alert("Selecione o nome de colete antes de adicionar.");
      return;
    }

    if (!isAcaoCobrancaValida(acaoCobranca)) {
      alert("Preencha a ação de cobrança antes de adicionar.");
      return;
    }

    setInadimplencias([
      ...inadimplencias,
      {
        nome_colete: integranteSelecionado.nome_colete,
        status: "Adicionado_manual",
        acao_cobranca: normalizeAcaoCobranca(acaoCobranca),
        justificativa_remocao: null,
      },
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
            <span className="ml-1 font-medium text-amber-700 dark:text-amber-300">
              (Campo obrigatório)
            </span>
          </p>

          {inadimplencias.map((inad: any, idx: number) => {
            const getStatusLabel = () => {
              if (inad.status === "Removido") return "Removido (justificado)";
              if (inad.status === "Confirmado") return "Devedor ativo (confirmado)";
              if (inad.status === "Adicionado_manual") return "Devedor adicionado manualmente";
              return inad.status || "—";
            };

            const acaoValida = isAcaoCobrancaValida(inad.acao_cobranca);

            return (
              <Card key={idx} className="p-3 bg-muted/50">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-sm">{inad.nome_colete}</p>
                    <p className="text-xs text-muted-foreground">Status: {getStatusLabel()}</p>
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
                        const justificativa = prompt("Por que este devedor deve ser removido da lista?");
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
                      Qual ação está sendo tomada para este devedor? <span className="text-red-600">*</span>
                    </label>
                    <Textarea
                      className={cn("w-full mt-1", !acaoValida && "border border-red-500")}
                      rows={2}
                      value={inad.acao_cobranca || ""}
                      onChange={(e) => {
                        const novo = [...inadimplencias];
                        novo[idx].acao_cobranca = normalizeAcaoCobranca(e.target.value);
                        setInadimplencias(novo);
                      }}
                      placeholder="Descreva a ação de cobrança (contato, prazo, tratativa, etc.)..."
                    />
                    {!acaoValida && (
                      <p className="text-xs mt-1 text-red-600">
                        Obrigatório preencher a ação de cobrança (não pode ficar vazio ou “-”).
                      </p>
                    )}
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
          <label className="text-xs text-muted-foreground">
            Qual ação está sendo tomada? <span className="text-red-600">*</span>
          </label>
          <Textarea
            className={cn("w-full mt-1", !isAcaoCobrancaValida(acaoCobranca) && acaoCobranca.length > 0 && "border border-red-500")}
            rows={2}
            value={acaoCobranca}
            onChange={(e) => setAcaoCobranca(normalizeAcaoCobranca(e.target.value))}
            placeholder="Descreva a ação de cobrança..."
          />
        </div>

        <div className="mt-3 flex justify-end">
          <Button type="button" variant="outline" onClick={adicionarManual}>
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
  const [modoEdicao, setModoEdicao] = useState<"nova" | "editar" | null>(null);

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
  const [carregandoAcoesSociaisAuto, setCarregandoAcoesSociaisAuto] = useState(false);

  // ==============================
  // ESTADOS PARA CONTROLE DE SEMANA SELECIONADA (domingo com semana anterior pendente)
  // ==============================
  const hoje = new Date();
  const diaHoje = hoje.getDay(); // 0=Dom, 1=Seg, ..., 6=Sab
  
  const calcularSemanaAnterior = (): SemanaOperacional => {
    const setesDiasAtras = new Date();
    setesDiasAtras.setDate(setesDiasAtras.getDate() - 7);
    return calcularSemanaOperacional(setesDiasAtras);
  };

  const [semanaResposta, setSemanaResposta] = useState<SemanaOperacional>(calcularSemanaOperacional());
  const [semanaRespostaModo, setSemanaRespostaModo] = useState<"atual" | "anterior">("atual");
  const [pendenciaSemanaAnterior, setPendenciaSemanaAnterior] = useState(false);
  const [verificandoPendencia, setVerificandoPendencia] = useState(false);

  // Flag para controlar se já aplicou movimentações automáticas
  const movimentacoesAplicadas = useRef(false);
  const [saidasAplicadasAuto, setSaidasAplicadasAuto] = useState(false);
  const [entradasAplicadasAuto, setEntradasAplicadasAuto] = useState(false);

  // Hook consolidado para buscar entradas/saídas - USANDO semanaResposta
  const { data: movimentacoesConsolidadas } = useMovimentacoesConsolidadas(
    divisaoSelecionada?.nome && semanaResposta
      ? {
          divisao: divisaoSelecionada.nome,
          dataInicio: semanaResposta.periodo_inicio,
          dataFim: semanaResposta.periodo_fim,
        }
      : null
  );

  // Calcular dia permitido
  const diasPermitidos = formConfig?.dias_semana;
  const hojePermitido =
    !diasPermitidos || diasPermitidos.length === 0 || diasPermitidos.includes(diaHoje);
  
  // EXCEÇÃO: Domingo + semana anterior pendente + modo "anterior" = permitir envio
  const excecaoDomingoSemanaAnterior = diaHoje === 0 && pendenciaSemanaAnterior && semanaRespostaModo === "anterior";
  const hojePermitidoEfetivo = hojePermitido || excecaoDomingoSemanaAnterior;

  // Log de diagnóstico
  console.log("[FormularioRelatorioSemanal] Diagnóstico semana:", {
    hoje: hoje.toISOString(),
    dow: diaHoje,
    diaNome: DIAS_SEMANA_NOMES[diaHoje],
    semanaRespostaModo,
    semanaResposta_inicio: semanaResposta?.periodo_inicio?.toISOString(),
    semanaResposta_fim: semanaResposta?.periodo_fim?.toISOString(),
    pendenciaSemanaAnterior,
    hojePermitido,
    excecaoDomingoSemanaAnterior,
    hojePermitidoEfetivo,
  });
  console.log("[FormularioRelatorioSemanal] Limite respostas:", formConfig?.limite_respostas);
  console.log("[FormularioRelatorioSemanal] Relatório existente:", existingReport?.id);
  console.log("[FormularioRelatorioSemanal] Divisão selecionada:", divisaoSelecionada?.nome, divisaoSelecionada?.id);
  console.log("[FormularioRelatorioSemanal] Responsável do relatório existente:", existingReport?.responsavel_nome_colete);

  // T6: Carregar dados iniciais do responsável
  useEffect(() => {
    const carregarDados = async () => {
      if (!user?.id || !profile) return;

      try {
        // Buscar integrante pelo profile_id
        const { data: integrante, error: integranteError } = await supabase
          .from("integrantes_portal")
          .select("*")
          .eq("profile_id", user.id)
          .eq("ativo", true)
          .single();

        if (integranteError) throw integranteError;

        // Buscar regional usando normalização de texto
        const regionalNormalizado = normalizeText(integrante.regional_texto);
        const { data: regionais, error: regionaisError } = await supabase.from("regionais").select("*");

        if (regionaisError) throw regionaisError;

        const regional = regionais?.find((r) => normalizeText(r.nome) === regionalNormalizado);

        if (!regional) {
          toast({
            title: "Erro",
            description: "Regional não encontrada",
            variant: "destructive",
          });
          return;
        }

        // Buscar divisões da regional
        const { data: divisoes, error: divisoesError } = await supabase
          .from("divisoes")
          .select("*")
          .eq("regional_id", regional.id);

        if (divisoesError) throw divisoesError;

        // Encontrar divisão do integrante
        const divisaoNormalizada = normalizeText(integrante.divisao_texto);
        const divisaoIntegrante = divisoes?.find((d) => normalizeText(d.nome) === divisaoNormalizada);

        // Buscar formulário COM todos os campos relevantes
        const { data: formulario, error: formularioError } = await supabase
          .from("formularios_catalogo")
          .select("id, dias_semana, limite_respostas, periodicidade")
          .eq("link_interno", "/formularios/relatorio-semanal-divisao")
          .eq("regional_id", regional.id)
          .eq("ativo", true)
          .single();

        if (formularioError) throw formularioError;

        setFormularioId(formulario?.id || null);
        setFormConfig(formulario);

        // Buscar relatório existente da semana atual para a divisão inicial
        // Nota: isso usa calcularSemanaOperacional() apenas para carga inicial
        // Depois o useEffect de verificação de pendência ajustará semanaResposta se necessário
        if (formulario?.id && divisaoIntegrante?.id) {
          const semana = calcularSemanaOperacional();

          const { data: relatorioExistente } = await supabase
            .from("relatorios_semanais_divisao")
            .select("*")
            .eq("formulario_id", formulario.id)
            .eq("divisao_relatorio_id", divisaoIntegrante.id)
            .eq("semana_inicio", formatDateToSQL(semana.periodo_inicio))
            .eq("semana_fim", formatDateToSQL(semana.periodo_fim))
            .maybeSingle();

          if (relatorioExistente) {
            setExistingReport(relatorioExistente);
            console.log(
              "[FormularioRelatorioSemanal] Relatório existente para divisão:",
              divisaoIntegrante.nome,
              relatorioExistente.id
            );
          } else {
            console.log("[FormularioRelatorioSemanal] Nenhum relatório existente para divisão:", divisaoIntegrante.nome);
          }
        }

        setDadosResponsavel({
          ...integrante,
          regional_id: regional.id,
          regional_nome: regional.nome,
          divisao_id: divisaoIntegrante?.id,
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
          variant: "destructive",
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

      // Buscar integrantes ativos
      const { data: integrantesDivisao, error } = await supabase
        .from("integrantes_portal")
        .select("*")
        .eq("ativo", true);

      if (error) {
        console.error("Erro ao carregar estatísticas:", error);
        return;
      }

      // Buscar afastados ativos
      const { data: afastados } = await supabase.from("integrantes_afastados").select("*").eq("ativo", true);

      // Buscar devedores
      const { data: devedores } = await supabase.from("vw_devedores_ativos").select("*");

      // Filtrar por divisão usando normalização
      const integrantesFiltrados =
        integrantesDivisao?.filter((i) => normalizeText(i.divisao_texto) === divisaoNormalizada) || [];

      const afastadosFiltrados = afastados?.filter((a) => normalizeText(a.divisao_texto) === divisaoNormalizada) || [];

      const devedoresFiltrados = devedores?.filter((d) => normalizeText(d.divisao_texto) === divisaoNormalizada) || [];

      // Separar por grau/status
      const estagiarios = integrantesFiltrados.filter(
        (i) =>
          i.grau === "I" ||
          i.cargo_estagio?.toLowerCase().includes("estagiário") ||
          i.cargo_estagio?.toLowerCase().includes("estagiario")
      );

      const stats = {
        // Campos agregados para o modal de detalhes
        total_integrantes: integrantesFiltrados.length,
        total_aptos: integrantesFiltrados.filter((i) => i.grau && i.grau !== "I").length,
        total_estagiarios: estagiarios.length,
        total_afastados: afastadosFiltrados.length,
        total_devedores: devedoresFiltrados.length,
        total_veiculos: integrantesFiltrados.filter((i) => i.tem_moto || i.tem_carro).length,

        // Campos detalhados existentes
        total_caveiras: integrantesFiltrados.filter((i) => i.caveira).length,
        total_suplentes_caveira: integrantesFiltrados.filter((i) => i.caveira_suplente).length,
        total_batedores: integrantesFiltrados.filter((i) => i.batedor).length,
        total_lobos: integrantesFiltrados.filter((i) => i.lobo).length,
        total_ursos: integrantesFiltrados.filter((i) => i.ursinho).length,
        total_tem_moto: integrantesFiltrados.filter((i) => i.tem_moto).length,
        total_tem_carro: integrantesFiltrados.filter((i) => i.tem_carro).length,
        total_sem_veiculo: integrantesFiltrados.filter((i) => !i.tem_moto && !i.tem_carro).length,
        total_combate_insano: integrantesFiltrados.filter((i) => i.combate_insano).length,

        // Lista de estagiários com detalhes
        estagiarios: estagiarios.map((i) => ({
          nome_colete: i.nome_colete,
          estagio: i.cargo_estagio || "Estagiário",
        })),

        // Manter compatibilidade com campo antigo
        estagio: integrantesFiltrados
          .filter((i) => i.cargo_estagio && normalizeText(i.cargo_estagio) !== "SEM CARGO")
          .map((i) => ({
            nome_colete: i.nome_colete,
            cargo_estagio: i.cargo_estagio,
          })),
      };

      setEstatisticas(stats);
    };

    carregarEstatisticas();
  }, [divisaoSelecionada]);

  // ==============================
  // USEEFFECT: VERIFICAR PENDÊNCIA DA SEMANA ANTERIOR NO DOMINGO
  // ==============================
  useEffect(() => {
    const verificarPendenciaDomingo = async () => {
      // Só verificar se hoje é domingo (dow === 0)
      const dow = new Date().getDay();
      if (dow !== 0) {
        setPendenciaSemanaAnterior(false);
        return;
      }

      // Precisa ter formularioId e divisaoSelecionada
      if (!formularioId || !divisaoSelecionada?.id) return;

      setVerificandoPendencia(true);

      const semanaAtual = calcularSemanaOperacional();
      const semanaAnterior = calcularSemanaAnterior();

      console.log("[FormularioRelatorioSemanal] Verificando pendência no domingo:", {
        semanaAnterior_inicio: formatDateToSQL(semanaAnterior.periodo_inicio),
        semanaAnterior_fim: formatDateToSQL(semanaAnterior.periodo_fim),
        divisaoId: divisaoSelecionada.id,
      });

      // Verificar se existe relatório da semana anterior
      const { data: relatorioSemanaAnterior, error } = await supabase
        .from("relatorios_semanais_divisao")
        .select("id")
        .eq("formulario_id", formularioId)
        .eq("divisao_relatorio_id", divisaoSelecionada.id)
        .eq("semana_inicio", formatDateToSQL(semanaAnterior.periodo_inicio))
        .eq("semana_fim", formatDateToSQL(semanaAnterior.periodo_fim))
        .maybeSingle();

      setVerificandoPendencia(false);

      if (error) {
        console.error("[FormularioRelatorioSemanal] Erro ao verificar pendência:", error);
        return;
      }

      if (!relatorioSemanaAnterior) {
        // Semana anterior PENDENTE
        setPendenciaSemanaAnterior(true);
        setSemanaResposta(semanaAnterior);
        setSemanaRespostaModo("anterior");
        console.log("[FormularioRelatorioSemanal] Domingo: semana anterior pendente, sugerindo responder");
      } else {
        // Semana anterior já enviada
        setPendenciaSemanaAnterior(false);
        setSemanaResposta(semanaAtual);
        setSemanaRespostaModo("atual");
        console.log("[FormularioRelatorioSemanal] Domingo: semana anterior já enviada");
      }
    };

    verificarPendenciaDomingo();
  }, [formularioId, divisaoSelecionada?.id]);

  // T6: Carregar inadimplências da divisão (com normalizacao para impedir "-" e vazio)
  useEffect(() => {
    if (!divisaoSelecionada) return;

    const carregarInadimplencias = async () => {
      const divisaoNormalizada = normalizeText(divisaoSelecionada.nome);

      const { data: devedores, error } = await supabase.from("vw_devedores_ativos").select("*");

      if (error) {
        console.error("Erro ao carregar inadimplências:", error);
        return;
      }

      // Filtrar por divisão usando normalização
      const devedoresFiltrados =
        devedores?.filter((d) => normalizeText(d.divisao_texto) === divisaoNormalizada) || [];

      setInadimplencias(
        devedoresFiltrados.map((d) => ({
          nome_colete: d.nome_colete,
          status: "Confirmado",
          justificativa_remocao: null,
          // Campo preenchido manualmente pelo usuário - inicializa vazio
          acao_cobranca: "",
        }))
      );
    };

    carregarInadimplencias();
  }, [divisaoSelecionada]);

  // T6: Carregar ações sociais da semana + passivo (semana anterior não reportada)
  useEffect(() => {
    const carregarAcoesSociaisDaSemana = async () => {
      try {
        // Não sobrescrever quando estiver em modo de edição
        if (modoEdicao === "editar") return;

        // Se já houver ações carregadas (de relatório existente ou digitadas), não sobrescrever
        if (acoesSociais && acoesSociais.length > 0) return;

        // Precisamos ter divisaoSelecionada e formConfig carregados
        if (!divisaoSelecionada || !formConfig) return;

        setCarregandoAcoesSociaisAuto(true);

        const semana = semanaResposta; // USAR semanaResposta ao invés de calcularSemanaOperacional()

        // Calcular semana anterior à semanaResposta (para buscar passivo)
        const inicioSemanaAnterior = new Date(semana.periodo_inicio);
        inicioSemanaAnterior.setDate(inicioSemanaAnterior.getDate() - 7);
        const fimSemanaAnterior = new Date(semana.periodo_fim);
        fimSemanaAnterior.setDate(fimSemanaAnterior.getDate() - 7);

        // Buscar ações da SEMANA SELECIONADA (semanaResposta)
        const { data: acoesSemanaAtual, error: errorAtual } = await supabase
          .from("acoes_sociais_registros")
          .select("id, data_acao, escopo_acao, tipo_acao_nome_snapshot")
          .eq("divisao_relatorio_id", divisaoSelecionada.id)
          .gte("data_acao", formatDateToSQL(semana.periodo_inicio))
          .lte("data_acao", formatDateToSQL(semana.periodo_fim));

        // Buscar ações da SEMANA ANTERIOR (à semanaResposta) que NÃO foram reportadas
        const { data: acoesSemanaAnterior, error: errorAnterior } = await supabase
          .from("acoes_sociais_registros")
          .select("id, data_acao, escopo_acao, tipo_acao_nome_snapshot")
          .eq("divisao_relatorio_id", divisaoSelecionada.id)
          .gte("data_acao", formatDateToSQL(inicioSemanaAnterior))
          .lte("data_acao", formatDateToSQL(fimSemanaAnterior))
          .eq("foi_reportada_em_relatorio", false);

        setCarregandoAcoesSociaisAuto(false);

        if (errorAtual || errorAnterior) {
          console.error("[FormularioRelatorioSemanal] Erro ao carregar ações:", errorAtual || errorAnterior);
          return;
        }

        // Montar itens da semana atual
        const itensSemanaAtual = (acoesSemanaAtual || []).map((acao: any) => ({
          data_acao: acao.data_acao,
          titulo: acao.tipo_acao_nome_snapshot
            ? `${acao.tipo_acao_nome_snapshot} - ${acao.escopo_acao}`
            : acao.escopo_acao,
          status: "Concluída",
          origem: "form_acoes_sociais",
          registro_id: acao.id,
          marcador_relatorio: "semana_atual",
        }));

        // Montar itens passivos (semana anterior não reportada)
        const itensPassivo = (acoesSemanaAnterior || []).map((acao: any) => ({
          data_acao: acao.data_acao,
          titulo: acao.tipo_acao_nome_snapshot
            ? `${acao.tipo_acao_nome_snapshot} - ${acao.escopo_acao}`
            : acao.escopo_acao,
          status: "Concluída",
          origem: "form_acoes_sociais",
          registro_id: acao.id,
          marcador_relatorio: "semana_anterior_nao_reportada",
        }));

        const itensResumo = [...itensSemanaAtual, ...itensPassivo];

        if (itensResumo.length > 0) {
          setTeveAcoesSociais(true);
          setAcoesSociais(itensResumo);
          console.log("[FormularioRelatorioSemanal] Ações carregadas:", {
            semanaAtual: itensSemanaAtual.length,
            passivo: itensPassivo.length,
          });
        } else {
          console.log("[FormularioRelatorioSemanal] Nenhuma ação social encontrada");
        }
      } catch (error) {
        setCarregandoAcoesSociaisAuto(false);
        console.error("[FormularioRelatorioSemanal] Erro inesperado ao carregar ações:", error);
      }
    };

    carregarAcoesSociaisDaSemana();
  }, [divisaoSelecionada, formConfig, modoEdicao, acoesSociais, semanaResposta]);

  // T6: Carregar entradas e saídas automaticamente das movimentações consolidadas
  useEffect(() => {
    // Não sobrescrever em modo de edição
    if (modoEdicao === "editar") return;

    // Se já aplicamos movimentações ou já houver dados, não sobrescrever
    if (movimentacoesAplicadas.current) return;
    if ((entradas && entradas.length > 0) || (saidas && saidas.length > 0)) return;

    // Precisamos ter movimentações carregadas
    if (!movimentacoesConsolidadas) return;

    const { entradas: entradasConsolidadas, saidas: saidasConsolidadas } = movimentacoesConsolidadas;

    // Marcar como já aplicado para evitar re-aplicação
    movimentacoesAplicadas.current = true;

    // Mapear entradas para o formato do formulário
    if (entradasConsolidadas.length > 0) {
      const entradasMapeadas = entradasConsolidadas.map((m: any) => ({
        nome_colete: m.nome_colete,
        data_entrada: m.data_movimentacao?.split("T")[0] || "",
        motivo_entrada: m.tipo === "REATIVACAO" ? "Reativado" : "Transferido",
        possui_carro: false,
        possui_moto: false,
        nenhum: true,
        origem: "automatico",
        tipo_movimentacao: m.tipo,
        detalhes: m.detalhes,
      }));
      setTeveEntradas(true);
      setEntradas(entradasMapeadas);
      setEntradasAplicadasAuto(true);
      console.log("[FormularioRelatorioSemanal] Entradas aplicadas automaticamente:", entradasMapeadas.length);
    }

    // Mapear saídas para o formato do formulário
    if (saidasConsolidadas.length > 0) {
      const saidasMapeadas = saidasConsolidadas.map((m: any) => ({
        integrante_id: m.integrante_id || "",
        nome_colete: m.nome_colete,
        data_saida: m.data_movimentacao?.split("T")[0] || "",
        motivo_codigo: m.tipo === "INATIVACAO" ? "INATIVACAO" : "TRANSFERENCIA",
        justificativa: m.detalhes || "",
        tem_moto: false,
        tem_carro: false,
        origem: "automatico",
        tipo_movimentacao: m.tipo,
      }));
      setTeveSaidas(true);
      setSaidas(saidasMapeadas);
      setSaidasAplicadasAuto(true);
      console.log("[FormularioRelatorioSemanal] Saídas aplicadas automaticamente:", saidasMapeadas.length);
    }

    console.log("[FormularioRelatorioSemanal] Movimentações consolidadas aplicadas:", {
      entradas: entradasConsolidadas.length,
      saidas: saidasConsolidadas.length,
    });
  }, [movimentacoesConsolidadas, modoEdicao, entradas, saidas]);

  // Recarregar relatório existente quando divisão ou semanaResposta mudar
  useEffect(() => {
    if (!divisaoSelecionada?.id || !formularioId) return;

    const verificarRelatorioExistente = async () => {
      // USAR semanaResposta ao invés de calcularSemanaOperacional()
      const { data: relatorioExistente } = await supabase
        .from("relatorios_semanais_divisao")
        .select("*")
        .eq("formulario_id", formularioId)
        .eq("divisao_relatorio_id", divisaoSelecionada.id)
        .eq("semana_inicio", formatDateToSQL(semanaResposta.periodo_inicio))
        .eq("semana_fim", formatDateToSQL(semanaResposta.periodo_fim))
        .maybeSingle();

      if (relatorioExistente) {
        setExistingReport(relatorioExistente);
        setModoEdicao(null); // Reset modo edição ao trocar divisão
        console.log("[FormularioRelatorioSemanal] Relatório existente para divisão/semana:", divisaoSelecionada.nome, relatorioExistente.id);
      } else {
        setExistingReport(null);
        setModoEdicao(null);
        console.log("[FormularioRelatorioSemanal] Nenhum relatório existente para divisão/semana:", divisaoSelecionada.nome);
      }
    };

    verificarRelatorioExistente();
  }, [divisaoSelecionada?.id, formularioId, semanaResposta]);

  const carregarRespostasExistentes = (relatorio: any) => {
    // Preencher estados com dados do relatório existente
    setTeveEntradas(relatorio.entradas_json?.length > 0);
    setEntradas(relatorio.entradas_json || []);

    setTeveSaidas(relatorio.saidas_json?.length > 0);
    setSaidas(relatorio.saidas_json || []);

    // ✅ normalizar inadimplencias ao carregar (evita "-" e valida obrigatoriedade)
    const inad = (relatorio.inadimplencias_json || []).map((x: any) => ({
      ...x,
      acao_cobranca: normalizeAcaoCobranca(x.acao_cobranca),
    }));
    setInadimplencias(inad);

    setTeveConflitos(relatorio.conflitos_json?.length > 0);
    setConflitos(relatorio.conflitos_json || []);

    setTeveAcoesSociais(relatorio.acoes_sociais_json?.length > 0);
    setAcoesSociais(relatorio.acoes_sociais_json || []);

    toast({
      title: "Respostas carregadas",
      description: "Edite os campos desejados e clique em 'Atualizar Relatório'.",
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
      description: "Preencha novamente e clique em 'Enviar Relatório' para sobrescrever.",
    });
  };

  // Função para resetar formulário quando trocar de semana
  const resetarFormularioParaNovaSemana = () => {
    setTeveEntradas(false);
    setEntradas([]);
    setTeveSaidas(false);
    setSaidas([]);
    setTeveConflitos(false);
    setConflitos([]);
    setTeveAcoesSociais(false);
    setAcoesSociais([]);
    // Limpar flags de auto-preenchimento para permitir re-aplicação
    movimentacoesAplicadas.current = false;
    setSaidasAplicadasAuto(false);
    setEntradasAplicadasAuto(false);
    // Limpar relatório existente e modo edição
    setExistingReport(null);
    setModoEdicao(null);
  };

  const handleEnviar = () => {
    // Validação 1: Dia permitido (com exceção para domingo + semana anterior pendente)
    if (!hojePermitidoEfetivo) {
      toast({
        title: "Dia não permitido",
        description: `Este formulário só pode ser respondido em: ${(formConfig?.dias_semana || [])
          .map((d: number) => DIAS_SEMANA_NOMES[d])
          .join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    // Validação 2: Limite 'unica' + já existe para esta divisão
    if (formConfig?.limite_respostas === "unica" && existingReport) {
      toast({
        title: "Relatório já enviado",
        description: `A divisão "${divisaoSelecionada?.nome}" já possui relatório nesta semana. Apenas 1 relatório por divisão é permitido.`,
        variant: "destructive",
      });
      return;
    }

    // Validação 3: Dados incompletos
    if (!formularioId || !dadosResponsavel || !divisaoSelecionada) {
      toast({
        title: "Erro",
        description: "Dados incompletos",
        variant: "destructive",
      });
      return;
    }

    // Validação 4: Saídas sem nome de colete
    if (teveSaidas && saidas.length > 0) {
      const saidasSemNome = saidas.filter((s: any) => !s.nome_colete || s.nome_colete.trim() === "");
      if (saidasSemNome.length > 0) {
        toast({
          title: "Dados incompletos",
          description: `${saidasSemNome.length} saída(s) está(ão) sem nome de colete preenchido.`,
          variant: "destructive",
        });
        return;
      }
    }

    // ✅ Validação 5 (NOVA): Ação de cobrança obrigatória para todos os inadimplentes não removidos
    const inadInvalidos = (inadimplencias || [])
      .map((it: any, idx: number) => ({ it, idx }))
      .filter(({ it }) => it.status !== "Removido" && !isAcaoCobrancaValida(it.acao_cobranca));

    if (inadInvalidos.length > 0) {
      toast({
        title: "Ação de cobrança obrigatória",
        description: `Preencha a ação de cobrança de ${inadInvalidos.length} inadimplente(s). Não pode ficar vazio ou "-"`,
        variant: "destructive",
      });
      return;
    }

    // USAR semanaResposta ao invés de calcularSemanaOperacional()
    // Isso garante que o relatório será salvo na semana selecionada (atual ou anterior)

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
      semana_inicio: formatDateToSQL(semanaResposta.periodo_inicio),
      semana_fim: formatDateToSQL(semanaResposta.periodo_fim),
      ano_referencia: semanaResposta.ano_referencia,
      mes_referencia: semanaResposta.mes_referencia,
      semana_no_mes: semanaResposta.semana_no_mes,
      entradas_json: teveEntradas ? entradas : [],
      saidas_json: teveSaidas ? saidas : [],
      // ✅ normalizar antes de enviar para garantir que nao salva "-"
      inadimplencias_json: (inadimplencias || []).map((x: any) => ({
        ...x,
        acao_cobranca: normalizeAcaoCobranca(x.acao_cobranca),
      })),
      conflitos_json: teveConflitos ? conflitos : [],
      acoes_sociais_json: teveAcoesSociais ? acoesSociais : [],
      estatisticas_divisao_json: estatisticas || {},
    };

    // Extrair IDs das ações vindas do form de ações sociais para marcar como reportadas
    const acoesSociaisParaMarcar = acoesSociais
      .filter((item: any) => item.origem === "form_acoes_sociais" && item.registro_id)
      .map((item: any) => item.registro_id);

    // Preparar parâmetros para o hook
    const params: SubmitRelatorioParams = {
      dados,
      existingReportId: existingReport?.id || null,
      limiteRespostas: formConfig?.limite_respostas,
      acoesSociaisParaMarcar,
    };

    console.log("[FormularioRelatorioSemanal] Enviando relatório:", {
      modo: existingReport ? "UPDATE" : "INSERT",
      existingReportId: existingReport?.id,
      limiteRespostas: formConfig?.limite_respostas,
    });

    submitRelatorio(params, {
      onSuccess: () => {
        navigate("/formularios");
      },
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
    <div className="min-h-screen bg-background p-2 sm:p-4 overflow-x-hidden">
      <div className="w-full max-w-2xl mx-auto space-y-4 sm:space-y-6 px-1">
        {/* T6: Cabeçalho */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate("/formularios")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm text-muted-foreground truncate">Regional {dadosResponsavel?.regional_texto}</p>
            <h1 className="text-lg sm:text-2xl font-bold">Relatório Semanal da Divisão</h1>
          </div>
        </div>

        {/* Banner: Domingo com semana anterior pendente - ESCOLHA DE SEMANA */}
        {pendenciaSemanaAnterior && diaHoje === 0 && divisaoSelecionada && (
          <Card className="p-4 bg-orange-50 dark:bg-orange-950 border-orange-300 dark:border-orange-700">
            <div className="flex items-start gap-3">
              <Calendar className="h-6 w-6 text-orange-600 dark:text-orange-400 mt-0.5 shrink-0" />
              <div className="flex-1">
                <h4 className="font-semibold text-orange-900 dark:text-orange-100 mb-1">
                  Relatório da última semana não foi respondido
                </h4>
                <p className="text-sm text-orange-800 dark:text-orange-200 mb-3">
                  Detectamos que a divisão <strong>{divisaoSelecionada?.nome}</strong> não enviou 
                  o relatório da semana <strong>
                    {format(calcularSemanaAnterior().periodo_inicio, "dd/MM")} a{" "}
                    {format(calcularSemanaAnterior().periodo_fim, "dd/MM")}
                  </strong>. 
                  Deseja responder a semana anterior agora ou iniciar a semana atual?
                </p>
                
                <div className="text-xs text-orange-700 dark:text-orange-300 mb-3 space-y-1">
                  <p>• Semana anterior: {format(calcularSemanaAnterior().periodo_inicio, "dd/MM")} a {format(calcularSemanaAnterior().periodo_fim, "dd/MM")}</p>
                  <p>• Semana atual: {format(calcularSemanaOperacional().periodo_inicio, "dd/MM")} a {format(calcularSemanaOperacional().periodo_fim, "dd/MM")}</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    size="sm"
                    className={cn(
                      "w-full sm:w-auto",
                      semanaRespostaModo === "anterior" && "ring-2 ring-orange-500"
                    )}
                    onClick={() => {
                      setSemanaResposta(calcularSemanaAnterior());
                      setSemanaRespostaModo("anterior");
                      resetarFormularioParaNovaSemana();
                    }}
                  >
                    Responder semana anterior (pendente)
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "w-full sm:w-auto",
                      semanaRespostaModo === "atual" && "ring-2 ring-orange-500"
                    )}
                    onClick={() => {
                      setSemanaResposta(calcularSemanaOperacional());
                      setSemanaRespostaModo("atual");
                      resetarFormularioParaNovaSemana();
                    }}
                  >
                    Responder semana atual
                  </Button>
                </div>

                {/* Indicador da semana selecionada */}
                <p className="text-xs text-orange-700 dark:text-orange-300 mt-3 font-medium">
                  ✓ Respondendo: {semanaRespostaModo === "anterior" ? "Semana anterior" : "Semana atual"} ({format(semanaResposta.periodo_inicio, "dd/MM")} a {format(semanaResposta.periodo_fim, "dd/MM")})
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Banner: Dia não permitido (apenas se não for exceção de domingo) */}
        {!hojePermitidoEfetivo && formConfig && (
          <Card className="p-4 bg-amber-50 dark:bg-amber-950 border-amber-300 dark:border-amber-700">
            <div className="flex items-start gap-3">
              <div className="text-2xl">⚠️</div>
              <div>
                <h4 className="font-semibold text-amber-900 dark:text-amber-100 mb-1">Dia não permitido para responder</h4>
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  Este formulário só pode ser respondido nos seguintes dias:
                  <strong className="ml-1">
                    {(formConfig.dias_semana || []).map((d: number) => DIAS_SEMANA_NOMES[d]).join(", ")}
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
        {formConfig?.limite_respostas === "unica" && existingReport && (
          <Card className="p-4 bg-blue-50 dark:bg-blue-950 border-blue-300 dark:border-blue-700">
            <div className="flex items-start gap-3">
              <div className="text-2xl">ℹ️</div>
              <div>
                <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">Relatório já enviado</h4>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Esta divisão (<strong>{divisaoSelecionada?.nome}</strong>) já possui um relatório enviado nesta semana em{" "}
                  <strong>{new Date(existingReport.created_at).toLocaleString("pt-BR")}</strong>
                  {existingReport.profile_id !== user?.id && (
                    <span>
                      {" "}
                      por <strong>{existingReport.responsavel_nome_colete}</strong>
                    </span>
                  )}
                  .
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-2">
                  Como este formulário permite apenas <strong>1 relatório por semana para cada divisão</strong>, não é
                  possível enviar outro. Se precisar corrigir informações, entre em contato com o ADM Regional.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Banner: Limite 'multipla' - opção de editar ou sobrescrever */}
        {formConfig?.limite_respostas === "multipla" && existingReport && !modoEdicao && (
          <Card className="p-3 sm:p-4 bg-purple-50 dark:bg-purple-950 border-purple-300 dark:border-purple-700">
            <div className="flex items-start gap-2 sm:gap-3">
              <div className="text-xl sm:text-2xl shrink-0">🔄</div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-1 text-sm sm:text-base">
                  Relatório já enviado
                </h4>
                <p className="text-xs sm:text-sm text-purple-800 dark:text-purple-200 mb-3 break-words">
                  A divisão <strong>{divisaoSelecionada?.nome}</strong> já possui um relatório enviado em{" "}
                  <strong>{new Date(existingReport.created_at).toLocaleString("pt-BR")}</strong>
                  {existingReport.profile_id !== user?.id && (
                    <span>
                      {" "}
                      por <strong>{existingReport.responsavel_nome_colete}</strong>
                    </span>
                  )}
                  .
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    size="sm"
                    className="w-full sm:w-auto text-xs sm:text-sm"
                    onClick={() => {
                      setModoEdicao("editar");
                      carregarRespostasExistentes(existingReport);
                    }}
                  >
                    Editar anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto text-xs sm:text-sm"
                    onClick={() => {
                      setModoEdicao("nova");
                      limparFormulario();
                    }}
                  >
                    Sobrescrever
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
                const div = divisoesDisponiveis.find((d) => d.id === e.target.value);
                setDivisaoSelecionada(div);
              }}
            >
              {divisoesDisponiveis.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nome}
                </option>
              ))}
            </select>
          </div>
        </Card>

        {/* Seção: Entradas de Integrantes */}
        <Card className="p-4 sm:p-6 space-y-4">
          <h3 className="font-semibold">Entradas de Integrantes</h3>

          {/* Banner informativo se houve preenchimento automático */}
          {entradasAplicadasAuto && entradas.length > 0 && entradas.some((e: any) => e.origem === "automatico") && (
            <Alert className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
              <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertTitle className="text-green-800 dark:text-green-200">Entradas Detectadas Automaticamente</AlertTitle>
              <AlertDescription className="text-green-700 dark:text-green-300">
                {entradas.filter((e: any) => e.origem === "automatico").length} entrada(s) foi(ram) preenchida(s)
                automaticamente baseada(s) em transferências detectadas. Revise e complete os dados conforme necessário.
              </AlertDescription>
            </Alert>
          )}

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
              {entradas.map((entrada: any, idx: number) => (
                <Card key={idx} className="p-4 space-y-3 bg-muted/50">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium">Entrada #{idx + 1}</h4>
                      {entrada.origem === "delta" && (
                        <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-2 py-0.5 rounded">
                          Detectado na carga
                        </span>
                      )}
                      {(entrada.origem === "sugestao" || entrada.origem === "automatico") && (
                        <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-0.5 rounded">
                          Detectado automaticamente
                        </span>
                      )}
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setEntradas(entradas.filter((_: any, i: number) => i !== idx))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid gap-3">
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
                onClick={() =>
                  setEntradas([
                    ...entradas,
                    {
                      nome_colete: "",
                      data_entrada: "",
                      motivo_entrada: "",
                      possui_carro: false,
                      possui_moto: false,
                      nenhum: false,
                    },
                  ])
                }
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
          divisaoAtual={divisaoSelecionada?.nome}
          saidasAplicadasAuto={saidasAplicadasAuto}
        />

        {/* Seção: Inadimplência */}
        <SecaoInadimplencia inadimplencias={inadimplencias} setInadimplencias={setInadimplencias} />

        {/* Seção: Conflitos */}
        <Card className="p-4 sm:p-6 space-y-4">
          <h3 className="font-semibold">Conflitos Internos e Externos</h3>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Houve conflitos esta semana?</p>
            <div className="flex gap-2">
              <Button type="button" variant={teveConflitos ? "default" : "outline"} className="min-h-[44px]" onClick={() => setTeveConflitos(true)}>
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
              {conflitos.map((conflito: any, idx: number) => (
                <Card key={idx} className="p-4 space-y-3 bg-muted/50">
                  <div className="flex justify-between items-start">
                    <h4 className="text-sm font-medium">Conflito #{idx + 1}</h4>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setConflitos(conflitos.filter((_: any, i: number) => i !== idx))}>
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
                onClick={() =>
                  setConflitos([
                    ...conflitos,
                    {
                      data_ocorrencia: "",
                      descricao: "",
                    },
                  ])
                }
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Conflito
              </Button>
            </div>
          )}
        </Card>

        {/* Seção: Ações Sociais */}
        <Card className="p-4 sm:p-6 space-y-4">
          <h3 className="font-semibold">Ações Sociais</h3>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Houve ações sociais esta semana?</p>
            <div className="flex gap-2">
              <Button type="button" variant={teveAcoesSociais ? "default" : "outline"} className="min-h-[44px]" onClick={() => setTeveAcoesSociais(true)}>
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
              {acoesSociais.map((acao: any, idx: number) => (
                <Card
                  key={idx}
                  className={cn(
                    "p-4 space-y-3",
                    acao.marcador_relatorio === "semana_anterior_nao_reportada"
                      ? "bg-yellow-50 dark:bg-yellow-950 border-yellow-300 dark:border-yellow-700"
                      : "bg-muted/50"
                  )}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="text-sm font-medium">Ação Social #{idx + 1}</h4>
                      {acao.marcador_relatorio === "semana_anterior_nao_reportada" && (
                        <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1 font-medium">
                          ⚠️ Esta ação não foi reportada no relatório da semana anterior. Revise e exclua se não fizer
                          sentido manter.
                        </p>
                      )}
                      {acao.origem === "form_acoes_sociais" && (
                        <p className="text-xs text-muted-foreground mt-1">(Importada do formulário de ações sociais)</p>
                      )}
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setAcoesSociais(acoesSociais.filter((_: any, i: number) => i !== idx))}>
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
                onClick={() =>
                  setAcoesSociais([
                    ...acoesSociais,
                    {
                      data_acao: "",
                      titulo: "",
                      status: "",
                    },
                  ])
                }
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Ação Social
              </Button>
            </div>
          )}
        </Card>

        {/* Estatísticas da Divisão */}
        {estatisticas && (
          <Card className="p-4 sm:p-6">
            <h3 className="font-semibold mb-4 text-sm sm:text-base">Estatísticas da Divisão</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm">
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
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <Button onClick={() => navigate("/formularios")} variant="outline" className="flex-1 text-sm">
            Cancelar
          </Button>
          <Button
            onClick={handleEnviar}
            className="flex-1 text-sm"
            disabled={!hojePermitidoEfetivo || (formConfig?.limite_respostas === "unica" && existingReport)}
          >
            {existingReport && modoEdicao === "editar"
              ? "Atualizar"
              : existingReport && modoEdicao === "nova"
              ? "Sobrescrever"
              : "Enviar Relatório"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FormularioRelatorioSemanal;
