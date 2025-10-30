import { CalendarEvent } from "@/lib/googleCalendar";
import { Card } from "@/components/ui/card";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface EventCardProps {
  event: CalendarEvent;
}

export function EventCard({ event }: EventCardProps) {
  const startDate = new Date(event.start);
  const endDate = new Date(event.end);
  
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center justify-start pt-2 min-w-[60px]">
        <div className="text-xs font-semibold text-muted-foreground uppercase">
          {format(startDate, "EEE.", { locale: ptBR })}
        </div>
        <div className="text-4xl font-bold text-foreground">
          {format(startDate, "dd")}
        </div>
      </div>
      
      <Card className="flex-1 p-4 hover:shadow-md transition-shadow">
        <h3 className="font-bold text-foreground text-lg mb-2">
          {event.title}
        </h3>
        <p className="text-sm text-muted-foreground">
          {format(startDate, "hh:mm a", { locale: ptBR })} - {format(endDate, "hh:mm a", { locale: ptBR })}
        </p>
      </Card>
    </div>
  );
}
