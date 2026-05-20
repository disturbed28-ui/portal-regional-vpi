import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface LinkUtil {
  id: string;
  titulo: string;
  url: string;
  ativo: boolean;
  grupo_id: string;
  ordem: number;
  created_at: string;
}

export interface LinkUtilGrupo {
  id: string;
  nome: string;
  slug: string;
  icone: string;
  ordem: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export const useLinksUteis = (apenasAtivos: boolean = false) => {
  const [links, setLinks] = useState<LinkUtil[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchLinks = async () => {
    setLoading(true);
    let query = supabase
      .from('links_uteis')
      .select('*')
      .order('ordem', { ascending: true })
      .order('created_at', { ascending: true });

    if (apenasAtivos) query = query.eq('ativo', true);

    const { data, error } = await query;

    if (error) {
      console.error('[useLinksUteis] Erro ao buscar links:', error);
      toast({ title: "Erro", description: "Falha ao carregar links", variant: "destructive" });
      setLinks([]);
    } else {
      setLinks((data as LinkUtil[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLinks();
    const channel = supabase
      .channel('links-uteis-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'links_uteis' }, () => fetchLinks())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [apenasAtivos]);

  const addLink = async (titulo: string, url: string, grupo_id: string, ativo: boolean = true, ordem: number = 0) => {
    const { error } = await supabase
      .from('links_uteis')
      .insert({ titulo, url, ativo, grupo_id, ordem });

    if (error) {
      toast({ title: "Erro", description: "Falha ao adicionar link", variant: "destructive" });
      return false;
    }
    toast({ title: "Link adicionado com sucesso!" });
    return true;
  };

  const updateLink = async (id: string, titulo: string, url: string, ativo: boolean, grupo_id: string) => {
    const { error } = await supabase
      .from('links_uteis')
      .update({ titulo, url, ativo, grupo_id })
      .eq('id', id);
    if (error) {
      toast({ title: "Erro", description: "Falha ao atualizar link", variant: "destructive" });
      return false;
    }
    toast({ title: "Link atualizado com sucesso!" });
    return true;
  };

  const toggleAtivo = async (id: string, ativo: boolean) => {
    const { error } = await supabase.from('links_uteis').update({ ativo: !ativo }).eq('id', id);
    if (error) {
      toast({ title: "Erro", description: "Falha ao alterar status", variant: "destructive" });
      return false;
    }
    return true;
  };

  const deleteLink = async (id: string) => {
    const { error } = await supabase.from('links_uteis').delete().eq('id', id);
    if (error) {
      toast({ title: "Erro", description: "Falha ao excluir link", variant: "destructive" });
      return false;
    }
    toast({ title: "Link excluído com sucesso!" });
    return true;
  };

  const reorderLinks = async (updates: { id: string; ordem: number }[]) => {
    const promises = updates.map(u =>
      supabase.from('links_uteis').update({ ordem: u.ordem }).eq('id', u.id)
    );
    const results = await Promise.all(promises);
    const erro = results.find(r => r.error);
    if (erro?.error) {
      toast({ title: "Erro", description: "Falha ao reordenar links", variant: "destructive" });
      return false;
    }
    return true;
  };

  return { links, loading, addLink, updateLink, toggleAtivo, deleteLink, reorderLinks, refetch: fetchLinks };
};

export const useLinksUteisGrupos = (apenasAtivos: boolean = false) => {
  const [grupos, setGrupos] = useState<LinkUtilGrupo[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchGrupos = async () => {
    setLoading(true);
    let query = supabase
      .from('links_uteis_grupos')
      .select('*')
      .order('ordem', { ascending: true })
      .order('nome', { ascending: true });
    if (apenasAtivos) query = query.eq('ativo', true);

    const { data, error } = await query;
    if (error) {
      console.error('[useLinksUteisGrupos] Erro:', error);
      setGrupos([]);
    } else {
      setGrupos((data as LinkUtilGrupo[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchGrupos();
    const channel = supabase
      .channel('links-uteis-grupos-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'links_uteis_grupos' }, () => fetchGrupos())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [apenasAtivos]);

  const addGrupo = async (nome: string, slug: string, icone: string, ordem: number = 0) => {
    const { error } = await supabase
      .from('links_uteis_grupos')
      .insert({ nome, slug, icone, ordem, ativo: true });
    if (error) {
      toast({ title: "Erro", description: error.message.includes('duplicate') ? 'Já existe um grupo com este nome ou slug' : 'Falha ao criar grupo', variant: "destructive" });
      return false;
    }
    toast({ title: "Grupo criado!", description: "Configure permissões em Admin > Permissões." });
    return true;
  };

  const updateGrupo = async (id: string, nome: string, slug: string, icone: string, ativo: boolean) => {
    const { error } = await supabase
      .from('links_uteis_grupos')
      .update({ nome, slug, icone, ativo })
      .eq('id', id);
    if (error) {
      toast({ title: "Erro", description: error.message.includes('duplicate') ? 'Já existe um grupo com este nome ou slug' : 'Falha ao atualizar grupo', variant: "destructive" });
      return false;
    }
    toast({ title: "Grupo atualizado!" });
    return true;
  };

  const deleteGrupo = async (id: string) => {
    const { error } = await supabase.from('links_uteis_grupos').delete().eq('id', id);
    if (error) {
      toast({ title: "Não foi possível excluir", description: error.message.includes('contém links') ? 'O grupo possui links. Remova ou mova-os primeiro.' : error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "Grupo excluído!" });
    return true;
  };

  const reorderGrupos = async (updates: { id: string; ordem: number }[]) => {
    const promises = updates.map(u =>
      supabase.from('links_uteis_grupos').update({ ordem: u.ordem }).eq('id', u.id)
    );
    const results = await Promise.all(promises);
    const erro = results.find(r => r.error);
    if (erro?.error) {
      toast({ title: "Erro", description: "Falha ao reordenar grupos", variant: "destructive" });
      return false;
    }
    return true;
  };

  return { grupos, loading, addGrupo, updateGrupo, deleteGrupo, reorderGrupos, refetch: fetchGrupos };
};
