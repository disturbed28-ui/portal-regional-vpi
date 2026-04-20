import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface WhatsAppTemplate {
  id: string;
  chave: string;
  titulo: string;
  descricao: string | null;
  corpo: string;
  escopo: string;
  variaveis_disponiveis: string[];
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export type NewWhatsAppTemplate = Omit<WhatsAppTemplate, "id" | "created_at" | "updated_at">;

export const useWhatsAppTemplates = () => {
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["whatsapp-templates"],
    queryFn: async (): Promise<WhatsAppTemplate[]> => {
      const { data, error } = await supabase
        .from("notificacoes_whatsapp_templates")
        .select("*")
        .order("escopo", { ascending: true })
        .order("titulo", { ascending: true });
      if (error) throw error;
      return (data ?? []) as WhatsAppTemplate[];
    },
  });

  const create = useMutation({
    mutationFn: async (tpl: NewWhatsAppTemplate) => {
      const { error } = await supabase.from("notificacoes_whatsapp_templates").insert(tpl);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Template criado");
      qc.invalidateQueries({ queryKey: ["whatsapp-templates"] });
    },
    onError: (e: Error) => toast.error("Erro ao criar template: " + e.message),
  });

  const update = useMutation({
    mutationFn: async (tpl: Partial<WhatsAppTemplate> & { id: string }) => {
      const { id, ...rest } = tpl;
      const { error } = await supabase
        .from("notificacoes_whatsapp_templates")
        .update(rest)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Template atualizado");
      qc.invalidateQueries({ queryKey: ["whatsapp-templates"] });
    },
    onError: (e: Error) => toast.error("Erro ao atualizar template: " + e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notificacoes_whatsapp_templates")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Template removido");
      qc.invalidateQueries({ queryKey: ["whatsapp-templates"] });
    },
    onError: (e: Error) => toast.error("Erro ao remover template: " + e.message),
  });

  return { ...list, create, update, remove };
};

export const useWhatsAppLogs = (limit = 100) => {
  return useQuery({
    queryKey: ["whatsapp-logs", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notificacoes_whatsapp_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },
  });
};
