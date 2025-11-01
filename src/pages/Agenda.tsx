import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { EventCard } from "@/components/agenda/EventCard";
import { EventDetailDialog } from "@/components/agenda/EventDetailDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { format, startOfMonth, endOfMonth, addMonths, subMonths, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarEvent } from "@/lib/googleCalendar";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useToast } from "@/hooks/use-toast";

const Agenda = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile(user?.id);
  const { data: events, isLoading, error } = useCalendarEvents();
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Redirecionar para perfil se usuário não tiver nome_colete
  useEffect(() => {
    if (user && !profileLoading && profile && !profile.nome_colete) {
      toast({
        title: "Complete seu cadastro",
        description: "Por favor, adicione seu nome de colete para continuar.",
      });
      navigate("/perfil");
    }
  }, [user, profileLoading, profile, navigate, toast]);

  const currentMonth = format(selectedMonth, "MMMM 'de' yyyy", { locale: ptBR });

  const filteredEvents = events?.filter((event) => {
    const eventDate = new Date(event.start);
    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);
    return isWithinInterval(eventDate, { start: monthStart, end: monthEnd });
  }) || [];

  const handlePreviousMonth = () => {
    setSelectedMonth(subMonths(selectedMonth, 1));
  };

  const handleNextMonth = () => {
    setSelectedMonth(addMonths(selectedMonth, 1));
  };

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setDialogOpen(true);
  };

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
        <h1 className="text-base sm:text-xl md:text-2xl lg:text-3xl font-bold">Agenda Regional Vale do Paraiba I</h1>
        
        <div className="flex items-center justify-between mt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePreviousMonth}
            className="text-primary-foreground hover:bg-primary-foreground/10"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <p className="text-lg capitalize font-semibold">{currentMonth}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNextMonth}
            className="text-primary-foreground hover:bg-primary-foreground/10"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
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

        {!isLoading && !error && filteredEvents.length === 0 && (
          <Alert>
            <AlertDescription>
              Nenhum evento encontrado para este mes.
            </AlertDescription>
          </Alert>
        )}

        {!isLoading && !error && filteredEvents.length > 0 && (
          <div className="space-y-4">
            {filteredEvents.map((event) => (
              <EventCard key={event.id} event={event} onClick={() => handleEventClick(event)} />
            ))}
          </div>
        )}
      </div>

      <EventDetailDialog
        event={selectedEvent}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
};

export default Agenda;
