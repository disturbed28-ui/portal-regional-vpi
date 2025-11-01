import { useQuery } from "@tanstack/react-query";
import { fetchCalendarEvents } from "@/lib/googleCalendar";

export function useCalendarEvents() {
  return useQuery({
    queryKey: ["calendar-events"],
    queryFn: fetchCalendarEvents,
    staleTime: 0, // Sempre buscar eventos atualizados ao abrir a tela
    refetchOnMount: true, // Sempre refetch ao montar o componente
  });
}
