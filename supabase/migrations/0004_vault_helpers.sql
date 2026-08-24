-- 0004: fix vault access from Edge Functions via helper RPCs
-- (PostgREST only exposes public; vault helpers run SECURITY DEFINER).

create or replace function public.read_vault_secret(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public, vault
as $$
declare v text;
begin
  select decrypted_secret into v from vault.decrypted_secrets where id = p_id;
  return v;
end;
$$;
revoke all on function public.read_vault_secret(uuid) from public;
grant execute on function public.read_vault_secret(uuid) to authenticated, service_role;

create or replace function public.create_vault_secret(p_secret text, p_name text)
returns uuid
language plpgsql
security definer
set search_path = public, vault
as $$
declare new_id uuid;
begin
  insert into vault.secrets (secret, name) values (p_secret, p_name) returning id into new_id;
  return new_id;
end;
$$;
revoke all on function public.create_vault_secret(text, text) from public;
grant execute on function public.create_vault_secret(text, text) to authenticated, service_role;

create or replace function public.delete_vault_secret(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
begin
  delete from vault.secrets where id = p_id;
end;
$$;
revoke all on function public.delete_vault_secret(uuid) from public;
grant execute on function public.delete_vault_secret(uuid) to authenticated, service_role;
