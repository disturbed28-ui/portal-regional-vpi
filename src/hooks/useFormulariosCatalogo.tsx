import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface FormularioCatalogo {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: 'builder' | 'link_interno' | 'url_externa';
  link_interno: string | null;
  url_externa: string | null;
  regional_id: string;
  periodicidade: 'diaria' | 'semanal' | 'mensal';
  dias_semana: number[] | null;
  limite_respostas: 'unica' | 'multipla';
  ativo: boolean;
  roles_permitidas: string[] | null;
  global: boolean;
  created_at: string;
  updated_at: string;
  regionais?: { nome: string };
}

// Hook para listar formulários (admin)
export const useFormulariosAdmin = () => {
  return useQuery({
    queryKey: ['formularios-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('formularios_catalogo')
        .select('*, regionais(nome)')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as FormularioCatalogo[];
    }
  });
};

// T5: Hook para listar formulários ativos da regional do usuário
export const useFormulariosUsuario = (regionalId: string | null) => {
  return useQuery({
    queryKey: ['formularios-usuario', regionalId],
    queryFn: async () => {
      if (!regionalId) return [];
      
      // Buscar formulários da regional do usuário OU formulários globais
      const { data, error } = await supabase
        .from('formularios_catalogo')
        .select('*, regionais(nome)')
        .eq('ativo', true)
        .or(`regional_id.eq.${regionalId},global.eq.true`)
        .order('titulo');
      
      if (error) throw error;
      return data as FormularioCatalogo[];
    },
    enabled: !!regionalId
  });
};

// Hook para CRUD de formulários (admin)
export const useFormularioCRUD = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: async (formulario: Omit<FormularioCatalogo, 'id' | 'created_at' | 'updated_at' | 'regionais'>) => {
      const { data, error } = await supabase
        .from('formularios_catalogo')
        .insert([formulario])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['formularios-admin'] });
      toast({ title: "Formulário criado com sucesso!" });
    },
    onError: (error) => {
      toast({ 
        title: "Erro ao criar formulário", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<FormularioCatalogo> & { id: string }) => {
      const { data, error } = await supabase
        .from('formularios_catalogo')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['formularios-admin'] });
      toast({ title: "Formulário atualizado com sucesso!" });
    },
    onError: (error) => {
      toast({ 
        title: "Erro ao atualizar formulário", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  const toggleAtivoMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { data, error } = await supabase
        .from('formularios_catalogo')
        .update({ ativo })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['formularios-admin'] });
      toast({ title: "Status atualizado!" });
    }
  });

  return {
    create: createMutation.mutate,
    update: updateMutation.mutate,
    toggleAtivo: toggleAtivoMutation.mutate,
    isLoading: createMutation.isPending || updateMutation.isPending || toggleAtivoMutation.isPending
  };
};

// Hook para duplicar formulário para outra regional
export const useFormularioDuplicar = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const duplicateMutation = useMutation({
    mutationFn: async ({ formulario, novaRegionalId }: { 
      formulario: FormularioCatalogo; 
      novaRegionalId: string 
    }) => {
      const { data, error } = await supabase
        .from('formularios_catalogo')
        .insert([{
          titulo: formulario.titulo,
          descricao: formulario.descricao,
          tipo: formulario.tipo,
          link_interno: formulario.link_interno,
          url_externa: formulario.url_externa,
          regional_id: novaRegionalId,
          periodicidade: formulario.periodicidade,
          dias_semana: formulario.dias_semana,
          limite_respostas: formulario.limite_respostas,
          ativo: true,
          roles_permitidas: formulario.roles_permitidas
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['formularios-admin'] });
      toast({ title: "Formulário duplicado com sucesso!" });
    },
    onError: (error) => {
      toast({ 
        title: "Erro ao duplicar formulário", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  return {
    duplicate: duplicateMutation.mutate,
    isLoading: duplicateMutation.isPending
  };
};
