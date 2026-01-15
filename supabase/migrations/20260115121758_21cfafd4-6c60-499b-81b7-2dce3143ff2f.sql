-- Backfill emails existentes
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id::text
  AND p.email IS NULL;