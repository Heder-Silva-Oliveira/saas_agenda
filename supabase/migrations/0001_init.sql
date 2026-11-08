-- AgendaCliente — schema inicial, RLS e automações
-- Execute este arquivo no SQL Editor do Supabase (ou via `supabase db push`).
-- Requer os schemas `auth` e `storage` do Supabase.

create extension if not exists "pgcrypto";
create schema if not exists extensions;
create extension if not exists "btree_gist" with schema extensions;

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  segment text not null default 'outro'
    check (segment in ('barbearia', 'salao', 'estetica', 'lash', 'personal', 'petshop', 'outro')),
  whatsapp_number text not null default '',
  opening_hours jsonb not null default '{}'::jsonb,
  logo_url text,
  plan text not null default 'Plano Negócio',
  subscription_status text not null default 'trial'
    check (subscription_status in ('trial', 'active', 'suspended', 'canceled')),
  trial_ends_at timestamptz not null default (now() + interval '7 days'),
  onboarding_completed boolean not null default false,
  access_requested_at timestamptz,
  access_request_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  full_name text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  phone text not null,
  email text,
  birth_date date,
  notes text,
  tags text[] not null default '{}',
  status text not null default 'ativo' check (status in ('ativo', 'inativo')),
  marketing_consent boolean not null default false,
  consent_date timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  duration_minutes integer not null check (duration_minutes > 0),
  price numeric(10, 2) not null default 0 check (price >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  service_id uuid references public.services (id) on delete set null,
  professional_name text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  price numeric(10, 2) not null default 0 check (price >= 0),
  status text not null default 'agendado'
    check (status in ('agendado', 'confirmado', 'concluido', 'cancelado', 'faltou')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_valid_range check (ends_at > starts_at)
);

create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  category text not null
    check (category in ('confirmacao', 'lembrete', 'aniversario', 'retorno', 'agradecimento')),
  body text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (business_id, category)
);

create table if not exists public.message_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  appointment_id uuid references public.appointments (id) on delete set null,
  template_id uuid references public.message_templates (id) on delete set null,
  channel text not null default 'whatsapp' check (channel in ('whatsapp')),
  message_content text not null,
  status text not null default 'manual'
    check (status in ('manual', 'enviado', 'erro')),
  sent_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------------

create unique index if not exists clients_business_phone_active_idx
  on public.clients (business_id, phone)
  where deleted_at is null;

create index if not exists clients_business_idx on public.clients (business_id);
create index if not exists clients_birth_date_idx on public.clients (business_id, birth_date);
create index if not exists services_business_idx on public.services (business_id);
create index if not exists appointments_business_starts_idx
  on public.appointments (business_id, starts_at);
create index if not exists appointments_client_idx on public.appointments (client_id);
create index if not exists message_logs_business_sent_idx
  on public.message_logs (business_id, sent_at desc);

-- Impede dois atendimentos ativos no mesmo horário/profissional.
alter table public.appointments
  drop constraint if exists appointments_no_overlap;

alter table public.appointments
  add constraint appointments_no_overlap
  exclude using gist (
    business_id with =,
    professional_name with =,
    tstzrange(starts_at, ends_at) with &&
  )
  where (status in ('agendado', 'confirmado', 'concluido'));

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists businesses_set_updated_at on public.businesses;
create trigger businesses_set_updated_at
  before update on public.businesses
  for each row execute function public.set_updated_at();

drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

drop trigger if exists appointments_set_updated_at on public.appointments;
create trigger appointments_set_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();

-- Campos comerciais só podem ser alterados pelo backend (service_role).
create or replace function public.protect_business_fields()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') <> 'authenticated' then
    return new;
  end if;

  if new.subscription_status is distinct from old.subscription_status
     or new.trial_ends_at is distinct from old.trial_ends_at
     or new.plan is distinct from old.plan
     or new.owner_user_id is distinct from old.owner_user_id then
    raise exception 'Campos de assinatura não podem ser alterados pelo cliente.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists businesses_protect_fields on public.businesses;
create trigger businesses_protect_fields
  before update on public.businesses
  for each row execute function public.protect_business_fields();

-- O vínculo do usuário com o negócio não pode ser trocado pelo cliente.
create or replace function public.protect_profile_business()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') = 'authenticated'
     and new.business_id is distinct from old.business_id then
    raise exception 'O negócio do perfil não pode ser alterado.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_business on public.profiles;
create trigger profiles_protect_business
  before update on public.profiles
  for each row execute function public.protect_profile_business();

-- ---------------------------------------------------------------------------
-- Onboarding: cria negócio, perfil e modelos padrão no cadastro
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
  v_business_name text;
  v_full_name text;
begin
  v_business_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'business_name'), ''),
    'Meu negócio'
  );
  v_full_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    split_part(coalesce(new.email, ''), '@', 1)
  );

  insert into public.businesses (owner_user_id, name, segment)
  values (new.id, v_business_name, 'outro')
  returning id into v_business_id;

  insert into public.profiles (user_id, business_id, full_name)
  values (new.id, v_business_id, v_full_name)
  on conflict (user_id) do update
    set business_id = excluded.business_id,
        full_name = excluded.full_name;

  insert into public.message_templates (business_id, name, category, body)
  values
    (v_business_id, 'Confirmação de agendamento', 'confirmacao',
      'Olá {{nome_cliente}}! Seu horário na {{nome_negocio}} está confirmado para {{data}} às {{horario}}. Serviço: {{servico}}. Até lá!'),
    (v_business_id, 'Lembrete de atendimento', 'lembrete',
      'Oi {{nome_cliente}}! Passando para lembrar do seu atendimento na {{nome_negocio}} em {{data}} às {{horario}}. Podemos confirmar?'),
    (v_business_id, 'Feliz aniversário', 'aniversario',
      'Feliz aniversário, {{nome_cliente}}! A equipe da {{nome_negocio}} deseja um dia especial. Preparamos um carinho para sua próxima visita.'),
    (v_business_id, 'Sentimos sua falta', 'retorno',
      'Olá {{nome_cliente}}! Sentimos sua falta na {{nome_negocio}}. Que tal agendar um novo horário? Estamos à disposição.'),
    (v_business_id, 'Agradecimento pela visita', 'agradecimento',
      'Obrigado pela visita, {{nome_cliente}}! Esperamos que tenha gostado do atendimento na {{nome_negocio}}. Até a próxima!')
  on conflict (business_id, category) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

create or replace function public.current_business_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select business_id
  from public.profiles
  where user_id = auth.uid()
  limit 1;
$$;

revoke all on function public.current_business_id() from public;
grant execute on function public.current_business_id() to authenticated;

alter table public.businesses enable row level security;
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.services enable row level security;
alter table public.appointments enable row level security;
alter table public.message_templates enable row level security;
alter table public.message_logs enable row level security;

drop policy if exists businesses_select_own on public.businesses;
create policy businesses_select_own on public.businesses
  for select to authenticated
  using (id = public.current_business_id());

drop policy if exists businesses_update_own on public.businesses;
create policy businesses_update_own on public.businesses
  for update to authenticated
  using (id = public.current_business_id())
  with check (id = public.current_business_id());

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists clients_tenant_all on public.clients;
create policy clients_tenant_all on public.clients
  for all to authenticated
  using (business_id = public.current_business_id())
  with check (business_id = public.current_business_id());

drop policy if exists services_tenant_all on public.services;
create policy services_tenant_all on public.services
  for all to authenticated
  using (business_id = public.current_business_id())
  with check (business_id = public.current_business_id());

drop policy if exists appointments_tenant_all on public.appointments;
create policy appointments_tenant_all on public.appointments
  for all to authenticated
  using (business_id = public.current_business_id())
  with check (business_id = public.current_business_id());

drop policy if exists templates_tenant_all on public.message_templates;
create policy templates_tenant_all on public.message_templates
  for all to authenticated
  using (business_id = public.current_business_id())
  with check (business_id = public.current_business_id());

drop policy if exists logs_tenant_all on public.message_logs;
create policy logs_tenant_all on public.message_logs
  for all to authenticated
  using (business_id = public.current_business_id())
  with check (business_id = public.current_business_id());

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: logos dos negócios
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do update set public = true;

drop policy if exists logos_public_read on storage.objects;
create policy logos_public_read on storage.objects
  for select using (bucket_id = 'logos');

drop policy if exists logos_tenant_insert on storage.objects;
create policy logos_tenant_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = public.current_business_id()::text
  );

drop policy if exists logos_tenant_update on storage.objects;
create policy logos_tenant_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = public.current_business_id()::text
  )
  with check (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = public.current_business_id()::text
  );

drop policy if exists logos_tenant_delete on storage.objects;
create policy logos_tenant_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = public.current_business_id()::text
  );
