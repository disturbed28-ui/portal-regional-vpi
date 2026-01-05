import { Eye } from "lucide-react";

interface ReadOnlyBannerProps {
  className?: string;
}

export function ReadOnlyBanner({ className = "" }: ReadOnlyBannerProps) {
  return (
    <div className={`bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-2 flex items-center gap-2 ${className}`}>
      <Eye className="h-4 w-4 text-amber-600 shrink-0" />
      <span className="text-sm text-amber-700 dark:text-amber-400">
        Visualização apenas - Você não tem permissão para editar
      </span>
    </div>
  );
}
