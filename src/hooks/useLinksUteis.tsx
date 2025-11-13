import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface LinkUtil {
  id: string;
  titulo: string;
  url: string;
  ativo: boolean;
  created_at: string;
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
      .order('created_at', { ascending: true });

    if (apenasAtivos) {
      query = query.eq('ativo', true);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[useLinksUteis] Erro ao buscar links:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar links",
        variant: "destructive",
      });
      setLinks([]);
    } else {
      setLinks(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLinks();

    const channel = supabase
      .channel('links-uteis-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'links_uteis',
        },
        () => {
          fetchLinks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [apenasAtivos]);

  const addLink = async (titulo: string, url: string, ativo: boolean = true) => {
    const { error } = await supabase
      .from('links_uteis')
      .insert({ titulo, url, ativo });

    if (error) {
      toast({
        title: "Erro",
        description: "Falha ao adicionar link",
        variant: "destructive",
      });
      return false;
    }
    
    toast({ title: "Link adicionado com sucesso!" });
    return true;
  };

  const updateLink = async (id: string, titulo: string, url: string, ativo: boolean) => {
    const { error } = await supabase
      .from('links_uteis')
      .update({ titulo, url, ativo })
      .eq('id', id);

    if (error) {
      toast({
        title: "Erro",
        description: "Falha ao atualizar link",
        variant: "destructive",
      });
      return false;
    }
    
    toast({ title: "Link atualizado com sucesso!" });
    return true;
  };

  const toggleAtivo = async (id: string, ativo: boolean) => {
    const { error } = await supabase
      .from('links_uteis')
      .update({ ativo: !ativo })
      .eq('id', id);

    if (error) {
      toast({
        title: "Erro",
        description: "Falha ao alterar status",
        variant: "destructive",
      });
      return false;
    }
    
    return true;
  };

  const deleteLink = async (id: string) => {
    const { error } = await supabase
      .from('links_uteis')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: "Erro",
        description: "Falha ao excluir link",
        variant: "destructive",
      });
      return false;
    }
    
    toast({ title: "Link excluído com sucesso!" });
    return true;
  };

  return {
    links,
    loading,
    addLink,
    updateLink,
    toggleAtivo,
    deleteLink,
    refetch: fetchLinks,
  };
};
