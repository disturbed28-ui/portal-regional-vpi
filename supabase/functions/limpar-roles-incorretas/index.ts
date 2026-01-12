import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1'
import { corsHeaders } from '../_shared/cors.ts'

/**
 * Edge Function para limpar roles incorretas
 * 
 * Regras de roles por grau:
 * - Grau I, II, III, IV (Comando): Manter roles atuais
 * - Grau V + Diretor Regional: diretor_regional
 * - Grau V + Outros: regional
 * - Grau VI + Diretor/Subdiretor: diretor_divisao
 * - Grau VI + Social: social_divisao
 * - Grau VI + ADM: adm_divisao
 * - Grau VI + Outros: moderator
 * - Grau VII, VIII, IX, X: Remover roles especiais
 */

interface RelatorioItem {
  profile_id: string;
  nome_colete: string;
  grau: string;
  cargo_nome: string;
  roles_antes: string[];
  roles_depois: string[];
  acao: string;
}

// Roles que podem ser gerenciadas automaticamente
const ROLES_GERENCIADAS = ['regional', 'diretor_regional', 'diretor_divisao', 'social_divisao', 'adm_divisao', 'moderator'];

function determinarRolesCorretas(grau: string | null, cargoNome: string | null): string[] | null {
  if (!grau) return [];
  
  const grauUpper = grau.toUpperCase().trim();
  const cargoLower = (cargoNome || '').toLowerCase();
  
  // Graus I, II, III, IV (Comando) - NÃO ALTERAR
  if (['I', 'II', 'III', 'IV'].includes(grauUpper) || 
      grauUpper.match(/^(I|II|III|IV)$/)) {
    return null; // null = não mexer
  }
  
  // Grau V - Regional
  if (grauUpper === 'V') {
    if (cargoLower.includes('diretor')) {
      return ['diretor_regional'];
    }
    return ['regional'];
  }
  
  // Grau VI - Divisão
  if (grauUpper === 'VI') {
    if (cargoLower.includes('diretor') || cargoLower.includes('sub diretor') || 
        cargoLower.includes('sub-diretor') || cargoLower.includes('subdiretor')) {
      return ['diretor_divisao'];
    }
    if (cargoLower.includes('social')) {
      return ['social_divisao'];
    }
    if (cargoLower.includes('adm')) {
      return ['adm_divisao'];
    }
    // Fallback para Grau VI sem cargo específico
    return ['moderator'];
  }
  
  // Graus VII, VIII, IX, X - Remover roles especiais
  if (['VII', 'VIII', 'IX', 'X'].includes(grauUpper)) {
    return []; // Array vazio = remover roles especiais
  }
  
  return [];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse body
    const body = await req.json().catch(() => ({}));
    const { modo = 'relatorio', admin_user_id } = body;

    // Validar admin
    if (!admin_user_id) {
      return new Response(
        JSON.stringify({ error: 'admin_user_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se é admin
    const { data: adminRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', admin_user_id)
      .eq('role', 'admin')
      .single();

    if (!adminRoles) {
      return new Response(
        JSON.stringify({ error: 'Apenas administradores podem executar esta função' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar todos os profiles com roles gerenciadas
    const { data: usuariosComRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id, role')
      .in('role', ROLES_GERENCIADAS);

    if (rolesError) throw rolesError;

    // Agrupar roles por user_id
    const rolesPorUsuario = new Map<string, string[]>();
    for (const item of usuariosComRoles || []) {
      if (!rolesPorUsuario.has(item.user_id)) {
        rolesPorUsuario.set(item.user_id, []);
      }
      rolesPorUsuario.get(item.user_id)!.push(item.role);
    }

    const relatorio: RelatorioItem[] = [];
    let corrigidos = 0;
    let mantidos = 0;
    let erros = 0;

    // Para cada usuário com roles, verificar se está correto
    for (const [profileId, rolesAtuais] of rolesPorUsuario) {
      try {
        // Buscar integrante vinculado a este profile
        const { data: integrante } = await supabase
          .from('integrantes_portal')
          .select('grau, cargo_nome, nome_colete')
          .eq('profile_id', profileId)
          .eq('ativo', true)
          .single();

        // Buscar dados do profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('grau, nome_colete, cargo')
          .eq('id', profileId)
          .single();

        const grau = integrante?.grau || profile?.grau;
        const cargoNome = integrante?.cargo_nome || profile?.cargo;
        const nomeColete = integrante?.nome_colete || profile?.nome_colete || 'Desconhecido';

        const rolesCorretas = determinarRolesCorretas(grau, cargoNome);

        // null = Comando, não mexer
        if (rolesCorretas === null) {
          mantidos++;
          relatorio.push({
            profile_id: profileId,
            nome_colete: nomeColete,
            grau: grau || 'N/A',
            cargo_nome: cargoNome || 'N/A',
            roles_antes: rolesAtuais,
            roles_depois: rolesAtuais,
            acao: 'MANTIDO (Comando)'
          });
          continue;
        }

        // Verificar se precisa corrigir
        const rolesGerenciadasAtuais = rolesAtuais.filter(r => ROLES_GERENCIADAS.includes(r));
        const precisaCorrigir = 
          rolesGerenciadasAtuais.length !== rolesCorretas.length ||
          !rolesGerenciadasAtuais.every(r => rolesCorretas.includes(r));

        if (!precisaCorrigir) {
          mantidos++;
          relatorio.push({
            profile_id: profileId,
            nome_colete: nomeColete,
            grau: grau || 'N/A',
            cargo_nome: cargoNome || 'N/A',
            roles_antes: rolesAtuais,
            roles_depois: rolesAtuais,
            acao: 'OK'
          });
          continue;
        }

        if (modo === 'executar') {
          // Remover roles gerenciadas atuais
          await supabase
            .from('user_roles')
            .delete()
            .eq('user_id', profileId)
            .in('role', ROLES_GERENCIADAS);

          // Adicionar roles corretas
          for (const role of rolesCorretas) {
            await supabase
              .from('user_roles')
              .upsert({ 
                user_id: profileId, 
                role: role 
              }, { 
                onConflict: 'user_id,role' 
              });
          }

          corrigidos++;
          relatorio.push({
            profile_id: profileId,
            nome_colete: nomeColete,
            grau: grau || 'N/A',
            cargo_nome: cargoNome || 'N/A',
            roles_antes: rolesAtuais,
            roles_depois: rolesCorretas,
            acao: 'CORRIGIDO'
          });
        } else {
          // Modo relatório - apenas listar
          corrigidos++;
          relatorio.push({
            profile_id: profileId,
            nome_colete: nomeColete,
            grau: grau || 'N/A',
            cargo_nome: cargoNome || 'N/A',
            roles_antes: rolesAtuais,
            roles_depois: rolesCorretas,
            acao: 'PENDENTE CORREÇÃO'
          });
        }
      } catch (error) {
        erros++;
        console.error(`Erro ao processar profile ${profileId}:`, error);
      }
    }

    // Ordenar relatório por ação
    relatorio.sort((a, b) => {
      const ordem = { 'PENDENTE CORREÇÃO': 0, 'CORRIGIDO': 1, 'MANTIDO (Comando)': 2, 'OK': 3 };
      return (ordem[a.acao as keyof typeof ordem] || 99) - (ordem[b.acao as keyof typeof ordem] || 99);
    });

    return new Response(
      JSON.stringify({
        success: true,
        modo,
        resumo: {
          total_analisados: rolesPorUsuario.size,
          corrigidos: corrigidos,
          mantidos: mantidos,
          erros: erros
        },
        relatorio: relatorio
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[limpar-roles-incorretas] Erro:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno', 
        details: error instanceof Error ? error.message : 'Erro desconhecido' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
