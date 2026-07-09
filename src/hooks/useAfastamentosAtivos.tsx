import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Retorna um mapa (registro_id -> tipo_afastamento) de todos os
 * afastamentos vigentes (ativo = true). Usado para exibir a flag de
 * "Afastado / Suspenso" em telas e relatórios de integrantes ativos.
 */
export const useAfastamentosAtivos = () => {
  const [afastamentosMap, setAfastamentosMap] = useState<Map<number, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ativo = true;

    const fetchAfastamentos = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("integrantes_afastados")
        .select("registro_id, tipo_afastamento")
        .eq("ativo", true);

      if (!ativo) return;

      if (error) {
        console.error("Erro ao buscar afastamentos ativos:", error);
      } else {
        const map = new Map<number, string>();
        (data || []).forEach((r: any) => {
          if (r.registro_id != null) {
            map.set(r.registro_id, r.tipo_afastamento);
          }
        });
        setAfastamentosMap(map);
      }
      setLoading(false);
    };

    fetchAfastamentos();

    const channel = supabase
      .channel("afastamentos-ativos-lookup")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "integrantes_afastados" },
        () => fetchAfastamentos()
      )
      .subscribe();

    return () => {
      ativo = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return { afastamentosMap, loading };
};
