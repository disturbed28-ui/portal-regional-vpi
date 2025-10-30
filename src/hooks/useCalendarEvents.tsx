import { useQuery } from "@tanstack/react-query";
import { fetchCalendarEvents } from "@/lib/googleCalendar";

export function useCalendarEvents() {
  return useQuery({
    queryKey: ["calendar-events"],
    queryFn: fetchCalendarEvents,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}
