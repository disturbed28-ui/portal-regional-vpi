-- Run through the authenticated database query tool; every assertion must be true.
WITH ids AS (
 SELECT '00000000-0000-0000-0000-000000000001'::uuid AS divisao,
        '00000000-0000-0000-0000-000000000002'::uuid AS outra_divisao,
        '00000000-0000-0000-0000-000000000003'::uuid AS regional,
        '00000000-0000-0000-0000-000000000004'::uuid AS outra_regional
), checks AS (
 SELECT 'diretor da propria divisao' AS regra, public.pd_responsavel_pendencia('Diretor Divisão','VI',divisao,regional,divisao,regional) AS ok FROM ids
 UNION ALL SELECT 'diretor de outra divisao bloqueado', NOT public.pd_responsavel_pendencia('Diretor Divisão','VI',outra_divisao,regional,divisao,regional) FROM ids
 UNION ALL SELECT 'subdiretor bloqueado', NOT public.pd_responsavel_pendencia('Sub Diretor Divisão','VI',divisao,regional,divisao,regional) FROM ids
 UNION ALL SELECT 'diretor regional grau V', public.pd_responsavel_pendencia('Diretor Regional (Grau V)','V',outra_divisao,regional,divisao,regional) FROM ids
 UNION ALL SELECT 'operacional regional grau V', public.pd_responsavel_pendencia('Operacional Regional','V',outra_divisao,regional,divisao,regional) FROM ids
 UNION ALL SELECT 'outra regional bloqueada', NOT public.pd_responsavel_pendencia('Diretor Regional','V',divisao,outra_regional,divisao,regional) FROM ids
 UNION ALL SELECT 'outro cargo grau V bloqueado', NOT public.pd_responsavel_pendencia('Adm Regional','V',divisao,regional,divisao,regional) FROM ids
 UNION ALL SELECT 'comando bloqueado', NOT public.pd_responsavel_pendencia('CMD Operacional (Grau IV)','IV',divisao,regional,divisao,regional) FROM ids
 UNION ALL SELECT 'grau incorreto bloqueado', NOT public.pd_responsavel_pendencia('Operacional Regional','VIII',divisao,regional,divisao,regional) FROM ids
 UNION ALL SELECT 'escopo ausente bloqueado', NOT public.pd_responsavel_pendencia('Diretor Divisão','VI',NULL,regional,divisao,regional) FROM ids
)
SELECT regra, 1 / CASE WHEN ok THEN 1 ELSE 0 END AS passou FROM checks;