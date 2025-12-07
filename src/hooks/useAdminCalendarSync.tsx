import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { fetchCalendarEvents } from '@/lib/googleCalendar';

/**
 * Hook que dispara sincronização da Agenda em background para admins ao logar.
 * Garante que o delta de eventos cancelados/removidos esteja atualizado.
 */
export const useAdminCalendarSync = () => {
  const { user } = useAuth();
  const { hasRole, loading: roleLoading } = useUserRole(user?.id);
  const syncAttempted = useRef(false);

  useEffect(() => {
    // Só executa para admins logados
    if (roleLoading || !user) return;
    
    const isAdmin = hasRole('admin');
    if (!isAdmin) return;
    
    // Evitar rodar múltiplas vezes na mesma sessão
    const syncKey = `calendar_sync_${user.id}_${new Date().toDateString()}`;
    if (sessionStorage.getItem(syncKey) || syncAttempted.current) return;
    
    syncAttempted.current = true;

    // Executar sincronização em background (com delay para não impactar login)
    const timer = setTimeout(async () => {
      try {
        console.log('[AdminCalendarSync] Iniciando sincronização em background...');
        await fetchCalendarEvents();
        sessionStorage.setItem(syncKey, 'done');
        console.log('[AdminCalendarSync] ✅ Sincronização concluída');
      } catch (error) {
        console.error('[AdminCalendarSync] Erro na sincronização:', error);
      }
    }, 3000); // Delay de 3 segundos

    return () => clearTimeout(timer);
  }, [user, hasRole, roleLoading]);
};
