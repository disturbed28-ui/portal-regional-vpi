import { CalendarEvent } from "@/lib/googleCalendar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useTiposEvento } from "@/hooks/useTiposEvento";
import { Crown } from "lucide-react";

interface EventCardProps {
  event: CalendarEvent;
  onClick: () => void;
}

export function EventCard({ event, onClick }: EventCardProps) {
  const startDate = new Date(event.start);
  const endDate = new Date(event.end);
  const { getColorForType } = useTiposEvento();
  
  // Cor especial para eventos CMD (laranja vibrante)
  const borderColor = event.isComandoEvent 
    ? '#fb923c' 
    : getColorForType(event.type);
    
  const bgColor = event.isComandoEvent
    ? 'rgba(251, 146, 60, 0.08)'
    : undefined;
  
  return (
    <div className="flex gap-4 cursor-pointer" onClick={onClick}>
      <div className="flex flex-col items-center justify-start pt-2 min-w-[60px]">
        <div className="text-xs font-semibold text-muted-foreground uppercase">
          {format(startDate, "EEE.", { locale: ptBR })}
        </div>
        <div className="text-4xl font-bold text-foreground">
          {format(startDate, "dd")}
        </div>
      </div>
      
      <Card 
        className="flex-1 p-4 hover:shadow-lg transition-all hover:scale-[1.02] relative overflow-hidden"
        style={{
          borderLeft: `${event.isComandoEvent ? '5px' : '4px'} solid ${borderColor}`,
          backgroundColor: bgColor,
        }}
      >
        {event.isComandoEvent && (
          <div className="absolute top-2 right-2">
            <Crown className="h-6 w-6 text-orange-500 fill-orange-500/20" />
          </div>
        )}
        
        <div className="flex items-start gap-2 mb-2">
          <Badge 
            variant="outline" 
            style={{ 
              borderColor,
              color: borderColor,
              backgroundColor: `${borderColor}15`,
            }}
          >
            {event.type}
          </Badge>
        </div>
        
        <h3 className="font-bold text-foreground text-base mb-2">
          {event.title}
        </h3>
        <p className="text-sm text-muted-foreground">
          {format(startDate, "HH:mm", { locale: ptBR })} - {format(endDate, "HH:mm", { locale: ptBR })}
        </p>
      </Card>
    </div>
  );
}
