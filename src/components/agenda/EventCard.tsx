import { CalendarEvent } from "@/lib/googleCalendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface EventCardProps {
  event: CalendarEvent;
}

const typeColors: Record<string, string> = {
  "Pub": "bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30",
  "Acao Social": "bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30",
  "Reuniao": "bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30",
  "Arrecadacao": "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/30",
  "Bonde": "bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30",
  "Treino": "bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-500/30",
  "Outros": "bg-gray-500/20 text-gray-700 dark:text-gray-300 border-gray-500/30",
};

export function EventCard({ event }: EventCardProps) {
  const startDate = new Date(event.start);
  const endDate = new Date(event.end);
  
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <CardTitle className="text-lg">{event.title}</CardTitle>
          <a
            href={event.htmlLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          <Badge variant="outline" className={typeColors[event.type] || typeColors["Outros"]}>
            {event.type}
          </Badge>
          {event.division !== "Sem Divisao" && (
            <Badge variant="secondary">{event.division}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <div>
            <div>{format(startDate, "PPP", { locale: ptBR })}</div>
            <div className="text-xs">
              {format(startDate, "HH:mm")} - {format(endDate, "HH:mm")}
            </div>
          </div>
        </div>
        
        {event.location && (
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{event.location}</span>
          </div>
        )}
        
        {event.description && (
          <p className="text-sm text-muted-foreground line-clamp-3">
            {event.description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
