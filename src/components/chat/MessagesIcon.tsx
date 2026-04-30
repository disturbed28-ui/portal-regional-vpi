import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail } from "lucide-react";

interface MessagesIconProps {
  unreadCount: number;
  onClick: () => void;
}

export const MessagesIcon = ({ unreadCount, onClick }: MessagesIconProps) => {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className="h-8 px-2 text-primary hover:text-primary hover:bg-primary/10 relative"
      title="Mensagens"
    >
      <Mail className="h-4 w-4" />
      {unreadCount > 0 && (
        <Badge className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[9px] flex items-center justify-center rounded-full">
          {unreadCount > 99 ? "99+" : unreadCount}
        </Badge>
      )}
    </Button>
  );
};
