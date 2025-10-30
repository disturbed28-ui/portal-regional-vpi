import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { EventCard } from "@/components/agenda/EventCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const Agenda = () => {
  const navigate = useNavigate();
  const { data: events, isLoading, error } = useCalendarEvents();

  const currentMonth = format(new Date(), "MMMM", { locale: ptBR });

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-[hsl(var(--primary))] text-primary-foreground p-4 sticky top-0 z-10 shadow-md">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-2 text-primary-foreground hover:bg-primary-foreground/10"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <h1 className="text-3xl font-bold">Agenda Regional Vale do Paraiba I</h1>
        <p className="text-lg capitalize mt-2 opacity-90">{currentMonth}</p>
      </div>

      <div className="p-4">
        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Erro ao carregar eventos. Verifique se a API Key do Google Calendar esta configurada corretamente.
            </AlertDescription>
          </Alert>
        )}

        {!isLoading && !error && (!events || events.length === 0) && (
          <Alert>
            <AlertDescription>
              Nenhum evento encontrado.
            </AlertDescription>
          </Alert>
        )}

        {!isLoading && !error && events && events.length > 0 && (
          <div className="space-y-4">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Agenda;
