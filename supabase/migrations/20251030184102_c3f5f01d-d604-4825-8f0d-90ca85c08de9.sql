-- =====================================================
-- MIGRATION: Normalizar estrutura organizacional (versão robusta)
-- =====================================================

-- 1. Criar tabela de comandos
CREATE TABLE IF NOT EXISTS public.comandos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Criar tabela de regionais
CREATE TABLE IF NOT EXISTS public.regionais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comando_id UUID NOT NULL REFERENCES public.comandos(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(comando_id, nome)
);

-- 3. Criar tabela de divisões
CREATE TABLE IF NOT EXISTS public.divisoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  regional_id UUID NOT NULL REFERENCES public.regionais(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(regional_id, nome)
);

-- 4. Criar tabela de funções
CREATE TABLE IF NOT EXISTS public.funcoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  ordem INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 5. Criar tabela de cargos
CREATE TABLE IF NOT EXISTS public.cargos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grau TEXT NOT NULL,
  nome TEXT NOT NULL,
  nivel INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(grau, nome)
);

-- =====================================================
-- POPULAR DADOS (com ON CONFLICT para idempotência)
-- =====================================================

-- Inserir Comando V
INSERT INTO public.comandos (nome) 
VALUES ('Comando V')
ON CONFLICT (nome) DO NOTHING;

-- Inserir e processar estrutura hierárquica
DO $$
DECLARE
  cmd_id UUID;
  regional_cmd_id UUID;
  regional_vp1_id UUID;
  regional_vp2_id UUID;
  regional_ln_id UUID;
BEGIN
  -- Obter ID do Comando V
  SELECT id INTO cmd_id FROM public.comandos WHERE nome = 'Comando V';

  -- Inserir CMD (nivel regional)
  INSERT INTO public.regionais (comando_id, nome) 
  VALUES (cmd_id, 'CMD')
  ON CONFLICT (comando_id, nome) DO NOTHING;
  SELECT id INTO regional_cmd_id FROM public.regionais WHERE comando_id = cmd_id AND nome = 'CMD';

  -- Inserir Regional - Vale do Paraíba I
  INSERT INTO public.regionais (comando_id, nome) 
  VALUES (cmd_id, 'Vale do Paraiba I - SP')
  ON CONFLICT (comando_id, nome) DO NOTHING;
  SELECT id INTO regional_vp1_id FROM public.regionais WHERE comando_id = cmd_id AND nome = 'Vale do Paraiba I - SP';

  -- Inserir Regional - Vale do Paraíba II
  INSERT INTO public.regionais (comando_id, nome) 
  VALUES (cmd_id, 'Vale do Paraiba II - SP')
  ON CONFLICT (comando_id, nome) DO NOTHING;
  SELECT id INTO regional_vp2_id FROM public.regionais WHERE comando_id = cmd_id AND nome = 'Vale do Paraiba II - SP';

  -- Inserir Regional - Litoral Norte
  INSERT INTO public.regionais (comando_id, nome) 
  VALUES (cmd_id, 'Litoral Norte - SP')
  ON CONFLICT (comando_id, nome) DO NOTHING;
  SELECT id INTO regional_ln_id FROM public.regionais WHERE comando_id = cmd_id AND nome = 'Litoral Norte - SP';

  -- Inserir Divisões - Vale do Paraíba I
  INSERT INTO public.divisoes (regional_id, nome) VALUES
    (regional_vp1_id, 'Regional'),
    (regional_vp1_id, 'Divisao Sao Jose dos Campos Norte - SP'),
    (regional_vp1_id, 'Divisao Sao Jose dos Campos Sul - SP'),
    (regional_vp1_id, 'Divisao Sao Jose dos Campos Leste - SP'),
    (regional_vp1_id, 'Divisao Sao Jose dos Campos Oeste - SP'),
    (regional_vp1_id, 'Divisao Sao Jose dos Campos Centro - SP'),
    (regional_vp1_id, 'Divisao Sao Jose dos Campos Extremo Norte - SP'),
    (regional_vp1_id, 'Divisao Sao Jose dos Campos Extremo Sul - SP'),
    (regional_vp1_id, 'Divisao Sao Jose dos Campos Extremo Leste - SP'),
    (regional_vp1_id, 'Divisao Jacarei Norte - SP'),
    (regional_vp1_id, 'Divisao Jacarei Sul - SP'),
    (regional_vp1_id, 'Divisao Jacarei Leste - SP'),
    (regional_vp1_id, 'Divisao Jacarei Oeste - SP'),
    (regional_vp1_id, 'Divisao Jacarei Centro - SP'),
    (regional_vp1_id, 'Divisao Cacapava - SP')
  ON CONFLICT (regional_id, nome) DO NOTHING;

  -- Inserir Divisões - Vale do Paraíba II
  INSERT INTO public.divisoes (regional_id, nome) VALUES
    (regional_vp2_id, 'Divisao Taubate - SP'),
    (regional_vp2_id, 'Divisao Tremembe - SP'),
    (regional_vp2_id, 'Divisao Pindamonhangaba I - SP'),
    (regional_vp2_id, 'Divisao Pindamonhangaba II - SP'),
    (regional_vp2_id, 'Divisao Moreira Cesar - SP'),
    (regional_vp2_id, 'Divisao Guaratingueta - SP'),
    (regional_vp2_id, 'Divisao Campos do Jordao - SP'),
    (regional_vp2_id, 'Divisao Santo Antonio do Pinhal - SP')
  ON CONFLICT (regional_id, nome) DO NOTHING;

  -- Inserir Divisões - Litoral Norte
  INSERT INTO public.divisoes (regional_id, nome) VALUES
    (regional_ln_id, 'Divisao Caraguatatuba Norte - SP'),
    (regional_ln_id, 'Divisao Caraguatuba Sul - SP'),
    (regional_ln_id, 'Divisao Caraguatatuba Centro - SP'),
    (regional_ln_id, 'Divisao Ilhabela - SP'),
    (regional_ln_id, 'Divisao Sao Sebastiao Norte - SP'),
    (regional_ln_id, 'Divisao Sao Sebastiao Sul - SP'),
    (regional_ln_id, 'Divisao Sao Sebastiao Centro - SP')
  ON CONFLICT (regional_id, nome) DO NOTHING;
END $$;

-- Inserir Funções
INSERT INTO public.funcoes (nome, ordem) VALUES
  ('SGT Armas', 1),
  ('Caveira', 2),
  ('Suplente Caveira', 3),
  ('Urso', 4),
  ('Lobo', 5),
  ('NA', 6)
ON CONFLICT (nome) DO NOTHING;

-- Inserir Cargos
INSERT INTO public.cargos (grau, nome, nivel) VALUES
  ('X', 'PP (Grau X)', 10),
  ('IX', 'Meio (Grau IX)', 9),
  ('VIII', 'Full (Grau VIII)', 8),
  ('VI', 'Diretor Divisao (Grau VI)', 6),
  ('VI', 'Sub Diretor Divisao (Grau VI)', 6),
  ('VI', 'Social Divisao (Grau VI)', 6),
  ('VI', 'Adm. Divisao (Grau VI)', 6),
  ('VI', 'Sgt.Armas Divisao (Grau VI)', 6),
  ('V', 'Diretor Regional (Grau V)', 5),
  ('V', 'Operacional Regional (Grau V)', 5),
  ('V', 'Social Regional (Grau V)', 5),
  ('V', 'Adm. Regional (Grau V)', 5),
  ('V', 'Comunicacao (Grau V)', 5),
  ('III', 'CMD Regional (Grau III)', 3),
  ('IV', 'CMD Operacional (Grau IV)', 4),
  ('IV', 'CMD Eventos (Grau IV)', 4),
  ('IV', 'CMD Armas (Grau IV)', 4),
  ('IV', 'CMD Adm (Grau IV)', 4),
  ('IV', 'CMD Social (Grau IV)', 4),
  ('Camiseta', 'Camiseta (Grau X)', 10)
ON CONFLICT (grau, nome) DO NOTHING;

-- =====================================================
-- ATUALIZAR TABELA PROFILES
-- =====================================================

-- Adicionar novas colunas UUID (nullable temporariamente)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS comando_id UUID REFERENCES public.comandos(id),
ADD COLUMN IF NOT EXISTS regional_id UUID REFERENCES public.regionais(id),
ADD COLUMN IF NOT EXISTS divisao_id UUID REFERENCES public.divisoes(id),
ADD COLUMN IF NOT EXISTS cargo_id UUID REFERENCES public.cargos(id),
ADD COLUMN IF NOT EXISTS funcao_id UUID REFERENCES public.funcoes(id);

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Habilitar RLS nas novas tabelas
ALTER TABLE public.comandos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regionais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.divisoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funcoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cargos ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas se existirem e recriar
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Public read access to comandos" ON public.comandos;
  DROP POLICY IF EXISTS "Public read access to regionais" ON public.regionais;
  DROP POLICY IF EXISTS "Public read access to divisoes" ON public.divisoes;
  DROP POLICY IF EXISTS "Public read access to funcoes" ON public.funcoes;
  DROP POLICY IF EXISTS "Public read access to cargos" ON public.cargos;
  DROP POLICY IF EXISTS "Only admins can insert comandos" ON public.comandos;
  DROP POLICY IF EXISTS "Only admins can update comandos" ON public.comandos;
  DROP POLICY IF EXISTS "Only admins can delete comandos" ON public.comandos;
  DROP POLICY IF EXISTS "Only admins can insert regionais" ON public.regionais;
  DROP POLICY IF EXISTS "Only admins can update regionais" ON public.regionais;
  DROP POLICY IF EXISTS "Only admins can delete regionais" ON public.regionais;
  DROP POLICY IF EXISTS "Only admins can insert divisoes" ON public.divisoes;
  DROP POLICY IF EXISTS "Only admins can update divisoes" ON public.divisoes;
  DROP POLICY IF EXISTS "Only admins can delete divisoes" ON public.divisoes;
  DROP POLICY IF EXISTS "Only admins can insert funcoes" ON public.funcoes;
  DROP POLICY IF EXISTS "Only admins can update funcoes" ON public.funcoes;
  DROP POLICY IF EXISTS "Only admins can delete funcoes" ON public.funcoes;
  DROP POLICY IF EXISTS "Only admins can insert cargos" ON public.cargos;
  DROP POLICY IF EXISTS "Only admins can update cargos" ON public.cargos;
  DROP POLICY IF EXISTS "Only admins can delete cargos" ON public.cargos;
END $$;

-- Políticas de leitura pública
CREATE POLICY "Public read access to comandos" ON public.comandos FOR SELECT USING (true);
CREATE POLICY "Public read access to regionais" ON public.regionais FOR SELECT USING (true);
CREATE POLICY "Public read access to divisoes" ON public.divisoes FOR SELECT USING (true);
CREATE POLICY "Public read access to funcoes" ON public.funcoes FOR SELECT USING (true);
CREATE POLICY "Public read access to cargos" ON public.cargos FOR SELECT USING (true);

-- Políticas de escrita apenas para admins
CREATE POLICY "Only admins can insert comandos" ON public.comandos FOR INSERT WITH CHECK (has_role((auth.uid())::text, 'admin'::app_role));
CREATE POLICY "Only admins can update comandos" ON public.comandos FOR UPDATE USING (has_role((auth.uid())::text, 'admin'::app_role));
CREATE POLICY "Only admins can delete comandos" ON public.comandos FOR DELETE USING (has_role((auth.uid())::text, 'admin'::app_role));

CREATE POLICY "Only admins can insert regionais" ON public.regionais FOR INSERT WITH CHECK (has_role((auth.uid())::text, 'admin'::app_role));
CREATE POLICY "Only admins can update regionais" ON public.regionais FOR UPDATE USING (has_role((auth.uid())::text, 'admin'::app_role));
CREATE POLICY "Only admins can delete regionais" ON public.regionais FOR DELETE USING (has_role((auth.uid())::text, 'admin'::app_role));

CREATE POLICY "Only admins can insert divisoes" ON public.divisoes FOR INSERT WITH CHECK (has_role((auth.uid())::text, 'admin'::app_role));
CREATE POLICY "Only admins can update divisoes" ON public.divisoes FOR UPDATE USING (has_role((auth.uid())::text, 'admin'::app_role));
CREATE POLICY "Only admins can delete divisoes" ON public.divisoes FOR DELETE USING (has_role((auth.uid())::text, 'admin'::app_role));

CREATE POLICY "Only admins can insert funcoes" ON public.funcoes FOR INSERT WITH CHECK (has_role((auth.uid())::text, 'admin'::app_role));
CREATE POLICY "Only admins can update funcoes" ON public.funcoes FOR UPDATE USING (has_role((auth.uid())::text, 'admin'::app_role));
CREATE POLICY "Only admins can delete funcoes" ON public.funcoes FOR DELETE USING (has_role((auth.uid())::text, 'admin'::app_role));

CREATE POLICY "Only admins can insert cargos" ON public.cargos FOR INSERT WITH CHECK (has_role((auth.uid())::text, 'admin'::app_role));
CREATE POLICY "Only admins can update cargos" ON public.cargos FOR UPDATE USING (has_role((auth.uid())::text, 'admin'::app_role));
CREATE POLICY "Only admins can delete cargos" ON public.cargos FOR DELETE USING (has_role((auth.uid())::text, 'admin'::app_role));

-- =====================================================
-- CRIAR VIEW PARA ESTRUTURA COMPLETA
-- =====================================================

CREATE OR REPLACE VIEW public.vw_estrutura_completa AS
SELECT 
  c.id as comando_id,
  c.nome as comando,
  r.id as regional_id,
  r.nome as regional,
  d.id as divisao_id,
  d.nome as divisao
FROM public.divisoes d
JOIN public.regionais r ON d.regional_id = r.id
JOIN public.comandos c ON r.comando_id = c.id;

-- =====================================================
-- CRIAR ÍNDICES PARA PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_regionais_comando_id ON public.regionais(comando_id);
CREATE INDEX IF NOT EXISTS idx_divisoes_regional_id ON public.divisoes(regional_id);
CREATE INDEX IF NOT EXISTS idx_profiles_regional_id ON public.profiles(regional_id);
CREATE INDEX IF NOT EXISTS idx_profiles_divisao_id ON public.profiles(divisao_id);
CREATE INDEX IF NOT EXISTS idx_profiles_cargo_id ON public.profiles(cargo_id);
CREATE INDEX IF NOT EXISTS idx_profiles_funcao_id ON public.profiles(funcao_id);