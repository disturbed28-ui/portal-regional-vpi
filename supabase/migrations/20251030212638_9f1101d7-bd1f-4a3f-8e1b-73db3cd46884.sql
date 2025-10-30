-- Criar policies para cargas_historico
CREATE POLICY "Admins e diretores podem ver cargas historico" 
ON public.cargas_historico FOR SELECT 
USING (
  has_role((auth.uid())::text, 'admin'::app_role) OR
  has_role((auth.uid())::text, 'diretor_regional'::app_role)
);

CREATE POLICY "Only admins can insert cargas historico" 
ON public.cargas_historico FOR INSERT 
WITH CHECK (has_role((auth.uid())::text, 'admin'::app_role));

CREATE POLICY "Only admins can delete cargas historico" 
ON public.cargas_historico FOR DELETE 
USING (has_role((auth.uid())::text, 'admin'::app_role));

-- Criar policies para mensalidades_atraso
CREATE POLICY "Admins e diretores podem ver mensalidades" 
ON public.mensalidades_atraso FOR SELECT 
USING (
  has_role((auth.uid())::text, 'admin'::app_role) OR
  has_role((auth.uid())::text, 'diretor_regional'::app_role)
);

CREATE POLICY "Only admins can insert mensalidades" 
ON public.mensalidades_atraso FOR INSERT 
WITH CHECK (has_role((auth.uid())::text, 'admin'::app_role));

CREATE POLICY "Only admins can delete mensalidades" 
ON public.mensalidades_atraso FOR DELETE 
USING (has_role((auth.uid())::text, 'admin'::app_role));