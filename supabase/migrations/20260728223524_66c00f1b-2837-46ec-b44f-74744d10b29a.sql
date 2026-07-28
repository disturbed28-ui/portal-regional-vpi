
CREATE OR REPLACE FUNCTION public.get_admins_contato()
RETURNS TABLE(profile_id text, nome text, telefone text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT p.id, COALESCE(p.nome_colete, p.name), p.telefone
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE ur.role = 'admin'::app_role
    AND p.telefone IS NOT NULL
    AND btrim(p.telefone) <> ''
$$;

GRANT EXECUTE ON FUNCTION public.get_admins_contato() TO authenticated;

INSERT INTO public.notificacoes_whatsapp_templates (chave, titulo, descricao, corpo, escopo, variaveis_disponiveis, ativo)
VALUES
(
  'perfil_cobranca_analise',
  'Cobrança de análise de cadastro',
  'Enviado pelo usuário com cadastro pendente/em análise aos administradores.',
  E'🪪 *CADASTRO AGUARDANDO ANÁLISE*\n\nCaro Administrador, {{admin}}!\n\nMeu cadastro no Portal está com status *{{status}}*.\n\nNome: *{{nome}}*\nColete: *{{nome_colete}}*\nTelefone: {{telefone}}\nE-mail: {{email}}\n\nPeço, por gentileza, a validação/ativação do meu acesso.\nObrigado!',
  'perfil',
  ARRAY['admin','status','nome','nome_colete','telefone','email','data_cadastro'],
  true
),
(
  'perfil_ativado',
  'Perfil ativado no Portal',
  'Enviado pelo admin ao integrante quando o perfil é ativado.',
  E'✅ *ACESSO LIBERADO — PORTAL REGIONAL VP1*\n\nCaro Irmão, {{nome_colete}}!\n\nSeu cadastro foi analisado e *ativado* no Portal.\n\nDivisão: *{{divisao}}*\nCargo: *{{cargo}}*\n\nJá pode acessar normalmente: {{url}}\n\nQualquer dúvida, estou à disposição.\n{{remetente}}',
  'perfil',
  ARRAY['nome_colete','divisao','cargo','url','remetente'],
  true
)
ON CONFLICT (chave) DO NOTHING;
