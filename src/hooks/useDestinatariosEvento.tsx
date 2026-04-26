import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CalendarEvent } from "@/lib/googleCalendar";

export interface DestinatarioEvento {
  integrante_id: string;
  nome_colete: string;
  cargo_nome: string | null;
  grau: string | null;
  divisao_texto: string;
  divisao_id: string | null;
  regional_id: string | null;
  profile_id: string | null;
  telefone: string | null;
  caveira: boolean;
}

export type EscopoEvento = "divisao" | "regional" | "cmd";

export function detectarEscopoEvento(event: CalendarEvent | null): EscopoEvento {
  if (!event) return "divisao";
  const titulo = (event.title || "").toUpperCase();
  const division = (event.division || "").toUpperCase();
  if (
    titulo.includes("CMD") ||
    titulo.includes("COMANDO") ||
    division.includes("CMD") ||
    division.includes("COMANDO")
  ) {
    return "cmd";
  }
  if (division.includes("REGIONAL") && !division.includes("DIVISAO")) {
    return "regional";
  }
  return "divisao";
}

export function isEventoCaveira(event: CalendarEvent | null): boolean {
  if (!event) return false;
  const titulo = (event.title || "").trim().toLowerCase();
  return /^caveiras?\b/.test(titulo);
}

interface UseDestinatariosEventoParams {
  event: CalendarEvent | null;
  enabled?: boolean;
}

export function useDestinatariosEvento({ event, enabled = true }: UseDestinatariosEventoParams) {
  const escopo = detectarEscopoEvento(event);
  const caveiraOnly = isEventoCaveira(event);

  return useQuery({
    queryKey: ["destinatarios-evento", event?.id, escopo, caveiraOnly],
    enabled: enabled && !!event,
    queryFn: async (): Promise<DestinatarioEvento[]> => {
      if (!event) return [];

      let query = supabase
        .from("integrantes_portal")
        .select(
          "id, nome_colete, cargo_nome, grau, divisao_texto, divisao_id, regional_id, profile_id, caveira"
        )
        .eq("ativo", true);

      if (escopo === "divisao" && event.divisao_id) {
        query = query.eq("divisao_id", event.divisao_id);
      } else if (escopo === "regional") {
        // Resolver regional priorizando a sigla detectada no evento (VP1, VP2, LN, etc.)
        const { data: regionais } = await supabase
          .from("regionais")
          .select("id, nome, sigla");

        const norm = (s: string) =>
          s
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim();

        let regionalId: string | null = null;

        // 1) Match por sigla detectada nos componentes normalizados (mais confiável)
        const siglaDetectada =
          (event as any).normalizedComponents?.regionalSigla ||
          (event as any).regionalSigla ||
          null;
        if (siglaDetectada) {
          const siglaUp = String(siglaDetectada).toUpperCase();
          const r = regionais?.find((x) => (x.sigla || "").toUpperCase() === siglaUp);
          if (r) regionalId = r.id;
        }

        // 2) Fallback: extrair sigla do texto da divisão (ex.: "Regional VP1")
        if (!regionalId && event.division) {
          const m = event.division.match(/\b(VP\d+|LN|CMD)\b/i);
          if (m) {
            const siglaUp = m[1].toUpperCase();
            const r = regionais?.find((x) => (x.sigla || "").toUpperCase() === siglaUp);
            if (r) regionalId = r.id;
          }
        }

        // 3) Fallback: match fuzzy por nome
        if (!regionalId && event.division) {
          const divNorm = norm(event.division.replace(/^regional\s*/i, ""));
          const r = regionais?.find((x) => {
            const n = norm(x.nome.replace(/\s*-\s*sp\s*$/i, ""));
            return n && (divNorm.includes(n) || n.includes(divNorm));
          });
          if (r) regionalId = r.id;
        }

        if (!regionalId) return [];
        query = query.eq("regional_id", regionalId);
      }
      // CMD: sem filtro de escopo (todos ativos)

      if (caveiraOnly) {
        query = query.eq("caveira", true);
      }

      const { data: integrantes, error } = await query.order("nome_colete");
      if (error) throw error;
      if (!integrantes || integrantes.length === 0) return [];

      const profileIds = integrantes
        .map((i) => i.profile_id)
        .filter((p): p is string => !!p);

      let profilesMap = new Map<string, string | null>();
      if (profileIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, telefone")
          .in("id", profileIds);
        profiles?.forEach((p) => profilesMap.set(p.id, p.telefone));
      }

      return integrantes.map((i) => ({
        integrante_id: i.id,
        nome_colete: i.nome_colete,
        cargo_nome: i.cargo_nome,
        grau: i.grau,
        divisao_texto: i.divisao_texto,
        divisao_id: i.divisao_id,
        regional_id: i.regional_id,
        profile_id: i.profile_id,
        telefone: i.profile_id ? profilesMap.get(i.profile_id) ?? null : null,
        caveira: !!i.caveira,
      }));
    },
  });
}
