import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft } from "lucide-react";
import { normalizeText } from "@/lib/normalizeText";
import { useTiposAcaoSocial } from "@/hooks/useTiposAcaoSocial";
import { useSubmitAcaoSocial, type DadosAcaoSocial } from "@/hooks/useSubmitAcaoSocial";
import { useToast } from "@/hooks/use-toast";

const FormularioAcoesSociais = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const { tipos, loading: loadingTipos } = useTiposAcaoSocial();
  const { mutate: submitAcaoSocial, isPending: submitting } = useSubmitAcaoSocial();
  const { toast } = useToast();

  const [carregando, setCarregando] = useState(true);
  const [dadosResponsavel, setDadosResponsavel] = useState<any>(null);
  const [divisaoSelecionada, setDivisaoSelecionada] = useState<any>(null);
  const [divisoesDisponiveis, setDivisoesDisponiveis] = useState<any[]>([]);
  const [formularioId, setFormularioId] = useState<string | null>(null);

  // Campos do formulário
  const [dataAcao, setDataAcao] = useState("");
  const [escopoAcao, setEscopoAcao] = useState<'interna' | 'externa' | "">("");
  const [tipoAcaoId, setTipoAcaoId] = useState("");
  const [descricaoAcao, setDescricaoAcao] = useState("");

  // Carregamento inicial: contexto do responsável e divisões
  useEffect(() => {
    const carregarContexto = async () => {
      if (!user?.id || !profile) {
        setCarregando(false);
        return;
      }

      try {
        // 1. Buscar integrante_portal ativo do usuário
        const { data: integrante, error: integranteError } = await supabase
          .from('integrantes_portal')
          .select('*')
          .eq('profile_id', user.id)
          .eq('ativo', true)
          .maybeSingle();

        if (integranteError) throw integranteError;
        if (!integrante) {
          console.log("Integrante não encontrado ou inativo");
          setCarregando(false);
          return;
        }

        console.log("Integrante encontrado:", integrante);

        // 2. Normalizar regional_texto e buscar regional real
        const regionalNormalizada = normalizeText(integrante.regional_texto);
        const { data: regionais, error: regionaisError } = await supabase
          .from('regionais')
          .select('*');

        if (regionaisError) throw regionaisError;

        const regionalEncontrada = regionais?.find(
          (r) => normalizeText(r.nome) === regionalNormalizada
        );

        if (!regionalEncontrada) {
          console.log("Regional não encontrada para:", integrante.regional_texto);
          setCarregando(false);
          return;
        }

        console.log("Regional encontrada:", regionalEncontrada);

        // 3. Buscar divisões da regional
        const { data: divisoes, error: divisoesError } = await supabase
          .from('divisoes')
          .select('*')
          .eq('regional_id', regionalEncontrada.id)
          .order('nome');

        if (divisoesError) throw divisoesError;
        setDivisoesDisponiveis(divisoes || []);

        // 4. Encontrar divisão padrão (divisão do integrante)
        const divisaoNormalizada = normalizeText(integrante.divisao_texto);
        const divisaoPadrao = divisoes?.find(
          (d) => normalizeText(d.nome) === divisaoNormalizada
        ) || divisoes?.[0];

        setDivisaoSelecionada(divisaoPadrao);

        // 5. Buscar formulário no catálogo
        const { data: formulario, error: formularioError } = await supabase
          .from('formularios_catalogo')
          .select('*')
          .eq('link_interno', '/formularios/acoes_sociais')
          .eq('regional_id', regionalEncontrada.id)
          .eq('ativo', true)
          .maybeSingle();

        if (formularioError) throw formularioError;
        setFormularioId(formulario?.id || null);

        // 6. Montar dados do responsável
        setDadosResponsavel({
          integrante_id: integrante.id,
          nome_colete: integrante.nome_colete,
          cargo_nome: integrante.cargo_nome,
          divisao_texto: integrante.divisao_texto,
          regional_texto: integrante.regional_texto,
          comando_texto: integrante.comando_texto,
          regional_id: regionalEncontrada.id
        });

        console.log("Contexto carregado com sucesso");
      } catch (error) {
        console.error("Erro ao carregar contexto:", error);
        toast({
          title: "Erro ao carregar dados",
          description: "Não foi possível carregar as informações necessárias.",
          variant: "destructive"
        });
      } finally {
        setCarregando(false);
      }
    };

    carregarContexto();
  }, [user, profile, toast]);

  const handleSubmit = async () => {
    // Validações
    if (!dataAcao || !escopoAcao || !tipoAcaoId) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios (*)",
        variant: "destructive"
      });
      return;
    }

    if (!divisaoSelecionada || !dadosResponsavel) {
      toast({
        title: "Erro",
        description: "Dados do responsável ou divisão não encontrados",
        variant: "destructive"
      });
      return;
    }

    // Buscar nome do tipo de ação para snapshot
    const tipoSelecionado = tipos.find(t => t.id === tipoAcaoId);
    if (!tipoSelecionado) return;

    // Montar payload
    const payload: DadosAcaoSocial = {
      formulario_id: formularioId,
      profile_id: user!.id,
      integrante_portal_id: dadosResponsavel.integrante_id,
      responsavel_nome_colete: dadosResponsavel.nome_colete,
      responsavel_cargo_nome: dadosResponsavel.cargo_nome || null,
      responsavel_divisao_texto: dadosResponsavel.divisao_texto,
      responsavel_regional_texto: dadosResponsavel.regional_texto,
      responsavel_comando_texto: dadosResponsavel.comando_texto,
      regional_relatorio_id: dadosResponsavel.regional_id,
      regional_relatorio_texto: dadosResponsavel.regional_texto,
      divisao_relatorio_id: divisaoSelecionada.id,
      divisao_relatorio_texto: divisaoSelecionada.nome,
      data_acao: dataAcao,
      escopo_acao: escopoAcao,
      tipo_acao_id: tipoAcaoId,
      tipo_acao_nome_snapshot: tipoSelecionado.nome,
      descricao_acao: descricaoAcao || null
    };

    // Enviar (SEMPRE INSERT)
    submitAcaoSocial(payload, {
      onSuccess: () => {
        // Limpar APENAS os campos do formulário
        setDataAcao("");
        setEscopoAcao("");
        setTipoAcaoId("");
        setDescricaoAcao("");
        
        // NÃO limpar dadosResponsavel nem divisaoSelecionada
      }
    });
  };

  if (carregando || loadingTipos) {
    return (
      <div className="min-h-screen bg-background">
        <div className="bg-vp1-primary text-white p-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="text-white hover:bg-white/20"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">Ações Sociais</h1>
          </div>
        </div>
        <div className="p-4">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!dadosResponsavel) {
    return (
      <div className="min-h-screen bg-background">
        <div className="bg-vp1-primary text-white p-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="text-white hover:bg-white/20"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">Ações Sociais</h1>
          </div>
        </div>
        <div className="p-4 max-w-2xl mx-auto">
          <Card className="p-6">
            <p className="text-destructive">
              Você precisa estar cadastrado como integrante ativo para acessar este formulário.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-vp1-primary text-white p-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="text-white hover:bg-white/20"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Ações Sociais</h1>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {/* Card: Dados do Responsável */}
        <Card className="p-4 sm:p-6 space-y-3">
          <h3 className="font-semibold text-sm text-muted-foreground">Dados do Responsável</h3>
          <div className="grid gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Nome:</span>{" "}
              <strong>{dadosResponsavel.nome_colete}</strong>
            </div>
            <div>
              <span className="text-muted-foreground">Cargo:</span>{" "}
              {dadosResponsavel.cargo_nome || 'N/A'}
            </div>
            <div>
              <span className="text-muted-foreground">Divisão:</span>{" "}
              {dadosResponsavel.divisao_texto}
            </div>
            <div>
              <span className="text-muted-foreground">Regional:</span>{" "}
              {dadosResponsavel.regional_texto}
            </div>
            <div>
              <span className="text-muted-foreground">Comando:</span>{" "}
              {dadosResponsavel.comando_texto}
            </div>
          </div>
        </Card>

        {/* Card: Divisão da Ação */}
        <Card className="p-4 sm:p-6 space-y-3">
          <h3 className="font-semibold">Divisão da Ação Social</h3>
          <p className="text-sm text-muted-foreground">
            Selecione a divisão responsável pela ação social (padrão: sua divisão)
          </p>
          <select
            className="w-full p-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            value={divisaoSelecionada?.id || ""}
            onChange={(e) => {
              const div = divisoesDisponiveis.find(d => d.id === e.target.value);
              setDivisaoSelecionada(div || null);
            }}
          >
            {divisoesDisponiveis.map((div) => (
              <option key={div.id} value={div.id}>{div.nome}</option>
            ))}
          </select>
        </Card>

        {/* Card: Dados da Ação */}
        <Card className="p-4 sm:p-6 space-y-4">
          <h3 className="font-semibold">Dados da Ação Social</h3>

          {/* Data da Ação */}
          <div>
            <label className="text-sm font-medium">Data da Ação *</label>
            <input
              type="date"
              className="w-full mt-1 p-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              value={dataAcao}
              onChange={(e) => setDataAcao(e.target.value)}
              required
            />
          </div>

          {/* Escopo da Ação */}
          <div>
            <label className="text-sm font-medium">Escopo da Ação *</label>
            <select
              className="w-full mt-1 p-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              value={escopoAcao}
              onChange={(e) => setEscopoAcao(e.target.value as 'interna' | 'externa')}
              required
            >
              <option value="">Selecione...</option>
              <option value="interna">Interna (ajuda ao integrante)</option>
              <option value="externa">Externa</option>
            </select>
          </div>

          {/* Tipo da Ação */}
          <div>
            <label className="text-sm font-medium">Tipo da Ação *</label>
            <select
              className="w-full mt-1 p-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              value={tipoAcaoId}
              onChange={(e) => setTipoAcaoId(e.target.value)}
              required
            >
              <option value="">Selecione...</option>
              {tipos.map((tipo) => (
                <option key={tipo.id} value={tipo.id}>{tipo.nome}</option>
              ))}
            </select>
          </div>

          {/* Descrição da Ação */}
          <div>
            <label className="text-sm font-medium">Descrição da Ação</label>
            <Textarea
              className="mt-1"
              rows={4}
              value={descricaoAcao}
              onChange={(e) => setDescricaoAcao(e.target.value)}
              placeholder="Descreva a ação social realizada..."
            />
          </div>
        </Card>

        {/* Botão de Envio */}
        <Button
          onClick={handleSubmit}
          disabled={submitting || !dataAcao || !escopoAcao || !tipoAcaoId}
          className="w-full min-h-[44px]"
        >
          {submitting ? "Enviando..." : "Registrar Ação Social"}
        </Button>
      </div>
    </div>
  );
};

export default FormularioAcoesSociais;
