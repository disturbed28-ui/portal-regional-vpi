import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useBuscaIntegrante } from "@/hooks/useIntegrantes";
import { Search } from "lucide-react";

interface IntegranteLookupProps {
  onSelect: (integrante: any) => void;
  excludeVinculados?: boolean;
  selectedId?: string;
}

export const IntegranteLookup = ({ 
  onSelect, 
  excludeVinculados = false,
  selectedId 
}: IntegranteLookupProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const { resultados, loading } = useBuscaIntegrante(searchTerm);

  const integrantesFiltrados = excludeVinculados
    ? resultados.filter((i) => !i.vinculado)
    : resultados;

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome de colete..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading && searchTerm && (
        <p className="text-sm text-muted-foreground">Buscando...</p>
      )}

      {integrantesFiltrados.length > 0 && (
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {integrantesFiltrados.map((integrante) => (
            <Card
              key={integrante.id}
              className={`p-3 cursor-pointer hover:bg-accent transition-colors ${
                selectedId === integrante.id ? 'border-primary bg-accent' : ''
              }`}
              onClick={() => onSelect(integrante)}
            >
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <p className="font-semibold">{integrante.nome_colete}</p>
                  <p className="text-sm text-muted-foreground">
                    Registro: {integrante.registro_id}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {integrante.cargo_grau_texto}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {integrante.divisao_texto} - {integrante.regional_texto}
                  </p>
                </div>
                <div>
                  {integrante.vinculado ? (
                    <Badge variant="secondary">Vinculado</Badge>
                  ) : (
                    <Badge variant="outline">Disponivel</Badge>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {searchTerm && !loading && integrantesFiltrados.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhum integrante encontrado
        </p>
      )}
    </div>
  );
};
