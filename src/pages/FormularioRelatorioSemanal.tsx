import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useIntegrantes } from "@/hooks/useIntegrantes";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { normalizeText, getSemanaAtual, formatDateToSQL } from "@/lib/normalizeText";
import { useSubmitRelatorioSemanal } from "@/hooks/useRelatorioSemanal";

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

        // Buscar formulário
        const { data: formulario, error: formularioError } = await supabase
          .from('formularios_catalogo')
          .select('id')
          .eq('link_interno', '/formularios/relatorio-semanal-divisao')
          .eq('regional_id', regional.id)
          .single();

        if (formularioError) throw formularioError;

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
          .filter(i => i.cargo_estagio)
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
        acao_cobranca: null
      })));
    };

    carregarInadimplencias();
  }, [divisaoSelecionada]);

  const handleEnviar = () => {
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

    submitRelatorio(dados, {
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
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* T6: Cabeçalho */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/formularios")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <p className="text-sm text-muted-foreground">Regional {dadosResponsavel?.regional_texto}</p>
            <h1 className="text-2xl font-bold">Relatório Semanal da Divisão</h1>
          </div>
        </div>

        {/* Dados do Responsável */}
        <Card className="p-6 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
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
              className="w-full mt-1 p-2 border rounded"
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
          <Button onClick={handleEnviar} className="flex-1">
            Enviar Relatório
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FormularioRelatorioSemanal;
