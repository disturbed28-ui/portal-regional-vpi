import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

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
  status: string;
  confirmado_em: string;
  integrante: {
    id: string;
    nome_colete: string;
    cargo_nome: string | null;
    grau: string | null;
    divisao_texto: string;
    profile_id: string | null;
  };
}

export const useEventoPresenca = (eventoId: string | null) => {
  const [evento, setEvento] = useState<EventoAgenda | null>(null);
  const [presencas, setPresencas] = useState<Presenca[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

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
        status,
        confirmado_em,
        integrante:integrantes_portal (
          id,
          nome_colete,
          cargo_nome,
          grau,
          divisao_texto,
          profile_id
        )
      `)
      .eq('evento_agenda_id', eventoAgendaId);

    if (error) {
      console.error('Erro ao buscar presenças:', error);
    } else {
      setPresencas(data as any || []);
    }
  };

  const inicializarListaPresenca = async (
    eventoAgendaId: string, 
    divisaoId: string,
    userId: string
  ) => {
    console.log('[inicializarListaPresenca] Inicializando...', { eventoAgendaId, divisaoId });
    
    const { data, error } = await supabase.functions.invoke('manage-presenca', {
      body: {
        action: 'initialize',
        user_id: userId,
        evento_agenda_id: eventoAgendaId,
        divisao_id: divisaoId,
      }
    });
    
    if (error) {
      console.error('[inicializarListaPresenca] Erro:', error);
      throw error;
    }
    
    console.log(`[inicializarListaPresenca] ${data.count} integrantes registrados como ausentes`);
    return data;
  };

  const criarEvento = async (
    eventoGoogleId: string,
    titulo: string,
    dataEvento: string,
    regionalId: string | null,
    divisaoId: string | null,
    tipoEvento: string | null
  ) => {
    if (!user) {
      console.error('[criarEvento] Usuário não autenticado');
      toast({
        title: "Erro",
        description: "Usuário não autenticado",
        variant: "destructive",
      });
      return null;
    }

    const userId = user.id;
    console.log('[criarEvento] Criando evento via edge function...', {
      evento_id: eventoGoogleId,
      titulo,
      user_id: userId
    });

    const { data, error } = await supabase.functions.invoke('manage-evento', {
      body: {
        evento_id: eventoGoogleId,
        titulo,
        data_evento: dataEvento,
        regional_id: regionalId,
        divisao_id: divisaoId,
        tipo_evento: tipoEvento,
        user_id: userId,
      }
    });

    if (error) {
      console.error('[criarEvento] Erro ao criar evento:', error);
      toast({
        title: "Erro",
        description: "Não foi possível criar o evento",
        variant: "destructive",
      });
      return null;
    }

    console.log('[criarEvento] Evento criado com sucesso:', data);
    setEvento(data.data);
    
    // Inicializar lista de presença após criar evento
    if (data.data && divisaoId && userId) {
      try {
        await inicializarListaPresenca(data.data.id, divisaoId, userId);
        await fetchPresencas(data.data.id);
      } catch (error) {
        console.error('[criarEvento] Erro ao inicializar lista:', error);
      }
    }
    
    return data.data;
  };

  const registrarPresenca = async (integranteId: string, profileId: string) => {
    if (!evento || !user) return;

    const userId = user.id;
    console.log('[registrarPresenca] Registrando presença via edge function...', {
      evento_agenda_id: evento.id,
      integrante_id: integranteId,
      user_id: userId
    });

    const { data, error } = await supabase.functions.invoke('manage-presenca', {
      body: {
        action: 'add',
        user_id: userId,
        evento_agenda_id: evento.id,
        integrante_id: integranteId,
        profile_id: profileId,
      }
    });

    if (error) {
      console.error('[registrarPresenca] Erro ao registrar presença:', error);
      
      if (error.message && error.message.includes('409')) {
        toast({
          title: "Presença já registrada",
          description: "Este integrante já está na lista de presença",
        });
      } else {
        toast({
          title: "Erro",
          description: "Não foi possível registrar a presença",
          variant: "destructive",
        });
      }
      return;
    }
    
    if (data?.error) {
      console.error('[registrarPresenca] Erro retornado:', data.error);
      if (data.error === 'Presença já registrada') {
        toast({
          title: "Presença já registrada",
          description: "Este integrante já está na lista de presença",
        });
      } else {
        toast({
          title: "Erro",
          description: data.error,
          variant: "destructive",
        });
      }
      return;
    }
    
    toast({
      title: "Sucesso",
      description: "Presença registrada com sucesso!",
    });
    fetchPresencas(evento.id);
  };

  const removerPresenca = async (integranteId: string) => {
    if (!evento || !user) return;
    
    const userId = user.id;
    console.log('[removerPresenca] Marcando como ausente via edge function...', {
      integrante_id: integranteId,
      user_id: userId
    });

    const { data, error } = await supabase.functions.invoke('manage-presenca', {
      body: {
        action: 'remove',
        user_id: userId,
        evento_agenda_id: evento.id,
        integrante_id: integranteId,
      }
    });

    if (error) {
      console.error('[removerPresenca] Erro ao marcar ausente:', error);
      toast({
        title: "Erro",
        description: "Não foi possível marcar como ausente",
        variant: "destructive",
      });
    } else if (data?.error) {
      console.error('[removerPresenca] Erro retornado:', data.error);
      toast({
        title: "Erro",
        description: data.error,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Sucesso",
        description: "Marcado como ausente",
      });
      fetchPresencas(evento.id);
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
