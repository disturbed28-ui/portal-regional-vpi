import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAfastamentoStyle } from "@/lib/afastamentoStatus";

interface AfastamentoBadgeProps {
  tipo?: string | null;
  className?: string;
}

/**
 * Indicador visual para integrantes ativos que estão afastados/suspensos.
 */
export function AfastamentoBadge({ tipo, className }: AfastamentoBadgeProps) {
  if (!tipo || !tipo.trim()) return null;

  const { label, className: styleClass } = getAfastamentoStyle(tipo);

  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[10px] px-1.5 py-0 h-4 gap-0.5 whitespace-nowrap",
        styleClass,
        className
      )}
    >
      <AlertTriangle className="h-2.5 w-2.5" />
      {label}
    </Badge>
  );
}
