import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { useInadimplenciaFiltrada } from '@/hooks/useInadimplenciaFiltrada';
import { AlertTriangle, Users, DollarSign, ChevronDown } from 'lucide-react';

interface DashboardInadimplenciaProps {
  userId: string | undefined;
}

export const DashboardInadimplencia = ({ userId }: DashboardInadimplenciaProps) => {
  const { ultimaCargaInfo, devedoresAtivos, devedoresCronicos } = useInadimplenciaFiltrada(userId);

  // Calcular totais a partir da view vw_devedores_ativos
  const totalDevedores = devedoresAtivos.length;
  const totalDebito = devedoresAtivos.reduce((sum, d) => sum + (d.total_devido || 0), 0);
  const totalCronicos = devedoresCronicos.length;

  return (
    <div className="space-y-3 sm:space-y-6">
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
                .map(([divisao, devedores]) => (
                  <Collapsible key={divisao}>
                    <div className="border rounded-lg overflow-hidden">
                      <CollapsibleTrigger className="w-full hover:bg-muted/50 transition-colors">
                        <div className="flex items-center justify-between p-2 sm:p-3 border-l-4 border-orange-500">
                          <div className="flex items-center gap-2">
                            <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 transition-transform data-[state=open]:rotate-180" />
                            <span className="text-xs sm:text-sm font-medium truncate">{divisao}</span>
                          </div>
                          <Badge variant="secondary" className="text-[10px] sm:text-xs">
                            {devedores.length}
                          </Badge>
                        </div>
                      </CollapsibleTrigger>
                      
                      <CollapsibleContent>
                        <div className="px-2 sm:px-4 py-2 sm:py-3 space-y-2 bg-muted/20 border-t">
                          {devedores.map((devedor) => (
                            <div 
                              key={devedor.registro_id} 
                              className="flex items-center justify-between p-2 bg-background rounded border"
                            >
                              <div className="flex flex-col min-w-0 flex-1">
                                <span className="font-medium text-xs sm:text-sm text-foreground truncate">{devedor.nome_colete}</span>
                                <span className="font-mono text-[10px] sm:text-xs text-muted-foreground">
                                  ID: {devedor.registro_id}
                                </span>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <div className="text-xs sm:text-sm font-semibold text-red-600">
                                  R$ {devedor.total_devido?.toFixed(2)}
                                </div>
                                <div className="text-[10px] sm:text-xs font-medium text-foreground/70">
                                  {devedor.meses_devendo}m
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                ));
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
