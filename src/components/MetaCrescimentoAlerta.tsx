import { AlertTriangle, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { MetaCrescimentoResultado } from '@/lib/metaCrescimento';

interface MetaCrescimentoAlertaProps {
  meta: MetaCrescimentoResultado;
  /** Rótulo do período/mês analisado (ex.: "Mês 08/2026 - períodos 1 e 2") */
  contexto?: string;
  onDispensar?: () => void;
  compacto?: boolean;
}

export const MetaCrescimentoAlerta = ({
  meta,
  contexto,
  onDispensar,
  compacto,
}: MetaCrescimentoAlertaProps) => {
  const estilos: Record<string, string> = {
    atingida: 'bg-emerald-600 border-emerald-700 text-white',
    atencao: 'bg-amber-500 border-amber-600 text-white',
    critica: 'bg-red-600 border-red-700 text-white animate-pulse',
    sem_base: 'bg-muted border-border text-muted-foreground',
  };

  const titulos: Record<string, string> = {
    atingida: 'META DE CRESCIMENTO ATINGIDA (4%)',
    atencao: 'META DE CRESCIMENTO (4%) EM ANDAMENTO',
    critica: 'META DE CRESCIMENTO (4%) NÃO ATINGIDA',
    sem_base: 'META DE CRESCIMENTO (4%)',
  };

  const Icone = meta.status === 'atingida' ? TrendingUp : AlertTriangle;

  return (
    <div className={`rounded-lg border-2 p-3 ${estilos[meta.status]}`}>
      <div className="flex items-start gap-2">
        <Icone className="h-5 w-5 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm">{titulos[meta.status]}</p>
          <p className="text-xs mt-1 leading-relaxed">{meta.mensagem}</p>
          {!compacto && meta.baseDisponivel && (
            <p className="text-[11px] mt-1 opacity-90">
              Entradas: {meta.entradas} • Saídas: {meta.saidas} • Saldo líquido: {meta.saldo}
              {contexto ? ` • ${contexto}` : ''}
            </p>
          )}
        </div>
        {onDispensar && (
          <Button
            size="sm"
            variant="secondary"
            className="flex-shrink-0 h-7 px-3 text-xs"
            onClick={onDispensar}
          >
            OK
          </Button>
        )}
      </div>
    </div>
  );
};
