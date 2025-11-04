import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { formatRef } from '@/lib/mensalidadesParser';
import { formatarDataBrasil } from '@/lib/timezone';

export const HistoricoDevedores = () => {
  const [filtroNome, setFiltroNome] = useState('');
  const [filtroDivisao, setFiltroDivisao] = useState<string>('todos');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');

  // Buscar histórico completo
  const { data: historicoCompleto = [], isLoading } = useQuery({
    queryKey: ['historico-mensalidades'],
    queryFn: async () => {
      const { data } = await supabase
        .from('mensalidades_atraso')
        .select('*')
        .order('data_carga', { ascending: false });
      return data || [];
    }
  });

  // Buscar devedores crônicos
  const { data: devedoresCronicosData = [] } = useQuery({
    queryKey: ['devedores-cronicos'],
    queryFn: async () => {
      const { data } = await supabase
        .from('vw_devedores_cronicos')
        .select('registro_id');
      return data || [];
    }
  });

  const devedoresCronicos = new Set(devedoresCronicosData.map(d => d.registro_id));

  // Buscar divisões únicas para filtro
  const divisoesUnicas = Array.from(new Set(historicoCompleto.map(h => h.divisao_texto))).sort();

  // Aplicar filtros
  const historicoFiltrado = historicoCompleto.filter(item => {
    const matchNome = item.nome_colete.toLowerCase().includes(filtroNome.toLowerCase());
    const matchDivisao = filtroDivisao === 'todos' || item.divisao_texto === filtroDivisao;
    const matchStatus = 
      filtroStatus === 'todos' ||
      (filtroStatus === 'ativo' && item.ativo && !item.liquidado) ||
      (filtroStatus === 'liquidado' && item.liquidado);
    
    return matchNome && matchDivisao && matchStatus;
  });

  if (isLoading) {
    return <div className="p-8 text-center">Carregando histórico...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico Completo de Mensalidades</CardTitle>
        <CardDescription>
          Visualize todo o histórico de inadimplência, incluindo liquidações automáticas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            placeholder="Buscar por nome..."
            value={filtroNome}
            onChange={(e) => setFiltroNome(e.target.value)}
          />
          <Select value={filtroDivisao} onValueChange={setFiltroDivisao}>
            <SelectTrigger>
              <SelectValue placeholder="Todas as divisões" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as divisões</SelectItem>
              {divisoesUnicas.map(d => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Todos os status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ativo">Ativos</SelectItem>
              <SelectItem value="liquidado">Liquidados</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tabela */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome Colete</TableHead>
                <TableHead>Divisão</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data Liquidação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historicoFiltrado.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Nenhum registro encontrado
                  </TableCell>
                </TableRow>
              ) : (
                historicoFiltrado.map((item) => {
                  const isCronico = devedoresCronicos.has(item.registro_id);
                  
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {item.nome_colete}
                          {isCronico && (
                            <Badge variant="destructive" className="text-xs">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Crônico
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{item.divisao_texto}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatRef(item.ref)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatarDataBrasil(item.data_vencimento, 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        R$ {item.valor.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {item.liquidado ? (
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Liquidado
                          </Badge>
                        ) : item.ativo ? (
                          <Badge variant="destructive">
                            Ativo
                          </Badge>
                        ) : (
                          <Badge variant="outline">Inativo</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.data_liquidacao 
                          ? formatarDataBrasil(item.data_liquidacao)
                          : '-'
                        }
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Resumo */}
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>Total: {historicoFiltrado.length} registros</span>
          <span>Ativos: {historicoFiltrado.filter(h => h.ativo && !h.liquidado).length}</span>
          <span>Liquidados: {historicoFiltrado.filter(h => h.liquidado).length}</span>
        </div>
      </CardContent>
    </Card>
  );
};
