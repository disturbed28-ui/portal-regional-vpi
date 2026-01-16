/**
 * Função centralizada para determinar escopo de visibilidade de dados.
 * 
 * REGRA PRINCIPAL: Admin tem acesso FUNCIONAL total ao sistema,
 * mas visibilidade de DADOS restrita à sua regional de origem.
 */

import { romanToNumber } from './grauUtils';

export interface EscopoVisibilidade {
  nivelAcesso: 'comando' | 'regional' | 'divisao';
  regionalId: string | null;
  regionalTexto: string | null;
  divisaoId: string | null;
  divisaoTexto: string | null;
  filtroObrigatorio: boolean; // true = deve aplicar filtro de regional/divisão
}

interface ProfileData {
  grau?: string | null;
  regional_id?: string | null;
  regional?: string | null;
  divisao_id?: string | null;
  divisao?: string | null;
  integrante?: {
    grau?: string | null;
    regional_texto?: string | null;
    divisao_texto?: string | null;
    regional_id?: string | null;
    divisao_id?: string | null;
  } | null;
}

/**
 * Determina o escopo de visibilidade de dados do usuário.
 * 
 * @param profile - Dados do perfil do usuário
 * @param roles - Array de roles do usuário (ex: ['admin', 'diretor_divisao'])
 * @param isAdmin - Se o usuário tem role 'admin'
 * @returns EscopoVisibilidade com nível de acesso e filtros obrigatórios
 */
export function getEscopoVisibilidade(
  profile: ProfileData | null | undefined,
  roles: string[],
  isAdmin: boolean
): EscopoVisibilidade {
  // Default seguro: sem visibilidade
  if (!profile) {
    return {
      nivelAcesso: 'divisao',
      regionalId: null,
      regionalTexto: null,
      divisaoId: null,
      divisaoTexto: null,
      filtroObrigatorio: true
    };
  }

  // Extrair dados do profile (priorizando dados do integrante quando disponíveis)
  const grau = profile.integrante?.grau || profile.grau || null;
  const regionalId = profile.integrante?.regional_id || profile.regional_id || null;
  const regionalTexto = profile.integrante?.regional_texto || profile.regional || null;
  const divisaoId = profile.integrante?.divisao_id || profile.divisao_id || null;
  const divisaoTexto = profile.integrante?.divisao_texto || profile.divisao || null;
  const grauNum = romanToNumber(grau);

  // REGRA PRINCIPAL: Admin tem acesso funcional total,
  // mas visibilidade RESTRITA à sua regional de origem
  if (isAdmin) {
    console.log('[getEscopoVisibilidade] Admin detectado - aplicando filtro de regional:', {
      regionalId,
      regionalTexto
    });
    
    return {
      nivelAcesso: 'regional', // Admin vê como regional
      regionalId,
      regionalTexto,
      divisaoId: null, // Não filtra por divisão específica
      divisaoTexto: null,
      filtroObrigatorio: true // SEMPRE aplicar filtro para admin
    };
  }
  
  // Role 'comando' ou Grau I-IV: visibilidade TOTAL (sem filtro)
  if (roles.includes('comando') || grauNum <= 4) {
    console.log('[getEscopoVisibilidade] Comando (grau I-IV) - visibilidade total');
    
    return {
      nivelAcesso: 'comando',
      regionalId: null,
      regionalTexto: null,
      divisaoId: null,
      divisaoTexto: null,
      filtroObrigatorio: false // Sem filtro obrigatório
    };
  }
  
  // Grau V: visibilidade da sua REGIONAL
  if (grauNum === 5) {
    console.log('[getEscopoVisibilidade] Grau V - filtro por regional:', regionalTexto);
    
    return {
      nivelAcesso: 'regional',
      regionalId,
      regionalTexto,
      divisaoId: null,
      divisaoTexto: null,
      filtroObrigatorio: true
    };
  }
  
  // Grau VI+: visibilidade apenas da sua DIVISÃO
  console.log('[getEscopoVisibilidade] Grau VI+ - filtro por divisão:', divisaoTexto);
  
  return {
    nivelAcesso: 'divisao',
    regionalId,
    regionalTexto,
    divisaoId,
    divisaoTexto,
    filtroObrigatorio: true
  };
}

/**
 * Verifica se o escopo permite visibilidade total (sem filtro obrigatório).
 */
export function temVisibilidadeTotal(escopo: EscopoVisibilidade): boolean {
  return escopo.nivelAcesso === 'comando' && !escopo.filtroObrigatorio;
}

/**
 * Verifica se o escopo requer filtro por regional.
 */
export function requerFiltroRegional(escopo: EscopoVisibilidade): boolean {
  return escopo.filtroObrigatorio && escopo.nivelAcesso === 'regional';
}

/**
 * Verifica se o escopo requer filtro por divisão.
 */
export function requerFiltroDivisao(escopo: EscopoVisibilidade): boolean {
  return escopo.filtroObrigatorio && escopo.nivelAcesso === 'divisao';
}
