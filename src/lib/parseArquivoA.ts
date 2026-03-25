import * as XLSX from 'xlsx';

/**
 * Interface para dados do Arquivo A (hierarquia)
 */
export interface ArquivoAIntegrante {
  id_integrante: number;
  nome_colete: string;
  data_admissao: string | null;
  divisao_original: string;
  regional_original: string;
}

/**
 * Interface para o resultado do parse do Arquivo A
 */
export interface ParseArquivoAResult {
  integrantes: ArquivoAIntegrante[];
  dicionario: Map<string, { id: number; data: string | null; divisaoCompleta: string }>;
  estatisticas: {
    total: number;
    regionais: string[];
    divisoes: string[];
  };
}

/**
 * Remove acentos de um texto
 */
function removerAcentos(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Normaliza nome do integrante (limpa e padroniza)
 * Replica LimpaNome da macro VBA
 */
function limparNome(nome: string | null | undefined): string {
  if (!nome) return '';
  return nome
    .toString()
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

/**
 * Normaliza divisão para criar chave de busca
 * Replica EXATAMENTE a lógica NormalizaDivisao da macro VBA
 */
export function normalizarDivisaoParaBusca(divisao: string): string {
  if (!divisao) return '';
  
  // 1. Trim, uppercase, remove acentos (como a macro VBA)
  let normalizado = removerAcentos(divisao)
    .toUpperCase()
    .trim();
  
  // 2. Substituir "DIVISÃO" por "DIVISAO" (macro VBA: Replace sDivisao, "DIVISÃO", "DIVISAO")
  normalizado = normalizado.replace(/DIVISÃO/g, 'DIVISAO');
  
  // 3. Remover espaços duplos (macro VBA: loop Replace "  " -> " ")
  while (normalizado.includes('  ')) {
    normalizado = normalizado.replace(/  /g, ' ');
  }
  
  // 4. Remover sufixos conhecidos (macro VBA: múltiplos Replace)
  normalizado = normalizado
    .replace(/ - SP$/i, '')
    .replace(/ -SP$/i, '')
    .replace(/-SP$/i, '')
    .replace(/ - S$/i, '')
    .replace(/ -S$/i, '')
    .replace(/-S$/i, '')
    .replace(/–SP$/i, '')  // travessão
    .replace(/– SP$/i, ''); // travessão com espaço
  
  // 5. Loop para remover caracteres finais (macro VBA: Do While loop)
  // Remove espaços, hífens, "S", "P" do final
  normalizado = normalizado.trim();
  while (normalizado.length > 0) {
    const ultimoChar = normalizado.charAt(normalizado.length - 1);
    if ([' ', '-', 'S', 'P'].includes(ultimoChar)) {
      normalizado = normalizado.slice(0, -1);
    } else {
      break;
    }
  }
  
  // 6. Adicionar sufixo padronizado " - SP" (macro VBA: sDivisaoNorm = sDivisaoNorm & " - SP")
  return normalizado.trim() + ' - SP';
}

/**
 * Cria chave única para busca no dicionário
 */
function criarChaveBusca(nome: string, divisao: string): string {
  const nomeNormalizado = limparNome(nome);
  const divisaoNormalizada = normalizarDivisaoParaBusca(divisao);
  return `${nomeNormalizado}|${divisaoNormalizada}`;
}

/**
 * Formata data para padrão ISO (YYYY-MM-DD)
 */
function formatarData(valor: any): string | null {
  if (!valor) return null;
  
  // Se for número (serial date do Excel)
  if (typeof valor === 'number') {
    const date = new Date((valor - 25569) * 86400 * 1000);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
    return null;
  }
  
  // Se for Date
  if (valor instanceof Date) {
    if (!isNaN(valor.getTime())) {
      return valor.toISOString().split('T')[0];
    }
    return null;
  }
  
  // Se for string
  const texto = String(valor).trim();
  if (!texto) return null;
  
  // Formato DD/MM/YYYY
  const matchBR = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (matchBR) {
    return `${matchBR[3]}-${matchBR[2]}-${matchBR[1]}`;
  }
  
  // Formato YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    return texto;
  }
  
  return null;
}

/**
 * Parseia Arquivo A (formato hierárquico)
 * 
 * Estrutura esperada:
 * - Linhas com "REGIONAL" indicam uma nova regional
 * - Linhas não-numéricas na primeira coluna indicam divisões
 * - Linhas com número na primeira coluna são integrantes
 */
export async function parseArquivoA(file: File): Promise<ParseArquivoAResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // Converter para array de arrays (mantém estrutura original)
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
        
        console.log('[parseArquivoA] Total de linhas:', jsonData.length);
        
        const integrantes: ArquivoAIntegrante[] = [];
        const dicionario = new Map<string, { id: number; data: string | null; divisaoCompleta: string }>();
        const regionaisSet = new Set<string>();
        const divisoesSet = new Set<string>();
        
        let regionalAtual = '';
        let divisaoAtual = '';
        
        // Palavras que NÃO devem ser consideradas como divisão
        const palavrasIgnorar = ['numero', 'total', 'total:', 'integrantes', 'id', 'nome', 'data'];
        
        // Sub-graus que NÃO são divisões
        const subgrausIgnorar = [
          'FULL', 'PP', 'MEIO', 'CAMISETA', 'PROSPECT', 
          'HANG AROUND', 'HANGAROUND', 'HA', 'HANG-AROUND'
        ];
        
        // ========================================================
        // DETECÇÃO DINÂMICA DE COLUNAS
        // ========================================================
        // O Arquivo A pode ter diferentes layouts:
        //   Formato antigo (3 cols): ID | Nome | Data
        //   Formato novo  (5 cols): ID | Nome | Cargo | Data | Count
        // Detectamos o cabeçalho para mapear a posição correta
        // ========================================================
        let colNome = 1;    // default: coluna 1
        let colData = 2;    // default: coluna 2 (formato antigo)
        
        // Procurar linha de cabeçalho nas primeiras 10 linhas
        for (let i = 0; i < Math.min(jsonData.length, 10); i++) {
          const linha = jsonData[i];
          if (!linha) continue;
          
          for (let c = 0; c < linha.length; c++) {
            const valor = String(linha[c] || '').toLowerCase().trim();
            // Detectar coluna de data: "dt.adm.", "data", "data admissão", etc.
            if (valor.includes('dt.adm') || valor.includes('dt adm') || 
                valor === 'data' || valor.includes('data_admissao') ||
                valor.includes('data admiss')) {
              colData = c;
              console.log(`[parseArquivoA] Cabeçalho detectado na linha ${i + 1}: coluna de data no índice ${c} ("${linha[c]}")`);
              break;
            }
          }
          
          // Se encontrou coluna de nome também
          for (let c = 0; c < linha.length; c++) {
            const valor = String(linha[c] || '').toLowerCase().trim();
            if (valor === 'apelido' || valor === 'nome' || valor === 'nome_colete') {
              colNome = c;
              break;
            }
          }
        }
        
        console.log(`[parseArquivoA] Layout detectado: colNome=${colNome}, colData=${colData}`);
        
        for (let i = 0; i < jsonData.length; i++) {
          const linha = jsonData[i];
          if (!linha || linha.length === 0) continue;
          
          const primeiraColuna = String(linha[0] || '').trim();
          const primeiraColunaLower = primeiraColuna.toLowerCase();
          const primeiraColunaUpper = primeiraColuna.toUpperCase();
          
          // Detectar regional (linha contém "REGIONAL")
          if (primeiraColunaUpper.includes('REGIONAL')) {
            regionalAtual = primeiraColuna;
            regionaisSet.add(regionalAtual);
            divisaoAtual = '';
            console.log(`[parseArquivoA] Regional detectada: ${regionalAtual}`);
            continue;
          }
          
          // Detectar se é uma linha de integrante (primeira coluna é número)
          const numeroId = parseInt(primeiraColuna);
          if (!isNaN(numeroId) && numeroId > 0) {
            const nome = String(linha[colNome] || '').trim();
            const dataAdmissao = formatarData(linha[colData]);
            
            if (nome) {
              const divisaoParaChave = divisaoAtual || regionalAtual;
              
              const integrante: ArquivoAIntegrante = {
                id_integrante: numeroId,
                nome_colete: nome,
                data_admissao: dataAdmissao,
                divisao_original: divisaoAtual || regionalAtual,
                regional_original: regionalAtual
              };
              
              integrantes.push(integrante);
              
              const chave = criarChaveBusca(nome, divisaoParaChave);
              const dadosIntegrante = {
                id: numeroId,
                data: dataAdmissao,
                divisaoCompleta: divisaoParaChave
              };
              dicionario.set(chave, dadosIntegrante);
              
              if (divisaoAtual && divisaoAtual !== regionalAtual) {
                const chaveAlternativa = criarChaveBusca(nome, regionalAtual);
                if (!dicionario.has(chaveAlternativa)) {
                  dicionario.set(chaveAlternativa, dadosIntegrante);
                }
              }
            }
          } else if (primeiraColuna && primeiraColuna.length > 2) {
            const semNumeros = !/^\d+$/.test(primeiraColuna);
            const ehPalavraIgnorar = palavrasIgnorar.some(p => 
              primeiraColunaLower === p || primeiraColunaLower.startsWith(p + ':')
            );
            
            const ehSubgrau = subgrausIgnorar.includes(primeiraColunaUpper);
            
            const pareceSerDivisao = 
              primeiraColunaUpper.startsWith('DIVISÃO') ||
              primeiraColunaUpper.startsWith('DIVISAO') ||
              primeiraColunaUpper.startsWith('DIVISÂO');
            
            if (semNumeros && !ehPalavraIgnorar && !ehSubgrau && pareceSerDivisao) {
              divisaoAtual = primeiraColuna;
              divisoesSet.add(divisaoAtual);
              console.log(`[parseArquivoA] Divisão detectada: ${divisaoAtual}`);
            } else if (ehSubgrau) {
              console.log(`[parseArquivoA] Sub-grau ignorado: ${primeiraColuna} (mantendo divisão: ${divisaoAtual || 'N/A'})`);
            }
          }
        }
        
        console.log('[parseArquivoA] Resumo:', {
          integrantes: integrantes.length,
          regionais: regionaisSet.size,
          divisoes: divisoesSet.size
        });
        
        // Validar se datas foram parseadas (sanity check)
        const integrantesComData = integrantes.filter(i => i.data_admissao !== null);
        console.log(`[parseArquivoA] Integrantes com data de admissão: ${integrantesComData.length}/${integrantes.length}`);
        if (integrantes.length > 0 && integrantesComData.length === 0) {
          console.warn('[parseArquivoA] ⚠️ NENHUMA data de admissão foi parseada! Verifique o layout do arquivo.');
        }
        
        resolve({
          integrantes,
          dicionario,
          estatisticas: {
            total: integrantes.length,
            regionais: Array.from(regionaisSet),
            divisoes: Array.from(divisoesSet)
          }
        });
        
      } catch (error) {
        console.error('[parseArquivoA] Erro:', error);
        reject(new Error('Erro ao processar Arquivo A: ' + error));
      }
    };

    reader.onerror = () => reject(new Error('Erro ao ler Arquivo A'));
    reader.readAsBinaryString(file);
  });
}

/**
 * Busca integrante no dicionário usando nome e divisão
 * Implementa busca exata + fallback parcial para divisões truncadas
 */
export function buscarNoDicionario(
  dicionario: Map<string, { id: number; data: string | null; divisaoCompleta: string }>,
  nome: string,
  divisao: string
): { id: number; data: string | null; divisaoCompleta: string } | null {
  // 1. Busca exata (mais rápida)
  const chave = criarChaveBusca(nome, divisao);
  const resultadoExato = dicionario.get(chave);
  if (resultadoExato) {
    return resultadoExato;
  }
  
  // 2. Busca com fallback parcial para divisões truncadas
  // Cenário: Arquivo B tem "Divisão São José dos Campos Extremo"
  //          Arquivo A tem "DIVISAO SAO JOSE DOS CAMPOS EXTREMO LESTE - SP"
  const nomeNormalizado = limparNome(nome);
  const divisaoNormalizada = normalizarDivisaoParaBusca(divisao);
  
  // Remover sufixo " - SP" para comparação parcial
  const divisaoSemSufixo = divisaoNormalizada.replace(/ - SP$/, '').trim();
  
  // Se a divisão está vazia ou muito curta, não faz busca parcial
  if (divisaoSemSufixo.length < 5) {
    return null;
  }
  
  for (const [key, valor] of dicionario.entries()) {
    const partes = key.split('|');
    if (partes.length !== 2) continue;
    
    const [nomeChave, divisaoChave] = partes;
    
    // Se o nome NÃO bate, pular
    if (nomeChave !== nomeNormalizado) continue;
    
    // Remover sufixo da divisão do dicionário também
    const divisaoChaveSemSufixo = divisaoChave.replace(/ - SP$/, '').trim();
    
    // Verificar se a divisão do dicionário CONTÉM a divisão buscada (truncada)
    // Ou se começa com ela (ex: "EXTREMO" contido em "EXTREMO LESTE")
    if (divisaoChaveSemSufixo.startsWith(divisaoSemSufixo) || 
        divisaoChaveSemSufixo.includes(divisaoSemSufixo)) {
      console.log(`[buscarNoDicionario] Fallback parcial: "${nome}" com divisão "${divisao}" → encontrado em "${valor.divisaoCompleta}"`);
      return valor;
    }
  }
  
  return null;
}
