-- Criar tabela de mapeamento Firebase UID → Supabase UUID
CREATE TABLE IF NOT EXISTS public.firebase_auth_mapping (
  firebase_uid TEXT PRIMARY KEY,
  supabase_uid UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para busca reversa (Supabase UUID → Firebase UID)
CREATE INDEX IF NOT EXISTS idx_firebase_mapping_supabase_uid 
ON public.firebase_auth_mapping(supabase_uid);

-- RLS: Apenas service_role pode manipular
ALTER TABLE public.firebase_auth_mapping ENABLE ROW LEVEL SECURITY;

-- Política para permitir service_role ler/escrever
CREATE POLICY "Service role can manage firebase mapping"
ON public.firebase_auth_mapping
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Função auxiliar para pegar Firebase UID a partir do auth.uid() do Supabase
CREATE OR REPLACE FUNCTION public.get_firebase_uid_from_supabase()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT firebase_uid 
  FROM public.firebase_auth_mapping 
  WHERE supabase_uid = auth.uid()
  LIMIT 1;
$$;