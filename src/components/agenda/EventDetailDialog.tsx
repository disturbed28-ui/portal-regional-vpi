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
import { Calendar, Clock, MapPin, Tag, ExternalLink, Users, Crown, Skull } from "lucide-react";
import { ListaPresenca } from "./ListaPresenca";
import { useTiposEvento } from "@/hooks/useTiposEvento";
import { useAuth } from "@/hooks/useAuth";
import { useScreenAccess } from "@/hooks/useScreenAccess";

interface EventDetailDialogProps {
  event: CalendarEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EventDetailDialog({ event, open, onOpenChange }: EventDetailDialogProps) {
  const [listaPresencaOpen, setListaPresencaOpen] = useState(false);
  const { getColorForType } = useTiposEvento();
  
  // Validar permissão para Lista de Presença
  const { user } = useAuth();
  const { hasAccess: canSeeLista, loading: loadingListaAccess } = 
    useScreenAccess('/lista-presenca', user?.id);
  
  if (!event) return null;

  const startDate = new Date(event.start);
  const endDate = new Date(event.end);
  
  const eventColor = event.isCaveiraEvent 
    ? '#9333ea' // Roxo para Caveira
    : event.isComandoEvent 
      ? '#fb923c' 
      : getColorForType(event.type);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-lg sm:w-auto px-4 sm:px-6">
        <DialogHeader>
          <div className="flex items-start gap-2 mb-2 flex-wrap">
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
            {event.isCaveiraEvent && (
              <Badge 
                variant="outline"
                className="bg-purple-500/10 border-purple-500 text-purple-600"
              >
                <Skull className="h-3 w-3 mr-1" />
                CAVEIRA
              </Badge>
            )}
            {event.isComandoEvent && !event.isCaveiraEvent && (
              <Badge 
                variant="outline"
                style={{
                  borderColor: '#fb923c',
                  color: '#fb923c',
                  backgroundColor: 'rgba(251, 146, 60, 0.1)',
                }}
              >
                <Crown className="h-3 w-3 mr-1" />
                COMANDO
              </Badge>
            )}
          </div>
          <DialogTitle className="text-xl sm:text-2xl">{event.title}</DialogTitle>
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

          <div className="flex flex-col sm:flex-row gap-2 mt-4">
            {/* Só renderiza botão se tiver permissão */}
            {!loadingListaAccess && canSeeLista && (
              <Button
                variant="default"
                className="w-full sm:flex-1"
                onClick={() => setListaPresencaOpen(true)}
              >
                <Users className="mr-2 h-4 w-4" />
                Lista de Presença
              </Button>
            )}
            
            {event.htmlLink && (
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => window.open(event.htmlLink, "_blank")}
              >
                <ExternalLink className="h-4 w-4 mr-2 sm:mr-0" />
                <span className="sm:hidden">Abrir no Google</span>
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
