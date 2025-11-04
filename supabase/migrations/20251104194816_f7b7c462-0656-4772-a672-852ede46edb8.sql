-- Normalização dos campos divisao_texto para garantir consistência
-- com a tabela divisoes (sem acentos, com prefixo "Divisao ")

-- 1. Normalizar mensalidades_atraso: remover acentos
UPDATE mensalidades_atraso
SET divisao_texto = 
  CASE 
    WHEN divisao_texto = 'Divisão Caçapava - SP' THEN 'Divisao Cacapava - SP'
    WHEN divisao_texto = 'Divisão Jacareí Centro - SP' THEN 'Divisao Jacarei Centro - SP'
    WHEN divisao_texto = 'Divisão São José dos Campos Extremo Leste - SP' THEN 'Divisao Sao Jose dos Campos Extremo Leste - SP'
    WHEN divisao_texto = 'Divisão São José dos Campos Leste - SP' THEN 'Divisao Sao Jose dos Campos Leste - SP'
    WHEN divisao_texto = 'Divisão São José dos Campos Norte - SP' THEN 'Divisao Sao Jose dos Campos Norte - SP'
    WHEN divisao_texto = 'Divisão São José dos Campos Sul - SP' THEN 'Divisao Sao Jose dos Campos Sul - SP'
    ELSE divisao_texto
  END
WHERE divisao_texto LIKE 'Divisão%';

-- 2. Normalizar integrantes_afastados: adicionar prefixo "Divisao " e remover acentos
UPDATE integrantes_afastados
SET divisao_texto = 
  CASE 
    WHEN divisao_texto = 'São José dos Campos Extremo Sul - SP' THEN 'Divisao Sao Jose dos Campos Extremo Sul - SP'
    WHEN divisao_texto = 'São José dos Campos Norte - SP' THEN 'Divisao Sao Jose dos Campos Norte - SP'
    ELSE divisao_texto
  END
WHERE divisao_texto NOT LIKE 'Divisao%';