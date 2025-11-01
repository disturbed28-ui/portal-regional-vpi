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
  if (lower.includes("acao social") || lower.includes("arrecadacao")) return "Acao Social";
  if (lower.includes("reuniao")) return "Reuniao";
  if (lower.includes("bonde")) return "Bonde";
  if (lower.includes("bate e volta")) return "Bate e Volta";
  if (lower.includes("treino")) return "Treino";
  
  return "Outros";
}

function detectDivision(title: string): string {
  const lower = title.toLowerCase();
  
  // Mapeamento de códigos para divisões - Padrões "ext" (extremo)
  if (lower.includes("ext sul") || lower.includes("ext.sul") || lower.includes("estsul")) {
    return "Divisao Sao Jose dos Campos Extremo Sul - SP";
  }
  if (lower.includes("ext leste") || lower.includes("ext.leste") || lower.includes("estleste")) {
    return "Divisao Sao Jose dos Campos Extremo Leste - SP";
  }
  if (lower.includes("ext norte") || lower.includes("ext.norte") || lower.includes("estnorte")) {
    return "Divisao Sao Jose dos Campos Extremo Norte - SP";
  }
  
  // Padrões São José dos Campos
  if (lower.includes("norte sjc")) {
    return "Divisao Sao Jose dos Campos Norte - SP";
  }
  if (lower.includes("diveleste") || lower.includes("div leste") || lower.includes("leste sjc")) {
    return "Divisao Sao Jose dos Campos Leste - SP";
  }
  if (lower.includes("divesjc centro") || lower.includes("divsjc centro") || lower.includes("centro sjc")) {
    return "Divisao Sao Jose dos Campos Centro - SP";
  }
  
  // Caçapava
  if (lower.includes("cacapava") || lower.includes("caçapava")) {
    return "Divisao Cacapava - SP";
  }
  
  // Jacareí com suas divisões
  if (lower.includes("jacarei sul") || lower.includes("jac sul")) {
    return "Divisao Jacarei Sul - SP";
  }
  if (lower.includes("jacarei norte") || lower.includes("jac norte")) {
    return "Divisao Jacarei Norte - SP";
  }
  if (lower.includes("jacarei leste") || lower.includes("jac leste")) {
    return "Divisao Jacarei Leste - SP";
  }
  if (lower.includes("jacarei oeste") || lower.includes("jac oeste")) {
    return "Divisao Jacarei Oeste - SP";
  }
  if (lower.includes("jacarei centro") || lower.includes("jac centro")) {
    return "Divisao Jacarei Centro - SP";
  }
  if (lower.includes("jacarei") || lower.includes("jac")) {
    return "Divisao Jacarei - SP";
  }
  
  if (lower.includes("regional")) {
    return "Regional";
  }
  
  return "Sem Divisao";
}
