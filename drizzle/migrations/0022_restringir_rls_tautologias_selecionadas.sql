-- 1. agenda_calendars: restringir leitura a integrantes ativos e admins
DROP POLICY IF EXISTS "Autenticados podem ler agendas" ON public.agenda_calendars;
CREATE POLICY "Autenticados podem ler agendas"
ON public.agenda_calendars
FOR SELECT
TO authenticated
USING (public.is_integrante_ativo());

-- 2. eventos_agenda: restringir leitura a integrantes ativos e admins
DROP POLICY IF EXISTS "Autenticados podem ver eventos" ON public.eventos_agenda;
CREATE POLICY "Autenticados podem ver eventos"
ON public.eventos_agenda
FOR SELECT
TO authenticated
USING (public.is_integrante_ativo());

-- 3. justificativas_peso: restringir leitura a integrantes ativos e admins
DROP POLICY IF EXISTS "Todos podem ver justificativas" ON public.justificativas_peso;
CREATE POLICY "Todos podem ver justificativas"
ON public.justificativas_peso
FOR SELECT
TO authenticated
USING (public.is_integrante_ativo());

-- 4. pendencias_ajuste_roles: restringir inserção a integrantes ativos e admins
DROP POLICY IF EXISTS "Authenticated users can create pendencias_ajuste_roles" ON public.pendencias_ajuste_roles;
CREATE POLICY "Authenticated users can create pendencias_ajuste_roles"
ON public.pendencias_ajuste_roles
FOR INSERT
TO authenticated
WITH CHECK (public.is_integrante_ativo());

-- 5. presencas_historico: restringir inserção a admins (processos do sistema usam service_role/SECURITY DEFINER)
DROP POLICY IF EXISTS "Sistema pode inserir historico presencas" ON public.presencas_historico;
CREATE POLICY "Sistema pode inserir historico presencas"
ON public.presencas_historico
FOR INSERT
TO authenticated
WITH CHECK (public.has_role((auth.uid())::text, 'admin'::app_role));