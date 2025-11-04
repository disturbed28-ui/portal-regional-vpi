import { useState } from "react";
import { CalendarEvent } from "@/lib/googleCalendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Clock, MapPin, Tag, ExternalLink, Users, Crown } from "lucide-react";
import { ListaPresenca } from "./ListaPresenca";
import { useTiposEvento } from "@/hooks/useTiposEvento";

interface EventDetailDialogProps {
  event: CalendarEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EventDetailDialog({ event, open, onOpenChange }: EventDetailDialogProps) {
  const [listaPresencaOpen, setListaPresencaOpen] = useState(false);
  const { getColorForType } = useTiposEvento();
  
  if (!event) return null;

  const startDate = new Date(event.start);
  const endDate = new Date(event.end);
  
  const eventColor = event.isComandoEvent ? '#d97706' : getColorForType(event.type);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-start gap-3 mb-2">
            <Badge 
              variant="outline"
              style={{ 
                borderColor: eventColor,
                color: eventColor,
                backgroundColor: `${eventColor}15`,
              }}
            >
              {event.type}
            </Badge>
            {event.isComandoEvent && (
              <Badge 
                variant="outline"
                className="border-amber-600 text-amber-600 bg-amber-50"
              >
                <Crown className="h-3 w-3 mr-1" />
                COMANDO
              </Badge>
            )}
          </div>
          <DialogTitle className="text-2xl">{event.title}</DialogTitle>
          <DialogDescription className="sr-only">
            Detalhes do evento
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="font-medium">Data</p>
              <p className="text-sm text-muted-foreground">
                {format(startDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="font-medium">Horario</p>
              <p className="text-sm text-muted-foreground">
                {format(startDate, "HH:mm", { locale: ptBR })} - {format(endDate, "HH:mm", { locale: ptBR })}
              </p>
            </div>
          </div>

          {event.location && (
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">Local</p>
                <p className="text-sm text-muted-foreground">{event.location}</p>
              </div>
            </div>
          )}

          {event.type && (
            <div className="flex items-start gap-3">
              <Tag className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">Tipo</p>
                <p className="text-sm text-muted-foreground">{event.type}</p>
              </div>
            </div>
          )}

          {event.division && (
            <div className="flex items-start gap-3">
              <Tag className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">Divisao</p>
                <p className="text-sm text-muted-foreground">{event.division}</p>
              </div>
            </div>
          )}

          {event.description && (
            <div className="flex items-start gap-3">
              <div className="w-5" />
              <div>
                <p className="font-medium">Descricao</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{event.description}</p>
              </div>
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <Button
              variant="default"
              className="flex-1"
              onClick={() => setListaPresencaOpen(true)}
            >
              <Users className="mr-2 h-4 w-4" />
              Lista de Presença
            </Button>
            
            {event.htmlLink && (
              <Button
                variant="outline"
                onClick={() => window.open(event.htmlLink, "_blank")}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>

      <ListaPresenca
        event={event}
        open={listaPresencaOpen}
        onOpenChange={setListaPresencaOpen}
      />
    </Dialog>
  );
}
