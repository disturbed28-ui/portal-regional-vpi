INSERT INTO public.screen_permissions (screen_id, role)
SELECT 'd59d6fb9-a042-4332-9e69-447c4183c507'::uuid, 'adm_regional'::app_role
WHERE NOT EXISTS (
  SELECT 1 FROM public.screen_permissions
  WHERE screen_id = 'd59d6fb9-a042-4332-9e69-447c4183c507'
    AND role = 'adm_regional'
);