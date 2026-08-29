import { Check, X, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { InsightStatus, INSIGHT_STATUS_LABEL } from "@/lib/insightsCalculo";

interface Props {
  status: InsightStatus;
  onChange: (status: InsightStatus) => void;
  disabled?: boolean;
}

const opcoes: InsightStatus[] = ["RESPONDEU", "NAO_RESPONDEU", "NAO_APLICAVEL"];

const icones = {
  RESPONDEU: Check,
  NAO_RESPONDEU: X,
  NAO_APLICAVEL: Minus,
};

const estilos: Record<InsightStatus, string> = {
  RESPONDEU: "bg-emerald-600 text-emerald-50 border-emerald-600",
  NAO_RESPONDEU: "bg-destructive text-destructive-foreground border-destructive",
  NAO_APLICAVEL: "bg-muted text-muted-foreground border-border",
};

/** Três botões grandes, otimizados para toque no smartphone. */
export const StatusToggle = ({ status, onChange, disabled }: Props) => (
  <div className="grid grid-cols-3 gap-1" role="group" aria-label="Status da resposta">
    {opcoes.map((opcao) => {
      const Icone = icones[opcao];
      const ativo = status === opcao;
      return (
        <button
          key={opcao}
          type="button"
          disabled={disabled}
          aria-pressed={ativo}
          aria-label={INSIGHT_STATUS_LABEL[opcao]}
          onClick={() => onChange(opcao)}
          className={cn(
            "flex min-h-11 items-center justify-center gap-1 rounded-md border px-1 text-[11px] font-semibold transition-colors",
            ativo ? estilos[opcao] : "bg-background text-muted-foreground border-border"
          )}
        >
          <Icone className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {opcao === "NAO_APLICAVEL" ? "N/A" : opcao === "RESPONDEU" ? "Resp." : "Não"}
          </span>
        </button>
      );
    })}
  </div>
);

export const StatusBadge = ({ status }: { status: InsightStatus }) => {
  const Icone = icones[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        estilos[status]
      )}
    >
      <Icone className="h-3 w-3" />
      {INSIGHT_STATUS_LABEL[status]}
    </span>
  );
};
