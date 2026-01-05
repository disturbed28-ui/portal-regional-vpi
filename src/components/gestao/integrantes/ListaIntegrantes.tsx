import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Users, Filter } from "lucide-react";
import { useIntegrantesGestao } from "@/hooks/useIntegrantesGestao";
import { useGerenciarIntegrante } from "@/hooks/useGerenciarIntegrante";
import { IntegranteCard } from "./IntegranteCard";
import { ModalEditarIntegrante } from "./ModalEditarIntegrante";
import { ModalInativarIntegrante } from "./ModalInativarIntegrante";
import { IntegrantePortal } from "@/hooks/useIntegrantes";

interface ListaIntegrantesProps {
  userId: string | undefined;
}

export function ListaIntegrantes({ userId }: ListaIntegrantesProps) {
  const {
    escopo,
    integrantesPorDivisao,
    totalIntegrantes,
    regionaisDisponiveis,
    divisoesDisponiveis,
    filtroRegional,
    setFiltroRegional,
    filtroDivisao,
    setFiltroDivisao,
    filtroBusca,
    setFiltroBusca,
    loading,
    refetch,
  } = useIntegrantesGestao(userId);

  const { editarIntegrante, inativarIntegrante, operando } = useGerenciarIntegrante();

  // Estado dos modais
  const [integranteEditar, setIntegranteEditar] = useState<IntegrantePortal | null>(null);
  const [integranteInativar, setIntegranteInativar] = useState<IntegrantePortal | null>(null);

  const handleSalvarEdicao = async (dadosNovos: Record<string, any>, observacao: string) => {
    if (!integranteEditar || !userId) return false;
    const success = await editarIntegrante(integranteEditar, dadosNovos, observacao, userId);
    if (success) {
      refetch();
    }
    return success;
  };

  const handleConfirmarInativacao = async (motivo: string, justificativa: string) => {
    if (!integranteInativar || !userId) return false;
    const success = await inativarIntegrante(integranteInativar, motivo, justificativa, userId);
    if (success) {
      refetch();
    }
    return success;
  };

  // Mostrar filtro de regional apenas para Grau I-IV
  const mostrarFiltroRegional = escopo.nivelAcesso === 'comando';
  // Mostrar filtro de divisão para Grau I-V
  const mostrarFiltroDivisao = escopo.nivelAcesso !== 'divisao';

  if (loading) {
    return (
      <Card className="border-border/50">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-sm text-muted-foreground">Carregando integrantes...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card className="border-border/50">
        <CardContent className="p-3 sm:p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Filter className="h-4 w-4" />
            <span>Filtros</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Filtro Regional */}
            {mostrarFiltroRegional && (
              <div className="space-y-1.5">
                <Label className="text-xs">Regional</Label>
                <Select 
                  value={filtroRegional || "__all__"} 
                  onValueChange={(val) => setFiltroRegional(val === "__all__" ? "" : val)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Todas as regionais" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas as regionais</SelectItem>
                    {regionaisDisponiveis.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Filtro Divisão */}
            {mostrarFiltroDivisao && (
              <div className="space-y-1.5">
                <Label className="text-xs">Divisão</Label>
                <Select
                  value={filtroDivisao || "__all__"}
                  onValueChange={(val) => setFiltroDivisao(val === "__all__" ? "" : val)}
                  disabled={mostrarFiltroRegional && !filtroRegional}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Todas as divisões" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas as divisões</SelectItem>
                    {divisoesDisponiveis.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Busca por nome */}
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
              <Label className="text-xs">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={filtroBusca}
                  onChange={(e) => setFiltroBusca(e.target.value)}
                  placeholder="Nome de colete..."
                  className="h-9 pl-8"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contador */}
      <div className="flex items-center gap-2 px-1">
        <Users className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">
          {totalIntegrantes} integrante{totalIntegrantes !== 1 ? 's' : ''} encontrado{totalIntegrantes !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Lista agrupada por divisão */}
      {integrantesPorDivisao.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Nenhum integrante encontrado</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Tente ajustar os filtros para encontrar integrantes.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Accordion type="multiple" defaultValue={[]} className="space-y-2">
          {integrantesPorDivisao.map((grupo) => (
            <AccordionItem
              key={grupo.divisaoId || 'sem-divisao'}
              value={grupo.divisaoId || 'sem-divisao'}
              className="border border-border/50 rounded-lg overflow-hidden bg-card"
            >
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30">
                <div className="flex items-center gap-3 text-left">
                  <span className="font-semibold text-sm sm:text-base">{grupo.divisaoNome}</span>
                  <Badge variant="secondary" className="text-xs">
                    {grupo.totalAtivos} ativo{grupo.totalAtivos !== 1 ? 's' : ''}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-3 pb-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {grupo.integrantes.map((integrante) => (
                    <IntegranteCard
                      key={integrante.id}
                      integrante={integrante}
                      onEditar={setIntegranteEditar}
                      onInativar={setIntegranteInativar}
                    />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      {/* Modais */}
      <ModalEditarIntegrante
        open={!!integranteEditar}
        onOpenChange={(open) => !open && setIntegranteEditar(null)}
        integrante={integranteEditar}
        onSalvar={handleSalvarEdicao}
        operando={operando}
      />

      <ModalInativarIntegrante
        open={!!integranteInativar}
        onOpenChange={(open) => !open && setIntegranteInativar(null)}
        integrante={integranteInativar}
        onConfirmar={handleConfirmarInativacao}
        operando={operando}
      />
    </div>
  );
}
