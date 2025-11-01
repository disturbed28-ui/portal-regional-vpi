import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface EventoAgenda {
  id: string;
  evento_id: string;
  titulo: string;
  data_evento: string;
  regional_id: string | null;
  divisao_id: string | null;
  tipo_evento: string | null;
}

interface Presenca {
  id: string;
  integrante_id: string;
  confirmado_em: string;
  integrante: {
    id: string;
    nome_colete: string;
    cargo_nome: string | null;
    grau: string | null;
    divisao_texto: string;
  };
}

export const useEventoPresenca = (eventoId: string | null) => {
  const [evento, setEvento] = useState<EventoAgenda | null>(null);
  const [presencas, setPresencas] = useState<Presenca[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (eventoId) {
      fetchEvento();
    }
  }, [eventoId]);

  const fetchEvento = async () => {
    if (!eventoId) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('eventos_agenda')
      .select('*')
      .eq('evento_id', eventoId)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar evento:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar o evento",
        variant: "destructive",
      });
    } else if (data) {
      setEvento(data);
      fetchPresencas(data.id);
    }
    
    setLoading(false);
  };

  const fetchPresencas = async (eventoAgendaId: string) => {
    const { data, error } = await supabase
      .from('presencas')
      .select(`
        id,
        integrante_id,
        confirmado_em,
        integrante:integrantes_portal (
          id,
          nome_colete,
          cargo_nome,
          grau,
          divisao_texto
        )
      `)
      .eq('evento_agenda_id', eventoAgendaId);

    if (error) {
      console.error('Erro ao buscar presenças:', error);
    } else {
      setPresencas(data as any || []);
    }
  };

  const criarEvento = async (
    eventoGoogleId: string,
    titulo: string,
    dataEvento: string,
    regionalId: string | null,
    divisaoId: string | null,
    tipoEvento: string | null
  ) => {
    const { data, error } = await supabase
      .from('eventos_agenda')
      .insert({
        evento_id: eventoGoogleId,
        titulo,
        data_evento: dataEvento,
        regional_id: regionalId,
        divisao_id: divisaoId,
        tipo_evento: tipoEvento,
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar evento:', error);
      toast({
        title: "Erro",
        description: "Não foi possível criar o evento",
        variant: "destructive",
      });
      return null;
    }

    setEvento(data);
    return data;
  };

  const registrarPresenca = async (integranteId: string, profileId: string) => {
    if (!evento) return;

    const { error } = await supabase
      .from('presencas')
      .insert({
        evento_agenda_id: evento.id,
        integrante_id: integranteId,
        profile_id: profileId,
        confirmado_por: (await supabase.auth.getUser()).data.user?.id,
      });

    if (error) {
      if (error.code === '23505') {
        toast({
          title: "Aviso",
          description: "Este integrante já está registrado na lista",
          variant: "destructive",
        });
      } else {
        console.error('Erro ao registrar presença:', error);
        toast({
          title: "Erro",
          description: "Não foi possível registrar a presença",
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Sucesso",
        description: "Presença registrada com sucesso!",
      });
      fetchPresencas(evento.id);
    }
  };

  const removerPresenca = async (presencaId: string) => {
    const { error } = await supabase
      .from('presencas')
      .delete()
      .eq('id', presencaId);

    if (error) {
      console.error('Erro ao remover presença:', error);
      toast({
        title: "Erro",
        description: "Não foi possível remover a presença",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Sucesso",
        description: "Presença removida",
      });
      if (evento) {
        fetchPresencas(evento.id);
      }
    }
  };

  return {
    evento,
    presencas,
    loading,
    criarEvento,
    registrarPresenca,
    removerPresenca,
    refetch: fetchEvento,
  };
};
