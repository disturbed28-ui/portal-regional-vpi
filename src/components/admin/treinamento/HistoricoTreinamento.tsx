import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, FileText, Loader2 } from "lucide-react";
import { useHistoricoTreinamento } from "@/hooks/useHistoricoTreinamento";
import { DivisaoTreinamentoCard } from "./DivisaoTreinamentoCard";
import { ReadOnlyBanner } from "@/components/ui/read-only-banner";

interface HistoricoTreinamentoProps {
  userId?: string;
  readOnly?: boolean;
}

export const HistoricoTreinamento = ({ userId, readOnly = false }: HistoricoTreinamentoProps) => {
  const {
    treinamentosPorDivisao,
    divisoesDisponiveis,
    loading,
    error,
    filtroStatus,
    setFiltroStatus,
    filtroDivisao,
    setFiltroDivisao,
    filtroNome,
    setFiltroNome,
    totalRegistros,
  } = useHistoricoTreinamento({ userId });

  if (loading) {
    return (
      <Card className="border-border/50">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-border/50">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm text-destructive">Erro ao carregar histórico: {error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Banner de somente leitura */}
      {readOnly && <ReadOnlyBanner />}

      {/* Filtros */}
      <Card className="border-border/50">
        <CardContent className="p-3 space-y-3">
          {/* Linha 1: Status e Divisão */}
          <div className="grid grid-cols-2 gap-2">
            <Select
              value={filtroStatus}
              onValueChange={(value) => setFiltroStatus(value as "todos" | "em_andamento" | "concluido")}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="em_andamento">Em Andamento</SelectItem>
                <SelectItem value="concluido">Concluído</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filtroDivisao}
              onValueChange={setFiltroDivisao}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Divisão" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as divisões</SelectItem>
                {divisoesDisponiveis.map((div) => (
                  <SelectItem key={div.id} value={div.id}>
                    {div.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Linha 2: Busca por nome */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome de colete..."
              value={filtroNome}
              onChange={(e) => setFiltroNome(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>

          {/* Contador */}
          <div className="text-xs text-muted-foreground text-center">
            {totalRegistros} registro{totalRegistros !== 1 ? "s" : ""} encontrado{totalRegistros !== 1 ? "s" : ""}
          </div>
        </CardContent>
      </Card>

      {/* Lista de treinamentos agrupados por divisão */}
      {treinamentosPorDivisao.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Nenhum registro encontrado</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Não há treinamentos aprovados ou concluídos que correspondam aos filtros selecionados.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {treinamentosPorDivisao.map((divisao) => (
            <DivisaoTreinamentoCard key={divisao.divisao_id} divisao={divisao} />
          ))}
        </div>
      )}
    </div>
  );
};
