create or replace function public.vincular_integrantes_orfaos_divisao()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  update public.integrantes_portal
     set divisao_id = new.id, regional_id = new.regional_id
   where divisao_id is null
     and upper(unaccent(divisao_texto)) = upper(unaccent(new.nome));
  return new;
end $$;
drop trigger if exists trg_vincular_integrantes_orfaos on public.divisoes;
create trigger trg_vincular_integrantes_orfaos after insert or update of nome on public.divisoes
for each row execute function public.vincular_integrantes_orfaos_divisao();