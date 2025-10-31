import { supabase } from "@/integrations/supabase/client";

interface MatchResult {
  comando_id: string | null;
  regional_id: string | null;
  divisao_id: string | null;
  cargo_id: string | null;
  funcao_id: string | null;
  matched_fields: string[];
  failed_fields: string[];
}

// Função para normalizar texto antes do matching
const normalizeText = (text: string): string => {
  if (!text) return '';
  
  return text
    .toUpperCase()
    // Remover acentos
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    // Remover prefixos
    .replace(/^COMANDO\s+REGIONAL\s+/i, '')
    .replace(/^REGIONAL\s+/i, '')
    .replace(/^DIVISAO\s+/i, '')
    .replace(/^DIVISÃO\s+/i, '')
    // Remover sufixos geográficos " - SP", " - RJ"
    .replace(/\s+-\s+[A-Z]{2}$/i, '')
    // Remover hífen solto no final " -"
    .replace(/\s+-\s*$/i, '')
    // Remover sufixos entre parênteses " (Grau VI)"
    .replace(/\s+\([^)]*\)\s*$/i, '')
    // Normalizar espaços
    .replace(/\s+/g, ' ')
    .trim();
};

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

    console.log('🔍 Matching integrante to structure:');
    console.log('Comando original:', comandoTexto, '→ normalizado:', comandoNormalizado);
    console.log('Regional original:', regionalTexto, '→ normalizado:', regionalNormalizado);
    console.log('Divisao original:', divisaoTexto, '→ normalizado:', divisaoNormalizado);

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
        console.log('✅ Comando matched:', comandoMatch.nome);
      } else {
        result.failed_fields.push('comando');
        console.log('❌ Comando NOT matched. Available:', comandos.map(c => c.nome));
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
        const regionalMatch = regionais.find(r => {
          const regionalDbNormalizado = normalizeText(r.nome);
          return regionalDbNormalizado.includes(regionalNormalizado) || 
                 regionalNormalizado.includes(regionalDbNormalizado);
        });

        if (regionalMatch) {
          result.regional_id = regionalMatch.id;
          result.matched_fields.push('regional');
          console.log('✅ Regional matched:', regionalMatch.nome);
        } else {
          result.failed_fields.push('regional');
          console.log('❌ Regional NOT matched. Available:', regionais.map(r => r.nome));
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
          console.log('✅ Divisao matched:', divisaoMatch.nome);
        } else {
          result.failed_fields.push('divisao');
          console.log('❌ Divisao NOT matched. Available:', divisoes.map(d => d.nome));
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
          console.log('✅ Cargo matched:', cargoMatch.nome, cargoMatch.grau);
        } else {
          result.failed_fields.push('cargo');
          console.log('❌ Cargo NOT matched for grau:', grau, 'nome:', cargoNome);
          console.log('Available cargos:', cargos.map(c => `"${c.nome}"`));
        }
      }
    }

    console.log('📊 Match result:', {
      matched: result.matched_fields,
      failed: result.failed_fields
    });

    return result;
  } catch (error) {
    console.error('Error matching integrante to structure:', error);
    return result;
  }
};
