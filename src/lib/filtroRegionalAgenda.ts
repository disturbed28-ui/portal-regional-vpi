import type { CalendarEvent } from "./googleCalendar";

// Applies only to events already authorized by get-calendar-events.
export function correspondeRegionalAgenda(
  event: Pick<CalendarEvent, "isComandoEvent" | "normalizedComponents">,
  selectedRegional: string,
): boolean {
  return selectedRegional === "todas"
    || event.isComandoEvent
    || event.normalizedComponents?.regionalSigla === selectedRegional;
}