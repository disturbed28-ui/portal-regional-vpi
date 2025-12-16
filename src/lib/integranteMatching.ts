import { supabase } from "@/integrations/supabase/client";
import { normalizeText, normalizarRegional } from "@/lib/normalizeText";

interface MatchResult {
  comando_id: string | null;
  regional_id: string | null;
  divisao_id: string | null;
  cargo_id: string | null;
  funcao_id: string | null;
  matched_fields: string[];
  failed_fields: string[];
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
    matched_fields: [],
    failed_fields: [],
  };

  try {
    // Normalizar textos de entrada
    const comandoNormalizado = normalizeText(comandoTexto);
    const regionalNormalizado = normalizeText(regionalTexto);
    const divisaoNormalizado = normalizeText(divisaoTexto);

    // Buscar TODOS os comandos para fazer matching melhor
    const { data: comandos } = await supabase
      .from('comandos')
      .select('id, nome')
      .order('nome');

    if (comandos && comandos.length > 0) {
      // Tentar matching inteligente
      const comandoMatch = comandos.find(c => {
        const comandoDbNormalizado = normalizeText(c.nome);
        return comandoDbNormalizado.includes(comandoNormalizado) || 
               comandoNormalizado.includes(comandoDbNormalizado);
      });

      if (comandoMatch) {
        result.comando_id = comandoMatch.id;
        result.matched_fields.push('comando');
      } else {
        result.failed_fields.push('comando');
      }
    }

    // Buscar Regional (se encontrou comando)
    if (result.comando_id) {
      const { data: regionais } = await supabase
        .from('regionais')
        .select('id, nome')
        .eq('comando_id', result.comando_id)
        .order('nome');

      if (regionais && regionais.length > 0) {
        // Usar normalizarRegional para converter romanos (III→3, II→2, I→1)
        const regionalNormalizadaInput = normalizarRegional(regionalTexto);
        
        const regionalMatch = regionais.find(r => {
          const regionalDbNormalizada = normalizarRegional(r.nome);
          // Matching exato após normalização para evitar falso positivo (VP I vs VP III)
          return regionalDbNormalizada === regionalNormalizadaInput;
        });

        if (regionalMatch) {
          result.regional_id = regionalMatch.id;
          result.matched_fields.push('regional');
        } else {
          result.failed_fields.push('regional');
        }
      }
    } else {
      result.failed_fields.push('regional');
    }

    // Buscar Divisao (se encontrou regional)
    if (result.regional_id) {
      const { data: divisoes } = await supabase
        .from('divisoes')
        .select('id, nome')
        .eq('regional_id', result.regional_id)
        .order('nome');

      if (divisoes && divisoes.length > 0) {
        const divisaoMatch = divisoes.find(d => {
          const divisaoDbNormalizado = normalizeText(d.nome);
          return divisaoDbNormalizado.includes(divisaoNormalizado) || 
                 divisaoNormalizado.includes(divisaoDbNormalizado);
        });

        if (divisaoMatch) {
          result.divisao_id = divisaoMatch.id;
          result.matched_fields.push('divisao');
        } else {
          result.failed_fields.push('divisao');
        }
      }
    } else {
      result.failed_fields.push('divisao');
    }

    // Buscar Cargo (se tem grau e nome de cargo)
    if (grau && cargoNome) {
      // Normalizar o nome do cargo para comparação
      const cargoNormalizado = normalizeText(cargoNome);
      
      const { data: cargos } = await supabase
        .from('cargos')
        .select('id, nome, grau')
        .eq('grau', grau);

      if (cargos && cargos.length > 0) {
        // Fazer matching manual com nomes normalizados
        const cargoMatch = cargos.find(c => {
          const cargoDbNormalizado = normalizeText(c.nome);
          return cargoDbNormalizado.includes(cargoNormalizado) || 
                 cargoNormalizado.includes(cargoDbNormalizado);
        });

        if (cargoMatch) {
          result.cargo_id = cargoMatch.id;
          result.matched_fields.push('cargo');
        } else {
          result.failed_fields.push('cargo');
        }
      }
    }

    return result;
  } catch (error) {
    console.error('Error matching integrante to structure:', error);
    return result;
  }
};
