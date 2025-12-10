import { supabase } from "@/integrations/supabase/client";

// Comandos
export async function createComando(nome: string) {
  const { data, error } = await supabase
    .from('comandos')
    .insert({ nome })
    .select()
    .single();
  
  return { data, error };
}

export async function updateComando(id: string, nome: string) {
  const { data, error } = await supabase
    .from('comandos')
    .update({ nome })
    .eq('id', id)
    .select()
    .single();
  
  return { data, error };
}

export async function deleteComando(id: string) {
  const { error } = await supabase
    .from('comandos')
    .delete()
    .eq('id', id);
  
  return { error };
}

// Regionais
export async function createRegional(nome: string, comandoId: string, sigla: string | null = null) {
  const { data, error } = await supabase
    .from('regionais')
    .insert({ nome, comando_id: comandoId, sigla })
    .select()
    .single();
  
  return { data, error };
}

export async function updateRegional(id: string, nome: string, comandoId: string, sigla: string | null = null) {
  const { data, error } = await supabase
    .from('regionais')
    .update({ nome, comando_id: comandoId, sigla })
    .eq('id', id)
    .select()
    .single();
  
  return { data, error };
}

export async function deleteRegional(id: string) {
  const { error } = await supabase
    .from('regionais')
    .delete()
    .eq('id', id);
  
  return { error };
}

// Divisões
export async function createDivisao(nome: string, regionalId: string) {
  const { data, error } = await supabase
    .from('divisoes')
    .insert({ nome, regional_id: regionalId })
    .select()
    .single();
  
  return { data, error };
}

export async function updateDivisao(id: string, nome: string, regionalId: string) {
  const { data, error } = await supabase
    .from('divisoes')
    .update({ nome, regional_id: regionalId })
    .eq('id', id)
    .select()
    .single();
  
  return { data, error };
}

export async function deleteDivisao(id: string) {
  const { error } = await supabase
    .from('divisoes')
    .delete()
    .eq('id', id);
  
  return { error };
}

// Cargos
export async function createCargo(grau: string, nome: string, nivel: number | null) {
  const { data, error } = await supabase
    .from('cargos')
    .insert({ grau, nome, nivel })
    .select()
    .single();
  
  return { data, error };
}

export async function updateCargo(id: string, grau: string, nome: string, nivel: number | null) {
  const { data, error } = await supabase
    .from('cargos')
    .update({ grau, nome, nivel })
    .eq('id', id)
    .select()
    .single();
  
  return { data, error };
}

export async function deleteCargo(id: string) {
  const { error } = await supabase
    .from('cargos')
    .delete()
    .eq('id', id);
  
  return { error };
}

// Funções
export async function createFuncao(nome: string, ordem: number | null) {
  const { data, error } = await supabase
    .from('funcoes')
    .insert({ nome, ordem })
    .select()
    .single();
  
  return { data, error };
}

export async function updateFuncao(id: string, nome: string, ordem: number | null) {
  const { data, error } = await supabase
    .from('funcoes')
    .update({ nome, ordem })
    .eq('id', id)
    .select()
    .single();
  
  return { data, error };
}

export async function deleteFuncao(id: string) {
  const { error } = await supabase
    .from('funcoes')
    .delete()
    .eq('id', id);
  
  return { error };
}
