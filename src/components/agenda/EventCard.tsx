import { CalendarEvent } from "@/lib/googleCalendar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useTiposEvento } from "@/hooks/useTiposEvento";
import { Crown, Skull } from "lucide-react";

interface EventCardProps {
  event: CalendarEvent;
  onClick: () => void;
}

export function EventCard({ event, onClick }: EventCardProps) {
  const startDate = new Date(event.start);
  const endDate = new Date(event.end);
  const { getColorForType } = useTiposEvento();
  
  // Cor especial para eventos CMD e Regional (laranja vibrante)
  const isSpecialEvent = event.isComandoEvent || event.isRegionalEvent;
  
  // Cor especial para eventos Caveira (roxo)
  const isCaveiraEvent = event.isCaveiraEvent;
  
  const borderColor = isCaveiraEvent
    ? '#9333ea' // Roxo para Caveira
    : isSpecialEvent 
      ? '#fb923c' 
      : getColorForType(event.type);
    
  const bgColor = isCaveiraEvent
    ? 'rgba(147, 51, 234, 0.08)' // Fundo roxo suave
    : isSpecialEvent
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
          borderLeft: `${isCaveiraEvent || isSpecialEvent ? '5px' : '4px'} solid ${borderColor}`,
          backgroundColor: bgColor,
        }}
      >
        {/* Ícone de Caveira para eventos restritos */}
        {isCaveiraEvent && (
          <div className="absolute top-2 right-2">
            <Skull className="h-6 w-6 text-purple-600 fill-purple-600/20" />
          </div>
        )}
        
        {/* Ícone de Coroa para eventos CMD/Regional */}
        {isSpecialEvent && !isCaveiraEvent && (
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
          
          {/* Badge adicional para Caveira */}
          {isCaveiraEvent && (
            <Badge 
              variant="outline"
              className="bg-purple-500/10 border-purple-500 text-purple-600"
            >
              <Skull className="h-3 w-3 mr-1" />
              CAVEIRA
            </Badge>
          )}
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
