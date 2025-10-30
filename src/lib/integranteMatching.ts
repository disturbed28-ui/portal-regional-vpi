import { supabase } from "@/integrations/supabase/client";

interface MatchResult {
  comando_id: string | null;
  regional_id: string | null;
  divisao_id: string | null;
  cargo_id: string | null;
  funcao_id: string | null;
}

export const matchIntegranteToStructure = async (
  comandoTexto: string,
  regionalTexto: string,
  divisaoTexto: string,
  cargoNome: string | null,
  grau: string | null
): Promise<MatchResult> => {
  const result: MatchResult = {
    comando_id: null,
    regional_id: null,
    divisao_id: null,
    cargo_id: null,
    funcao_id: null,
  };

  try {
    // Buscar Comando (match exato ou similar)
    const { data: comandos } = await supabase
      .from('comandos')
      .select('id, nome')
      .ilike('nome', `%${comandoTexto}%`)
      .limit(1);

    if (comandos && comandos.length > 0) {
      result.comando_id = comandos[0].id;
    }

    // Buscar Regional (match exato ou similar)
    if (result.comando_id) {
      const { data: regionais } = await supabase
        .from('regionais')
        .select('id, nome')
        .eq('comando_id', result.comando_id)
        .ilike('nome', `%${regionalTexto}%`)
        .limit(1);

      if (regionais && regionais.length > 0) {
        result.regional_id = regionais[0].id;
      }
    }

    // Buscar Divisao (match exato ou similar)
    if (result.regional_id) {
      const { data: divisoes } = await supabase
        .from('divisoes')
        .select('id, nome')
        .eq('regional_id', result.regional_id)
        .ilike('nome', `%${divisaoTexto}%`)
        .limit(1);

      if (divisoes && divisoes.length > 0) {
        result.divisao_id = divisoes[0].id;
      }
    }

    // Buscar Cargo (se tem grau e nome de cargo)
    if (grau && cargoNome) {
      const { data: cargos } = await supabase
        .from('cargos')
        .select('id, nome, grau')
        .eq('grau', grau)
        .ilike('nome', `%${cargoNome}%`)
        .limit(1);

      if (cargos && cargos.length > 0) {
        result.cargo_id = cargos[0].id;
      }
    }

    return result;
  } catch (error) {
    console.error('Error matching integrante to structure:', error);
    return result;
  }
};
