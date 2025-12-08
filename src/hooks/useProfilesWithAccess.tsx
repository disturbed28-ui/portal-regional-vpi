import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ProfileWithAccess {
  id: string;
  name: string;
  nome_colete: string | null;
  grau: string | null;
  regional_id: string | null;
  divisao_id: string | null;
  profile_status: string;
  last_access_at: string | null;
  photo_url: string | null;
  cargos: { nome: string } | null;
  divisoes: { nome: string } | null;
  regionais: { nome: string } | null;
}

interface Filters {
  search: string;
  regionalId: string | null;
  divisaoId: string | null;
  status: string | null;
}

export const useProfilesWithAccess = () => {
  const [profiles, setProfiles] = useState<ProfileWithAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({
    search: "",
    regionalId: null,
    divisaoId: null,
    status: null,
  });

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("profiles")
        .select(`
          id,
          name,
          nome_colete,
          grau,
          regional_id,
          divisao_id,
          profile_status,
          last_access_at,
          photo_url,
          cargos:cargo_id(nome),
          divisoes:divisao_id(nome),
          regionais:regional_id(nome)
        `)
        .not("last_access_at", "is", null)
        .order("last_access_at", { ascending: false, nullsFirst: false });

      if (filters.search) {
        const searchTerm = `%${filters.search}%`;
        query = query.or(`nome_colete.ilike.${searchTerm},name.ilike.${searchTerm}`);
      }

      if (filters.regionalId) {
        query = query.eq("regional_id", filters.regionalId);
      }

      if (filters.divisaoId) {
        query = query.eq("divisao_id", filters.divisaoId);
      }

      if (filters.status) {
        query = query.eq("profile_status", filters.status);
      }

      const { data, error } = await query;

      if (error) throw error;

      setProfiles(data || []);
    } catch (error) {
      console.error("[useProfilesWithAccess] Error fetching profiles:", error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const updateFilters = useCallback((newFilters: Partial<Filters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      search: "",
      regionalId: null,
      divisaoId: null,
      status: null,
    });
  }, []);

  return {
    profiles,
    loading,
    filters,
    updateFilters,
    clearFilters,
    refresh: fetchProfiles,
  };
};
