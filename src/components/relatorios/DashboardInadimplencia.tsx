import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useMensalidades } from '@/hooks/useMensalidades';
import { AlertTriangle, TrendingUp, Users, DollarSign } from 'lucide-react';

export const DashboardInadimplencia = () => {
  const { ultimaCargaInfo, devedoresAtivos, devedoresCronicos } = useMensalidades();

  // Calcular totais a partir da view vw_devedores_ativos
  const totalDevedores = devedoresAtivos.length;
  const totalDebito = devedoresAtivos.reduce((sum, d) => sum + (d.total_devido || 0), 0);
  const totalCronicos = devedoresCronicos.length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Devedores */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Devedores Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{totalDevedores}</div>
            <p className="text-xs text-muted-foreground">pessoas com débitos ativos</p>
          </CardContent>
        </Card>

        {/* Total Débitos */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total em Débitos</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              R$ {totalDebito.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">valor total de mensalidades em atraso</p>
          </CardContent>
        </Card>

        {/* Devedores Crônicos */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Devedores Crônicos</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">{totalCronicos}</div>
            <p className="text-xs text-muted-foreground">deveram 3+ meses diferentes</p>
          </CardContent>
        </Card>

        {/* Média por Devedor */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Média por Devedor</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {totalDevedores > 0 ? (totalDebito / totalDevedores).toFixed(2) : '0.00'}
            </div>
            <p className="text-xs text-muted-foreground">valor médio de débito</p>
          </CardContent>
        </Card>
      </div>

      {/* Top 10 Devedores Crônicos */}
      <Card>
        <CardHeader>
          <CardTitle>Top 10 Devedores Crônicos</CardTitle>
          <CardDescription>
            Integrantes que deveram mensalidades em 3 ou mais meses diferentes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {devedoresCronicos.slice(0, 10).map((devedor, index) => (
              <div 
                key={devedor.registro_id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Badge variant="destructive" className="text-lg font-bold w-8 h-8 flex items-center justify-center">
                    {index + 1}
                  </Badge>
                  <div>
                    <p className="font-semibold">{devedor.nome_colete}</p>
                    <p className="text-sm text-muted-foreground">{devedor.divisao_texto}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-red-600">
                    {devedor.total_meses_historico} meses
                  </p>
                  <p className="text-sm text-muted-foreground">
                    R$ {devedor.total_historico_devido?.toFixed(2) || '0.00'}
                  </p>
                </div>
              </div>
            ))}
            {devedoresCronicos.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                Nenhum devedor crônico identificado
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Devedores Ativos por Divisão */}
      <Card>
        <CardHeader>
          <CardTitle>Distribuição por Divisão</CardTitle>
          <CardDescription>
            Quantidade de devedores ativos em cada divisão
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from(
              devedoresAtivos.reduce((acc, d) => {
                const count = acc.get(d.divisao_texto) || 0;
                acc.set(d.divisao_texto, count + 1);
                return acc;
              }, new Map<string, number>())
            )
              .sort((a, b) => b[1] - a[1])
              .map(([divisao, count]) => (
                <div 
                  key={divisao}
                  className="flex items-center justify-between p-2 border-l-4 border-orange-500 pl-3"
                >
                  <span className="text-sm font-medium">{divisao}</span>
                  <Badge variant="secondary">{count} {count === 1 ? 'devedor' : 'devedores'}</Badge>
                </div>
              ))}
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
