const CALENDAR_ID = "3db053177f24bf333254be1f501c71880940cc1eb0e319bf3d45830ba4cbea07@group.calendar.google.com";

function removeSpecialCharacters(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ç/gi, 'c')
    .replace(/Ç/g, 'C');
}

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  start: string;
  end: string;
  location?: string;
  type: string;
  division: string;
  htmlLink: string;
}

export async function fetchCalendarEvents(): Promise<CalendarEvent[]> {
  const API_KEY = import.meta.env.VITE_GOOGLE_CALENDAR_API_KEY;
  
  if (!API_KEY) {
    throw new Error("Google Calendar API Key nao configurada");
  }

  const now = new Date();
  const threeMonthsLater = new Date();
  threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);

  const params = new URLSearchParams({
    key: API_KEY,
    timeMin: now.toISOString(),
    timeMax: threeMonthsLater.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "100",
  });

  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events?${params}`;

  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Erro ao buscar eventos: ${response.statusText}`);
  }

  const data = await response.json();
  
  return data.items.map((item: any) => ({
    id: item.id,
    title: removeSpecialCharacters(item.summary || "Sem titulo"),
    description: item.description || "",
    start: item.start.dateTime || item.start.date,
    end: item.end.dateTime || item.end.date,
    location: item.location,
    type: detectEventType(item.summary || ""),
    division: detectDivision(item.summary || ""),
    htmlLink: item.htmlLink,
  }));
}

function detectEventType(title: string): string {
  const lower = title.toLowerCase();
  
  if (lower.includes("pub")) return "Pub";
  if (lower.includes("acao social")) return "Acao Social";
  if (lower.includes("reuniao")) return "Reuniao";
  if (lower.includes("arrecadacao")) return "Arrecadacao";
  if (lower.includes("bonde")) return "Bonde";
  if (lower.includes("treino")) return "Treino";
  
  return "Outros";
}

function detectDivision(title: string): string {
  const lower = title.toLowerCase();
  
  if (lower.includes("regional")) return "Regional";
  if (lower.includes("divleste") || lower.includes("div leste")) return "DivLeste SJC";
  if (lower.includes("divjac centro")) return "DivJac Centro";
  if (lower.includes("divjac")) return "DivJac";
  
  return "Sem Divisao";
}
