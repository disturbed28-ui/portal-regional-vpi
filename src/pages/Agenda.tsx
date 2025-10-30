import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useState, useMemo } from "react";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { EventCard } from "@/components/agenda/EventCard";
import { EventFilters } from "@/components/agenda/EventFilters";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

const Agenda = () => {
  const navigate = useNavigate();
  const { data: events, isLoading, error } = useCalendarEvents();
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedDivision, setSelectedDivision] = useState<string>("all");

  const availableTypes = useMemo(() => {
    if (!events) return [];
    return Array.from(new Set(events.map(e => e.type))).sort();
  }, [events]);

  const availableDivisions = useMemo(() => {
    if (!events) return [];
    return Array.from(new Set(events.map(e => e.division))).sort();
  }, [events]);

  const filteredEvents = useMemo(() => {
    if (!events) return [];
    return events.filter(event => {
      const typeMatch = selectedType === "all" || event.type === selectedType;
      const divisionMatch = selectedDivision === "all" || event.division === selectedDivision;
      return typeMatch && divisionMatch;
    });
  }, [events, selectedType, selectedDivision]);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Button
            variant="outline"
            onClick={() => navigate("/")}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <h1 className="text-3xl font-bold text-foreground mb-4">
            Agenda Regional Vale do Paraiba I - SP
          </h1>

          {!isLoading && !error && (
            <EventFilters
              selectedType={selectedType}
              selectedDivision={selectedDivision}
              onTypeChange={setSelectedType}
              onDivisionChange={setSelectedDivision}
              availableTypes={availableTypes}
              availableDivisions={availableDivisions}
            />
          )}
        </div>

        {isLoading && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-48 rounded-lg" />
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
              Nenhum evento encontrado para os filtros selecionados.
            </AlertDescription>
          </Alert>
        )}

        {!isLoading && !error && filteredEvents.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Agenda;
