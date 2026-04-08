import { useQuery } from "@tanstack/react-query";
import { fetchCalendarEvents } from "@/lib/googleCalendar";

export function useCalendarEvents() {
  return useQuery({
    queryKey: ["calendar-events"],
    queryFn: fetchCalendarEvents,
    staleTime: 5 * 60 * 1000, // 5 minutos de cache antes de refetch
    gcTime: 10 * 60 * 1000, // 10 minutos no garbage collector
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
}
