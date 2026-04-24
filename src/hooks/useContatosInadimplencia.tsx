import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DiretorDivisaoContato {
  divisao_id: string;
  divisao_nome: string;
  diretor_nome: string | null;
  diretor_telefone: string | null;
  diretor_profile_id: string | null;
  diretor_cargo: string | null;
}

export interface IntegranteContato {
  registro_id: number;
  profile_id: string | null;
  telefone: string | null;
}

/**
 * Busca, para todas as divisões da regional do usuário, o Diretor de Divisão
 * (e Diretor Regional para divisões "REGIONAL ..."), com telefone do profile
 * vinculado. Usado pela cobrança de inadimplência (Grau V).
 */
export function useDiretoresDivisaoRegional(regionalId: string | undefined | null) {
  const [diretores, setDiretores] = useState<DiretorDivisaoContato[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    if (!regionalId) {
      setDiretores([]);
      return;
    }
    setLoading(true);
    (async () => {
      // 1) Divisões da regional
      const { data: divisoes, error: divErr } = await supabase
        .from("divisoes")
        .select("id, nome")
        .eq("regional_id", regionalId);
      if (divErr || !divisoes) {
        console.error("[useDiretoresDivisaoRegional] divisoes:", divErr);
        if (active) {
          setDiretores([]);
          setLoading(false);
        }
        return;
      }

      // 2) Buscar integrantes diretores ativos da regional
      const { data: ints, error: intsErr } = await supabase
        .from("integrantes_portal")
        .select("id, divisao_id, regional_id, nome_colete, cargo_grau_texto, profile_id")
        .eq("regional_id", regionalId)
        .eq("ativo", true)
        .or(
          "cargo_grau_texto.ilike.%Diretor%Divis%,cargo_grau_texto.ilike.%Diretor Regional%",
        );
      if (intsErr || !ints) {
        console.error("[useDiretoresDivisaoRegional] integrantes:", intsErr);
        if (active) {
          setDiretores([]);
          setLoading(false);
        }
        return;
      }

      // 3) Buscar telefones nos profiles
      const profileIds = ints
        .map((i) => i.profile_id)
        .filter((v): v is string => Boolean(v));
      let telPorProfile: Record<string, string | null> = {};
      if (profileIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, telefone")
          .in("id", profileIds);
        (profs ?? []).forEach((p: { id: string; telefone: string | null }) => {
          telPorProfile[p.id] = p.telefone;
        });
      }

      // 4) Mapear cada divisão para seu diretor correto
      const result: DiretorDivisaoContato[] = divisoes.map((d) => {
        const isRegional = d.nome.toUpperCase().startsWith("REGIONAL");
        let candidato: typeof ints[number] | undefined;
        if (isRegional) {
          candidato = ints.find((i) =>
            (i.cargo_grau_texto || "").match(/Diretor\s+Regional/i),
          );
        } else {
          candidato = ints.find(
            (i) =>
              i.divisao_id === d.id &&
              /Diretor.*Divis/i.test(i.cargo_grau_texto || "") &&
              !/Sub/i.test(i.cargo_grau_texto || ""),
          );
        }
        return {
          divisao_id: d.id,
          divisao_nome: d.nome,
          diretor_nome: candidato?.nome_colete ?? null,
          diretor_cargo: candidato?.cargo_grau_texto ?? null,
          diretor_profile_id: candidato?.profile_id ?? null,
          diretor_telefone: candidato?.profile_id
            ? telPorProfile[candidato.profile_id] ?? null
            : null,
        };
      });

      if (active) {
        setDiretores(result);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [regionalId]);

  return { diretores, loading };
}

/**
 * Busca telefone (via profile) dos integrantes devedores informados.
 * Usado pela cobrança de inadimplência direto ao integrante (Grau VI).
 */
export function useTelefonesIntegrantes(registroIds: number[]) {
  const [contatos, setContatos] = useState<Record<number, IntegranteContato>>({});
  const [loading, setLoading] = useState(false);

  // chave estável p/ deps
  const key = registroIds.slice().sort((a, b) => a - b).join(",");

  useEffect(() => {
    let active = true;
    if (registroIds.length === 0) {
      setContatos({});
      return;
    }
    setLoading(true);
    (async () => {
      const { data: ints, error } = await supabase
        .from("integrantes_portal")
        .select("registro_id, profile_id")
        .in("registro_id", registroIds);
      if (error || !ints) {
        console.error("[useTelefonesIntegrantes] integrantes:", error);
        if (active) {
          setContatos({});
          setLoading(false);
        }
        return;
      }

      const profileIds = ints
        .map((i) => i.profile_id)
        .filter((v): v is string => Boolean(v));
      let telPorProfile: Record<string, string | null> = {};
      if (profileIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, telefone")
          .in("id", profileIds);
        (profs ?? []).forEach((p: { id: string; telefone: string | null }) => {
          telPorProfile[p.id] = p.telefone;
        });
      }

      const map: Record<number, IntegranteContato> = {};
      ints.forEach((i) => {
        map[i.registro_id] = {
          registro_id: i.registro_id,
          profile_id: i.profile_id,
          telefone: i.profile_id ? telPorProfile[i.profile_id] ?? null : null,
        };
      });
      if (active) {
        setContatos(map);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { contatos, loading };
}
