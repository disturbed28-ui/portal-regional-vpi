import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail } from "lucide-react";
import { cn } from "@/lib/utils";

interface MessagesIconProps {
  unreadCount: number;
  onClick: () => void;
  pulse?: boolean;
}

export const MessagesIcon = ({ unreadCount, onClick, pulse }: MessagesIconProps) => {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={cn(
        "h-8 px-2 text-primary hover:text-primary hover:bg-primary/10 relative transition-colors",
        pulse && "animate-pulse bg-primary/15"
      )}
      title="Mensagens"
    >
      <Mail className={cn("h-4 w-4", pulse && "animate-bounce")} />
      {unreadCount > 0 && (
        <Badge
          className={cn(
            "absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[9px] flex items-center justify-center rounded-full",
            pulse && "ring-2 ring-primary/40"
          )}
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </Badge>
      )}
    </Button>
  );
};
