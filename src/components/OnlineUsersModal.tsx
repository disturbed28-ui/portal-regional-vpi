import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, MessageCircle } from "lucide-react";

interface OnlineUser {
  user_id: string;
  nome_colete: string;
  online_at: string;
}

interface OnlineUsersModalProps {
  users: OnlineUser[];
  totalOnline: number;
  currentUserId?: string;
  onStartChat?: (userId: string, name: string) => void;
}

export const OnlineUsersModal = ({
  users,
  totalOnline,
  currentUserId,
  onStartChat,
}: OnlineUsersModalProps) => {
  if (totalOnline === 0) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
        >
          <Users className="h-4 w-4 mr-1" />
          <span className="font-medium">{totalOnline}</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-green-600" />
            Usuários Online ({totalOnline})
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {users
            .sort((a, b) => a.nome_colete.localeCompare(b.nome_colete))
            .map((user, idx) => {
              const isMe = user.user_id === currentUserId;
              const canChat = !isMe && !!onStartChat;
              return (
                <div
                  key={idx}
                  onClick={() => {
                    if (canChat) onStartChat!(user.user_id, user.nome_colete);
                  }}
                  className={`flex items-center justify-between p-3 rounded-lg bg-secondary/50 ${
                    canChat ? "hover:bg-secondary cursor-pointer" : ""
                  }`}
                  role={canChat ? "button" : undefined}
                  tabIndex={canChat ? 0 : undefined}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="font-medium">{user.nome_colete}</span>
                    {isMe && (
                      <Badge variant="outline" className="text-[10px]">
                        você
                      </Badge>
                    )}
                  </div>
                  {canChat ? (
                    <MessageCircle className="h-4 w-4 text-primary" />
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      Online
                    </Badge>
                  )}
                </div>
              );
            })}
        </div>
      </DialogContent>
    </Dialog>
  );
};
