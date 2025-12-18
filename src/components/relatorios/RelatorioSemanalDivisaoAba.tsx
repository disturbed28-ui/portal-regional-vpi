import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useScreenAccess } from '@/hooks/useScreenAccess';
import { useRegionais } from '@/hooks/useRegionais';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileSpreadsheet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RelatorioSemanalDetalheDialog } from './RelatorioSemanalDetalheDialog';
import { RelatorioSemanalResumo } from './RelatorioSemanalResumo';
import { toast } from 'sonner';
import { calcularSemanaOperacional } from '@/lib/normalizeText';

const CMD_REGIONAL_ID = 'da8de519-f9c1-45cb-9d26-af56b7c4aa6d';

const MESES = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' },
];

interface DivisaoStatus {
  id: string;
  nome: string;
  regionalNome?: string;
  enviado: boolean;
}

export const RelatorioSemanalDivisaoAba = () => {
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const { hasAccess, loading: loadingAccess } = useScreenAccess('/relatorios/semanal-divisao', user?.id);
  const { regionais } = useRegionais();

  // Calcular semana atual para pré-seleção
  const semanaAtual = useMemo(() => calcularSemanaOperacional(), []);

  const [regionalSelecionada, setRegionalSelecionada] = useState<string>('');
  const [mesSelecionado, setMesSelecionado] = useState(semanaAtual.mes_referencia);
  const [anoSelecionado, setAnoSelecionado] = useState(semanaAtual.ano_referencia);
  const [semanaSelecionada, setSemanaSelecionada] = useState(semanaAtual.semana_no_mes);
  
  const [divisoesStatus, setDivisoesStatus] = useState<DivisaoStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [exportando, setExportando] = useState(false);
  
  // Estados para controle do dialog de detalhes
  const [dialogOpen, setDialogOpen] = useState(false);
  const [divisaoSelecionadaDialog, setDivisaoSelecionadaDialog] = useState<string | null>(null);
  
  const isUsuarioCMD = profile?.regional_id === CMD_REGIONAL_ID;

  // Pré-selecionar regional do usuário (se não for CMD)
  useEffect(() => {
    if (!isUsuarioCMD && profile?.regional_id) {
      setRegionalSelecionada(profile.regional_id);
    } else if (isUsuarioCMD) {
      setRegionalSelecionada('todas');
    }
  }, [profile, isUsuarioCMD]);

  const buscarStatus = async () => {
    if (!regionalSelecionada) return;
    
    setLoading(true);
    
    try {
      // 1. Buscar divisões
      let divisoesQuery = supabase
        .from('divisoes')
        .select('id, nome, regional_id, regionais(nome)')
        .order('nome');
      
      if (regionalSelecionada !== 'todas') {
        divisoesQuery = divisoesQuery.eq('regional_id', regionalSelecionada);
      }
      
      const { data: divisoes, error: divisoesError } = await divisoesQuery;
      
      if (divisoesError) {
        console.error('Erro ao buscar divisões:', divisoesError);
        setLoading(false);
        return;
      }

      // 2. Buscar relatórios existentes para o período
      const { data: relatorios, error: relatoriosError } = await supabase
        .from('relatorios_semanais_divisao')
        .select('divisao_relatorio_id')
        .eq('ano_referencia', anoSelecionado)
        .eq('mes_referencia', mesSelecionado)
        .eq('semana_no_mes', semanaSelecionada);
      
      if (relatoriosError) {
        console.error('Erro ao buscar relatórios:', relatoriosError);
        setLoading(false);
        return;
      }

      // 3. Criar Set de divisões que enviaram
      const divisoesEnviaram = new Set(relatorios?.map(r => r.divisao_relatorio_id) || []);

      // 4. Mapear status
      const status: DivisaoStatus[] = divisoes?.map(d => ({
        id: d.id,
        nome: d.nome,
        regionalNome: (d.regionais as any)?.nome,
        enviado: divisoesEnviaram.has(d.id)
      })) || [];

      setDivisoesStatus(status);
    } catch (error) {
      console.error('Erro ao buscar status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportarRelatorioCMD = async () => {
    if (!regionalSelecionada || regionalSelecionada === 'todas') {
      toast.error('Selecione uma regional específica para exportar');
      return;
    }
    
    setExportando(true);
    try {
      console.log('[Export] Invocando edge function...', {
        regional_id: regionalSelecionada,
        ano: anoSelecionado,
        mes: mesSelecionado,
        semana: semanaSelecionada
      });

      // Obter session token para autenticação
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        throw new Error('Não autenticado');
      }

      // Fazer requisição direta para obter dados binários sem parsing automático
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-relatorio-cmd`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            regional_id: regionalSelecionada,
            ano: anoSelecionado,
            mes: mesSelecionado,
            semana: semanaSelecionada
          })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Export] Erro HTTP:', response.status, errorText);
        throw new Error(`Erro ao exportar relatório: ${response.status}`);
      }

      // Obter blob diretamente da resposta
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Relatorio_CMD_${anoSelecionado}_${mesSelecionado}_Sem${semanaSelecionada}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Relatório exportado com sucesso!');
    } catch (error) {
      console.error('[Export] Erro ao exportar:', error);
      toast.error('Erro ao exportar relatório. Verifique os logs.');
    } finally {
      setExportando(false);
    }
  };

  if (loadingAccess) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasAccess) {
    return null;
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Filtros */}
      <Card>
        <CardContent className="p-3 sm:pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3">
            {/* Combo Regional */}
            <div className="col-span-2 sm:col-span-1">
              <Select 
                value={regionalSelecionada}
                onValueChange={setRegionalSelecionada}
                disabled={!isUsuarioCMD}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Regional" />
                </SelectTrigger>
                <SelectContent>
                  {isUsuarioCMD && <SelectItem value="todas">Todas as Regionais</SelectItem>}
                  {regionais.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Combo Mês */}
            <div>
              <Select 
                value={mesSelecionado.toString()}
                onValueChange={(v) => setMesSelecionado(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Mês" />
                </SelectTrigger>
                <SelectContent>
                  {MESES.map(m => (
                    <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Campo Ano */}
            <div>
              <Input
                type="number"
                value={anoSelecionado}
                onChange={(e) => setAnoSelecionado(parseInt(e.target.value))}
                min={2020}
                max={2099}
                placeholder="Ano"
              />
            </div>

            {/* Combo Semana */}
            <div>
              <Select 
                value={semanaSelecionada.toString()}
                onValueChange={(v) => setSemanaSelecionada(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Semana" />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map(s => (
                    <SelectItem key={s} value={s.toString()}>Semana {s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Botão Aplicar */}
            <div className="col-span-2 sm:col-span-1">
              <Button 
                onClick={buscarStatus} 
                disabled={loading || !regionalSelecionada}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Carregando...
                  </>
                ) : (
                  'Aplicar'
                )}
              </Button>
            </div>
          </div>
          
        {/* Botão Exportar Relatório CMD */}
        {regionalSelecionada && regionalSelecionada !== 'todas' && (
            <div className="mt-3 pt-3 border-t">
              <Button 
                onClick={handleExportarRelatorioCMD}
                disabled={exportando || !regionalSelecionada || regionalSelecionada === 'todas'}
                variant="outline"
                className="w-full gap-2"
              >
                {exportando ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Gerando relatório...
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="h-4 w-4" />
                    Exportar Relatório CMD
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Grid de Cards */}
      {divisoesStatus.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {divisoesStatus.map(divisao => (
            <Card 
              key={divisao.id} 
              className={cn(
                divisao.enviado ? 'border-green-500' : 'border-orange-500',
                divisao.enviado && 'cursor-pointer hover:shadow-md transition-shadow'
              )}
              onClick={() => {
                if (divisao.enviado) {
                  setDivisaoSelecionadaDialog(divisao.id);
                  setDialogOpen(true);
                }
              }}
            >
              <CardContent className="p-4 space-y-2">
                <div className="font-medium">{divisao.nome}</div>
                {regionalSelecionada === 'todas' && divisao.regionalNome && (
                  <div className="text-sm text-muted-foreground">{divisao.regionalNome}</div>
                )}
                <Badge variant={divisao.enviado ? 'default' : 'destructive'}>
                  {divisao.enviado ? 'Enviado' : 'Pendente'}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Resumo do Relatório - aparece após os cards */}
      {divisoesStatus.length > 0 && regionalSelecionada && regionalSelecionada !== 'todas' && (
        <RelatorioSemanalResumo
          regionalId={regionalSelecionada}
          ano={anoSelecionado}
          mes={mesSelecionado}
          semana={semanaSelecionada}
        />
      )}

      {divisoesStatus.length === 0 && !loading && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Selecione os filtros e clique em "Aplicar" para visualizar o status dos relatórios.
          </CardContent>
        </Card>
      )}

      <RelatorioSemanalDetalheDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setDivisaoSelecionadaDialog(null);
        }}
        divisaoId={divisaoSelecionadaDialog || ''}
        ano={anoSelecionado}
        mes={mesSelecionado}
        semana={semanaSelecionada}
      />
    </div>
  );
};
