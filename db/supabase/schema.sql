-- HPO / Supabase schema (compativel com estrutura atual baseada em JSON)
-- Execucao recomendada: Supabase SQL Editor

begin;

create extension if not exists pgcrypto;

create or replace function public.hpo_try_date(v text)
returns date
language plpgsql
immutable
as $$
begin
  if v is null or btrim(v) = '' then
    return null;
  end if;
  return v::date;
exception
  when others then
    return null;
end;
$$;

create or replace function public.hpo_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.hpo_roles (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hpo_roles_data_obj check (jsonb_typeof(data) = 'object'),
  constraint hpo_roles_data_id check (coalesce(data->>'id', '') <> '' and data->>'id' = id),
  constraint hpo_roles_nome_required check (coalesce(data->>'nome', '') <> '')
);

create table if not exists public.hpo_departments (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hpo_departments_data_obj check (jsonb_typeof(data) = 'object'),
  constraint hpo_departments_data_id check (coalesce(data->>'id', '') <> '' and data->>'id' = id),
  constraint hpo_departments_nome_required check (coalesce(data->>'nome', '') <> '')
);

create table if not exists public.hpo_cargos (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hpo_cargos_data_obj check (jsonb_typeof(data) = 'object'),
  constraint hpo_cargos_data_id check (coalesce(data->>'id', '') <> '' and data->>'id' = id),
  constraint hpo_cargos_nome_required check (coalesce(data->>'nome', '') <> '')
);

create table if not exists public.hpo_sectors (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hpo_sectors_data_obj check (jsonb_typeof(data) = 'object'),
  constraint hpo_sectors_data_id check (coalesce(data->>'id', '') <> '' and data->>'id' = id),
  constraint hpo_sectors_nome_required check (coalesce(data->>'nome', '') <> '')
);

create table if not exists public.hpo_users (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hpo_users_data_obj check (jsonb_typeof(data) = 'object'),
  constraint hpo_users_data_id check (coalesce(data->>'id', '') <> '' and data->>'id' = id),
  constraint hpo_users_nome_required check (coalesce(data->>'nome', '') <> ''),
  constraint hpo_users_email_required check (coalesce(data->>'email', '') <> ''),
  constraint hpo_users_username_required check (coalesce(data->>'username', '') <> ''),
  constraint hpo_users_has_login_type check (not (data ? 'has_login') or jsonb_typeof(data->'has_login') = 'boolean'),
  constraint hpo_users_active_type check (not (data ? 'active') or jsonb_typeof(data->'active') = 'boolean')
);

create table if not exists public.hpo_projects (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hpo_projects_data_obj check (jsonb_typeof(data) = 'object'),
  constraint hpo_projects_data_id check (coalesce(data->>'id', '') <> '' and data->>'id' = id),
  constraint hpo_projects_nome_required check (coalesce(data->>'nome', '') <> ''),
  constraint hpo_projects_responsavel_required check (coalesce(data->>'responsavel', '') <> ''),
  constraint hpo_projects_status_valid check ((data->>'status') in ('em_andamento','concluido','pausado','cancelado','backlog','proxima_sprint','atrasado')),
  constraint hpo_projects_criticidade_valid check (
    coalesce(data->>'criticidade', '') = '' or
    (data->>'criticidade') in ('urgente','critica','alta','media','baixa')
  ),
  constraint hpo_projects_date_start_valid check (coalesce(data->>'data_inicio_previsto', '') = '' or hpo_try_date(data->>'data_inicio_previsto') is not null),
  constraint hpo_projects_date_end_valid check (coalesce(data->>'previsao_termino', '') = '' or hpo_try_date(data->>'previsao_termino') is not null),
  constraint hpo_projects_date_order_valid check (
    hpo_try_date(data->>'previsao_termino') is null or
    hpo_try_date(data->>'data_inicio_previsto') is null or
    hpo_try_date(data->>'previsao_termino') >= hpo_try_date(data->>'data_inicio_previsto')
  )
);

create table if not exists public.hpo_processes (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hpo_processes_data_obj check (jsonb_typeof(data) = 'object'),
  constraint hpo_processes_data_id check (coalesce(data->>'id', '') <> '' and data->>'id' = id),
  constraint hpo_processes_nome_required check (coalesce(data->>'nome', '') <> ''),
  constraint hpo_processes_status_valid check ((data->>'status') in ('ativo','inativo','rascunho')),
  constraint hpo_processes_departamento_required check (coalesce(data->>'departamento_id', '') <> ''),
  constraint hpo_processes_responsavel_required check (coalesce(data->>'responsavel_id', '') <> '')
);

create table if not exists public.hpo_audit_log (
  id bigserial primary key,
  table_name text not null,
  row_id text not null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  actor text,
  at timestamptz not null default now(),
  old_data jsonb,
  new_data jsonb
);

create or replace function public.hpo_audit_trigger()
returns trigger
language plpgsql
security definer
as $$
declare
  actor_claim text;
begin
  actor_claim := coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claim.email', true), ''),
    current_user
  );

  if tg_op = 'INSERT' then
    insert into public.hpo_audit_log(table_name, row_id, action, actor, new_data)
    values (tg_table_name, new.id, tg_op, actor_claim, new.data);
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.hpo_audit_log(table_name, row_id, action, actor, old_data, new_data)
    values (tg_table_name, new.id, tg_op, actor_claim, old.data, new.data);
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.hpo_audit_log(table_name, row_id, action, actor, old_data)
    values (tg_table_name, old.id, tg_op, actor_claim, old.data);
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists hpo_touch_updated_at_roles on public.hpo_roles;
create trigger hpo_touch_updated_at_roles before update on public.hpo_roles
for each row execute function public.hpo_touch_updated_at();
drop trigger if exists hpo_audit_roles on public.hpo_roles;
create trigger hpo_audit_roles after insert or update or delete on public.hpo_roles
for each row execute function public.hpo_audit_trigger();

drop trigger if exists hpo_touch_updated_at_departments on public.hpo_departments;
create trigger hpo_touch_updated_at_departments before update on public.hpo_departments
for each row execute function public.hpo_touch_updated_at();
drop trigger if exists hpo_audit_departments on public.hpo_departments;
create trigger hpo_audit_departments after insert or update or delete on public.hpo_departments
for each row execute function public.hpo_audit_trigger();

drop trigger if exists hpo_touch_updated_at_cargos on public.hpo_cargos;
create trigger hpo_touch_updated_at_cargos before update on public.hpo_cargos
for each row execute function public.hpo_touch_updated_at();
drop trigger if exists hpo_audit_cargos on public.hpo_cargos;
create trigger hpo_audit_cargos after insert or update or delete on public.hpo_cargos
for each row execute function public.hpo_audit_trigger();

drop trigger if exists hpo_touch_updated_at_sectors on public.hpo_sectors;
create trigger hpo_touch_updated_at_sectors before update on public.hpo_sectors
for each row execute function public.hpo_touch_updated_at();
drop trigger if exists hpo_audit_sectors on public.hpo_sectors;
create trigger hpo_audit_sectors after insert or update or delete on public.hpo_sectors
for each row execute function public.hpo_audit_trigger();

drop trigger if exists hpo_touch_updated_at_users on public.hpo_users;
create trigger hpo_touch_updated_at_users before update on public.hpo_users
for each row execute function public.hpo_touch_updated_at();
drop trigger if exists hpo_audit_users on public.hpo_users;
create trigger hpo_audit_users after insert or update or delete on public.hpo_users
for each row execute function public.hpo_audit_trigger();

drop trigger if exists hpo_touch_updated_at_projects on public.hpo_projects;
create trigger hpo_touch_updated_at_projects before update on public.hpo_projects
for each row execute function public.hpo_touch_updated_at();
drop trigger if exists hpo_audit_projects on public.hpo_projects;
create trigger hpo_audit_projects after insert or update or delete on public.hpo_projects
for each row execute function public.hpo_audit_trigger();

drop trigger if exists hpo_touch_updated_at_processes on public.hpo_processes;
create trigger hpo_touch_updated_at_processes before update on public.hpo_processes
for each row execute function public.hpo_touch_updated_at();
drop trigger if exists hpo_audit_processes on public.hpo_processes;
create trigger hpo_audit_processes after insert or update or delete on public.hpo_processes
for each row execute function public.hpo_audit_trigger();

create unique index if not exists idx_hpo_users_email_unique on public.hpo_users (lower(data->>'email'));
create unique index if not exists idx_hpo_users_username_unique on public.hpo_users (lower(data->>'username'));
create index if not exists idx_hpo_projects_status on public.hpo_projects ((data->>'status'));
create index if not exists idx_hpo_projects_criticidade on public.hpo_projects ((data->>'criticidade'));
create index if not exists idx_hpo_projects_responsavel on public.hpo_projects ((data->>'responsavel'));
create index if not exists idx_hpo_processes_status on public.hpo_processes ((data->>'status'));
create index if not exists idx_hpo_processes_departamento on public.hpo_processes ((data->>'departamento_nome'));
create index if not exists idx_hpo_processes_responsavel on public.hpo_processes ((data->>'responsavel_nome'));
create index if not exists idx_hpo_audit_table_row on public.hpo_audit_log (table_name, row_id, at desc);

alter table public.hpo_roles enable row level security;
alter table public.hpo_departments enable row level security;
alter table public.hpo_cargos enable row level security;
alter table public.hpo_sectors enable row level security;
alter table public.hpo_users enable row level security;
alter table public.hpo_projects enable row level security;
alter table public.hpo_processes enable row level security;
alter table public.hpo_audit_log enable row level security;

drop policy if exists hpo_roles_service_role_all on public.hpo_roles;
create policy hpo_roles_service_role_all on public.hpo_roles for all
using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists hpo_departments_service_role_all on public.hpo_departments;
create policy hpo_departments_service_role_all on public.hpo_departments for all
using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists hpo_cargos_service_role_all on public.hpo_cargos;
create policy hpo_cargos_service_role_all on public.hpo_cargos for all
using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists hpo_sectors_service_role_all on public.hpo_sectors;
create policy hpo_sectors_service_role_all on public.hpo_sectors for all
using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists hpo_users_service_role_all on public.hpo_users;
create policy hpo_users_service_role_all on public.hpo_users for all
using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists hpo_projects_service_role_all on public.hpo_projects;
create policy hpo_projects_service_role_all on public.hpo_projects for all
using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists hpo_processes_service_role_all on public.hpo_processes;
create policy hpo_processes_service_role_all on public.hpo_processes for all
using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists hpo_audit_service_role_all on public.hpo_audit_log;
create policy hpo_audit_service_role_all on public.hpo_audit_log for all
using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

insert into storage.buckets (id, name, public)
values ('hpo-files', 'hpo-files', false)
on conflict (id) do nothing;

drop policy if exists hpo_files_service_role_select on storage.objects;
create policy hpo_files_service_role_select on storage.objects for select
using (bucket_id = 'hpo-files' and auth.role() = 'service_role');

drop policy if exists hpo_files_service_role_insert on storage.objects;
create policy hpo_files_service_role_insert on storage.objects for insert
with check (bucket_id = 'hpo-files' and auth.role() = 'service_role');

drop policy if exists hpo_files_service_role_update on storage.objects;
create policy hpo_files_service_role_update on storage.objects for update
using (bucket_id = 'hpo-files' and auth.role() = 'service_role')
with check (bucket_id = 'hpo-files' and auth.role() = 'service_role');

drop policy if exists hpo_files_service_role_delete on storage.objects;
create policy hpo_files_service_role_delete on storage.objects for delete
using (bucket_id = 'hpo-files' and auth.role() = 'service_role');

commit;
