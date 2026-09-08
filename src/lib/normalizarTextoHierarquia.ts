/**
 * Funções centralizadas de normalização de texto para hierarquia (divisão/regional/comando)
 * Garante consistência em todo o sistema: importações, edições manuais e agrupamentos
 */

/**
 * Remove acentos e converte para maiúscula
 */
export function normalizarTexto(texto: string): string {
  if (!texto) return '';
  return texto
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .trim();
}

/**
 * Normaliza divisão para formato padrão: DIVISAO [NOME] - SP
 * Trata também casos de Grau V onde divisão é uma regional
 */
export function normalizarDivisaoTexto(texto: string): string {
  if (!texto) return '';
  let normalizado = normalizarTexto(texto);
  
  // Se contém REGIONAL (caso Grau V), manter prefixo REGIONAL
  if (normalizado.includes('REGIONAL')) {
    normalizado = normalizado.replace(/^(DIVISAO\s+)?REGIONAL\s*/i, 'REGIONAL ');
  } else {
    // Garantir prefixo DIVISAO
    if (!normalizado.startsWith('DIVISAO')) {
      normalizado = 'DIVISAO ' + normalizado;
    }
  }
  
  // Garantir sufixo - SP
  if (!normalizado.endsWith('- SP')) {
    normalizado = normalizado.replace(/\s*-?\s*SP?\s*$/, '') + ' - SP';
  }
  
  return normalizado;
}

/**
 * Normaliza regional para formato padrão: REGIONAL [NOME] - SP
 */
export function normalizarRegionalTexto(texto: string): string {
  if (!texto) return '';
  let normalizado = normalizarTexto(texto);
  
  // Remover prefixo existente e adicionar padronizado
  normalizado = normalizado.replace(/^REGIONAL\s*/, '');
  normalizado = 'REGIONAL ' + normalizado;
  
  // Garantir sufixo - SP
  if (!normalizado.endsWith('- SP')) {
    normalizado = normalizado.replace(/\s*-?\s*SP?\s*$/, '') + ' - SP';
  }
  
  return normalizado;
}

/**
 * Normaliza comando para formato padrão: COMANDO [NOME]
 */
export function normalizarComandoTexto(texto: string): string {
  if (!texto) return '';
  let normalizado = normalizarTexto(texto);
  
  // Remover prefixo existente e adicionar padronizado
  normalizado = normalizado.replace(/^COMANDO\s*/, '');
  normalizado = 'COMANDO ' + normalizado;
  
  return normalizado;
}

/**
 * Abrevia nome de divisão para exibição em telas pequenas (mobile 9:18).
 * NÃO altera o dado persistido — apenas display.
 * Regras: DIVISAO -> DIV. | cidades consagradas (SJC, SP, RP, SJRP...) |
 * direções (NORTE -> N., EXTREMO -> EXT.) | fallback preserva a última palavra
 * (diferenciador, ex.: "EXTREMO LESTE" vs "EXTREMO NORTE").
 */
export function abreviarDivisao(texto: string, limite = 28): string {
  if (!texto) return '';
  let nome = normalizarTexto(texto);

  const cidades: Record<string, string> = {
    'SAO JOSE DOS CAMPOS': 'SJC',
    'SAO JOSE DO RIO PRETO': 'SJRP',
    'SAO PAULO': 'SP',
    'RIBEIRAO PRETO': 'RP',
    'CAMPINAS': 'CAMP.',
    'SAO BERNARDO DO CAMPO': 'SBC',
    'SANTO ANDRE': 'S. ANDRE',
    'SAO CAETANO DO SUL': 'SCS',
    'JUNDIAI': 'JDI',
  };
  for (const [completo, abrev] of Object.entries(cidades)) {
    if (nome.includes(completo)) {
      nome = nome.replace(completo, abrev);
      break;
    }
  }

  const direcoes: [RegExp, string][] = [
    [/\bDIVISAO\b/g, 'DIV.'],
    [/\bEXTREMO\b|\bEXTREMA\b/g, 'EXT.'],
    [/\bNORTE\b/g, 'N.'],
    [/\bSUL\b/g, 'S.'],
    [/\bLESTE\b/g, 'L.'],
    [/\bOESTE\b/g, 'O.'],
    [/\bCENTRO\b/g, 'C.'],
    [/\bZONA\b/g, 'Z.'],
  ];
  for (const [re, abrev] of direcoes) {
    nome = nome.replace(re, abrev);
  }
  nome = nome.replace(/\s+/g, ' ').trim();

  // Fallback: se ainda exceder o limite, abrevia palavras intermediárias
  // preservando a primeira e a última palavra (diferenciador)
  if (nome.length > limite) {
    const partes = nome.split(/(\s+-\s+|\s+)/).filter(Boolean);
    const palavras = nome.replace(' - ', ' § ').split(' ');
    if (palavras.length > 3) {
      const abreviado = palavras.map((p, i) => {
        const ultima = i === palavras.length - 1;
        const primeira = i === 0;
        if (primeira || ultima || p === '§' || p.length <= 2) return p;
        return p[0] + '.';
      }).join(' ').replace(/ § /g, ' - ');
      if (abreviado.length < nome.length) nome = abreviado;
    }
    void partes;
  }

  return nome;
}
