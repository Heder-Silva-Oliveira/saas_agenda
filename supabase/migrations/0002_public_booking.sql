-- AgendaCliente — agenda online pública
-- Execute depois de 0001_init.sql.

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Slug e configurações públicas do negócio
-- ---------------------------------------------------------------------------

create or replace function public.slugify(value text)
returns text
language sql
immutable
as $$
  select trim(
    both '-' from regexp_replace(
      lower(
        translate(
          coalesce(value, ''),
          'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
          'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'
        )
      ),
      '[^a-z0-9]+',
      '-',
      'g'
    )
  );
$$;

alter table public.businesses
  add column if not exists slug text;

alter table public.businesses
  add column if not exists timezone text not null default 'America/Sao_Paulo';

alter table public.businesses
  add column if not exists public_booking_enabled boolean not null default true;

update public.businesses
set slug = coalesce(nullif(public.slugify(name), ''), 'negocio')
where slug is null or trim(slug) = '';

with ranked as (
  select
    id,
    slug,
    row_number() over (partition by slug order by created_at, id) as position
  from public.businesses
)
update public.businesses business
set slug = business.slug || '-' || left(replace(business.id::text, '-', ''), 6)
from ranked
where business.id = ranked.id
  and ranked.position > 1;

alter table public.businesses
  alter column slug set not null;

alter table public.businesses
  drop constraint if exists businesses_slug_format;

alter table public.businesses
  add constraint businesses_slug_format
  check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and length(slug) <= 80);

create unique index if not exists businesses_slug_key
  on public.businesses (slug);

-- ---------------------------------------------------------------------------
-- Profissionais
-- ---------------------------------------------------------------------------

create table if not exists public.professionals (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists professionals_business_idx
  on public.professionals (business_id);

create unique index if not exists professionals_business_name_key
  on public.professionals (business_id, lower(name));

drop trigger if exists professionals_set_updated_at on public.professionals;
create trigger professionals_set_updated_at
  before update on public.professionals
  for each row execute function public.set_updated_at();

alter table public.professionals enable row level security;

drop policy if exists professionals_tenant_all on public.professionals;
create policy professionals_tenant_all on public.professionals
  for all to authenticated
  using (business_id = public.current_business_id())
  with check (business_id = public.current_business_id());

grant select, insert, update, delete on public.professionals to authenticated;

-- Aproveita profissionais já usados em agendamentos antigos.
insert into public.professionals (business_id, name)
select distinct on (business_id, lower(trim(professional_name)))
  business_id,
  trim(professional_name)
from public.appointments
where trim(professional_name) <> ''
order by business_id, lower(trim(professional_name)), trim(professional_name)
on conflict (business_id, lower(name)) do nothing;

-- ---------------------------------------------------------------------------
-- Origem e token de cancelamento dos agendamentos
-- ---------------------------------------------------------------------------

alter table public.appointments
  add column if not exists source text not null default 'internal';

alter table public.appointments
  drop constraint if exists appointments_source_check;

alter table public.appointments
  add constraint appointments_source_check
  check (source in ('internal', 'public'));

alter table public.appointments
  add column if not exists cancel_token uuid not null default gen_random_uuid();

create unique index if not exists appointments_cancel_token_key
  on public.appointments (cancel_token);

-- ---------------------------------------------------------------------------
-- Cadastro: gera slug e profissional padrão
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
  v_slug text;
begin
  v_business_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'business_name'), ''),
    'Meu negócio'
  );
  v_full_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    split_part(coalesce(new.email, ''), '@', 1)
  );

  v_slug := public.slugify(v_business_name);
  if v_slug = '' then
    v_slug := 'negocio';
  end if;

  if exists (select 1 from public.businesses where slug = v_slug) then
    v_slug := v_slug || '-' || left(replace(new.id::text, '-', ''), 8);
  end if;

  insert into public.businesses (owner_user_id, name, slug, segment)
  values (new.id, v_business_name, v_slug, 'outro')
  returning id into v_business_id;

  insert into public.profiles (user_id, business_id, full_name)
  values (new.id, v_business_id, v_full_name)
  on conflict (user_id) do update
    set business_id = excluded.business_id,
        full_name = excluded.full_name;

  insert into public.professionals (business_id, name)
  values (v_business_id, v_full_name);

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

-- ---------------------------------------------------------------------------
-- RPCs públicas (anon)
-- ---------------------------------------------------------------------------

create or replace function public.public_business(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_business public.businesses%rowtype;
begin
  select * into v_business
  from public.businesses
  where slug = lower(trim(p_slug));

  if not found
     or not v_business.onboarding_completed
     or not v_business.public_booking_enabled then
    return null;
  end if;

  if v_business.subscription_status <> 'active'
     and not (
       v_business.subscription_status = 'trial'
       and v_business.trial_ends_at > now()
     ) then
    return null;
  end if;

  return jsonb_build_object(
    'business', jsonb_build_object(
      'id', v_business.id,
      'slug', v_business.slug,
      'name', v_business.name,
      'segment', v_business.segment,
      'whatsappNumber', v_business.whatsapp_number,
      'logoUrl', v_business.logo_url,
      'openingHours', v_business.opening_hours,
      'timezone', v_business.timezone
    ),
    'services', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', service.id,
          'name', service.name,
          'durationMinutes', service.duration_minutes,
          'price', service.price
        )
        order by service.name
      )
      from public.services service
      where service.business_id = v_business.id
        and service.active
    ), '[]'::jsonb),
    'professionals', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', professional.id, 'name', professional.name)
        order by professional.name
      )
      from public.professionals professional
      where professional.business_id = v_business.id
        and professional.active
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.public_slots(
  p_slug text,
  p_service_id uuid,
  p_professional_id uuid default null,
  p_date date default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_business public.businesses%rowtype;
  v_service public.services%rowtype;
  v_hours jsonb;
  v_open time;
  v_close time;
  v_today date;
begin
  select * into v_business
  from public.businesses
  where slug = lower(trim(p_slug));

  if not found
     or not v_business.onboarding_completed
     or not v_business.public_booking_enabled then
    return '[]'::jsonb;
  end if;

  if v_business.subscription_status <> 'active'
     and not (
       v_business.subscription_status = 'trial'
       and v_business.trial_ends_at > now()
     ) then
    return '[]'::jsonb;
  end if;

  select * into v_service
  from public.services
  where id = p_service_id
    and business_id = v_business.id
    and active;

  if not found then
    return '[]'::jsonb;
  end if;

  v_today := (now() at time zone v_business.timezone)::date;

  if p_date is null
     or p_date < v_today
     or p_date > v_today + 60 then
    return '[]'::jsonb;
  end if;

  v_hours := v_business.opening_hours -> (extract(dow from p_date)::int::text);

  if v_hours is null
     or coalesce((v_hours ->> 'closed')::boolean, true) then
    return '[]'::jsonb;
  end if;

  v_open := (v_hours ->> 'open')::time;
  v_close := (v_hours ->> 'close')::time;

  if v_open is null or v_close is null or v_close <= v_open then
    return '[]'::jsonb;
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'startsAt', slot_start,
        'time', to_char(slot_start at time zone v_business.timezone, 'HH24:MI')
      )
      order by slot_start
    )
    from (
      select
        ((p_date + v_open) at time zone v_business.timezone)
          + make_interval(mins => step.minute) as slot_start
      from generate_series(
        0,
        (extract(epoch from (v_close - v_open)) / 60)::int,
        v_service.duration_minutes
      ) as step(minute)
    ) slots
    where slot_start >= now() + interval '2 hours'
      and slot_start + make_interval(mins => v_service.duration_minutes)
        <= ((p_date + v_close) at time zone v_business.timezone)
      and exists (
        select 1
        from public.professionals professional
        where professional.business_id = v_business.id
          and professional.active
          and (p_professional_id is null or professional.id = p_professional_id)
          and not exists (
            select 1
            from public.appointments appointment
            where appointment.business_id = v_business.id
              and appointment.status in ('agendado', 'confirmado', 'concluido')
              and lower(trim(appointment.professional_name))
                = lower(trim(professional.name))
              and tstzrange(appointment.starts_at, appointment.ends_at)
                && tstzrange(
                  slot_start,
                  slot_start + make_interval(mins => v_service.duration_minutes)
                )
          )
      )
  ), '[]'::jsonb);
end;
$$;

create or replace function public.public_book(
  p_slug text,
  p_service_id uuid,
  p_professional_id uuid,
  p_starts_at timestamptz,
  p_name text,
  p_phone text,
  p_email text default null,
  p_notes text default null,
  p_marketing_consent boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business public.businesses%rowtype;
  v_service public.services%rowtype;
  v_professional public.professionals%rowtype;
  v_client_id uuid;
  v_appointment_id uuid;
  v_cancel_token uuid := gen_random_uuid();
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_starts_at timestamptz := p_starts_at;
  v_ends_at timestamptz;
  v_slots jsonb;
  v_active_count int;
begin
  if length(trim(coalesce(p_name, ''))) < 2 then
    raise exception 'Informe seu nome completo.';
  end if;

  if length(v_phone) < 12 then
    raise exception 'Informe um WhatsApp válido.';
  end if;

  select * into v_business
  from public.businesses
  where slug = lower(trim(p_slug));

  if not found
     or not v_business.onboarding_completed
     or not v_business.public_booking_enabled then
    raise exception 'Agenda online indisponível.';
  end if;

  if v_business.subscription_status <> 'active'
     and not (
       v_business.subscription_status = 'trial'
       and v_business.trial_ends_at > now()
     ) then
    raise exception 'Agenda online indisponível.';
  end if;

  select * into v_service
  from public.services
  where id = p_service_id
    and business_id = v_business.id
    and active;

  if not found then
    raise exception 'Serviço indisponível.';
  end if;

  v_ends_at := v_starts_at + make_interval(mins => v_service.duration_minutes);

  if v_starts_at < now() + interval '2 hours' then
    raise exception 'Este horário não está mais disponível. Escolha outro.';
  end if;

  v_slots := public.public_slots(
    p_slug,
    p_service_id,
    p_professional_id,
    (v_starts_at at time zone v_business.timezone)::date
  );

  if not exists (
    select 1
    from jsonb_array_elements(v_slots) slot
    where (slot ->> 'startsAt')::timestamptz = v_starts_at
  ) then
    raise exception 'Este horário não está mais disponível. Escolha outro.';
  end if;

  select * into v_professional
  from public.professionals professional
  where professional.business_id = v_business.id
    and professional.active
    and (p_professional_id is null or professional.id = p_professional_id)
    and not exists (
      select 1
      from public.appointments appointment
      where appointment.business_id = v_business.id
        and appointment.status in ('agendado', 'confirmado', 'concluido')
        and lower(trim(appointment.professional_name))
          = lower(trim(professional.name))
        and tstzrange(appointment.starts_at, appointment.ends_at)
          && tstzrange(v_starts_at, v_ends_at)
    )
  order by professional.created_at
  limit 1;

  if not found then
    raise exception 'Este horário não está mais disponível. Escolha outro.';
  end if;

  select count(*) into v_active_count
  from public.appointments appointment
  join public.clients client on client.id = appointment.client_id
  where appointment.business_id = v_business.id
    and appointment.status in ('agendado', 'confirmado', 'concluido')
    and appointment.starts_at > now()
    and regexp_replace(client.phone, '\D', '', 'g') = v_phone;

  if v_active_count >= 3 then
    raise exception 'Você já possui agendamentos futuros. Fale com o negócio pelo WhatsApp.';
  end if;

  insert into public.clients (
    business_id,
    name,
    phone,
    email,
    marketing_consent,
    consent_date
  )
  values (
    v_business.id,
    trim(p_name),
    v_phone,
    nullif(trim(coalesce(p_email, '')), ''),
    coalesce(p_marketing_consent, false),
    case when coalesce(p_marketing_consent, false) then now() end
  )
  on conflict (business_id, phone) where deleted_at is null do nothing
  returning id into v_client_id;

  if v_client_id is null then
    select id into v_client_id
    from public.clients
    where business_id = v_business.id
      and deleted_at is null
      and regexp_replace(phone, '\D', '', 'g') = v_phone
    limit 1;

    if coalesce(p_marketing_consent, false) then
      update public.clients
      set marketing_consent = true,
          consent_date = coalesce(consent_date, now())
      where id = v_client_id
        and not marketing_consent;
    end if;
  end if;

  if v_client_id is null then
    raise exception 'Não foi possível cadastrar seu contato. Tente novamente.';
  end if;

  insert into public.appointments (
    business_id,
    client_id,
    service_id,
    professional_name,
    starts_at,
    ends_at,
    price,
    status,
    notes,
    source,
    cancel_token
  )
  values (
    v_business.id,
    v_client_id,
    v_service.id,
    v_professional.name,
    v_starts_at,
    v_ends_at,
    v_service.price,
    'agendado',
    nullif(trim(coalesce(p_notes, '')), ''),
    'public',
    v_cancel_token
  )
  returning id into v_appointment_id;

  return jsonb_build_object(
    'id', v_appointment_id,
    'cancelToken', v_cancel_token,
    'startsAt', v_starts_at,
    'endsAt', v_ends_at,
    'professionalName', v_professional.name,
    'serviceName', v_service.name,
    'price', v_service.price,
    'status', 'agendado'
  );

exception
  when exclusion_violation then
    raise exception 'Este horário não está mais disponível. Escolha outro.';
end;
$$;

create or replace function public.public_booking(
  p_id uuid,
  p_token uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_appointment public.appointments%rowtype;
  v_business public.businesses%rowtype;
  v_client public.clients%rowtype;
  v_service_name text;
begin
  select * into v_appointment
  from public.appointments
  where id = p_id
    and cancel_token = p_token;

  if not found then
    return null;
  end if;

  select * into v_business
  from public.businesses
  where id = v_appointment.business_id;

  select * into v_client
  from public.clients
  where id = v_appointment.client_id;

  select name into v_service_name
  from public.services
  where id = v_appointment.service_id;

  return jsonb_build_object(
    'id', v_appointment.id,
    'businessName', v_business.name,
    'businessSlug', v_business.slug,
    'businessWhatsapp', v_business.whatsapp_number,
    'serviceName', v_service_name,
    'professionalName', nullif(v_appointment.professional_name, ''),
    'startsAt', v_appointment.starts_at,
    'endsAt', v_appointment.ends_at,
    'price', v_appointment.price,
    'status', v_appointment.status,
    'clientName', v_client.name,
    'canCancel', v_appointment.status in ('agendado', 'confirmado')
      and v_appointment.starts_at > now() + interval '2 hours'
  );
end;
$$;

create or replace function public.public_cancel(
  p_id uuid,
  p_token uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appointment public.appointments%rowtype;
begin
  select * into v_appointment
  from public.appointments
  where id = p_id
    and cancel_token = p_token
  for update;

  if not found then
    raise exception 'Agendamento não encontrado.';
  end if;

  if v_appointment.status not in ('agendado', 'confirmado') then
    raise exception 'Este agendamento não pode mais ser cancelado.';
  end if;

  if v_appointment.starts_at <= now() + interval '2 hours' then
    raise exception 'O cancelamento online não está disponível com menos de 2 horas de antecedência.';
  end if;

  update public.appointments
  set status = 'cancelado'
  where id = p_id;
end;
$$;

revoke all on function public.public_business(text) from public;
revoke all on function public.public_slots(text, uuid, uuid, date) from public;
revoke all on function public.public_book(text, uuid, uuid, timestamptz, text, text, text, text, boolean) from public;
revoke all on function public.public_booking(uuid, uuid) from public;
revoke all on function public.public_cancel(uuid, uuid) from public;

grant execute on function public.public_business(text) to anon, authenticated;
grant execute on function public.public_slots(text, uuid, uuid, date) to anon, authenticated;
grant execute on function public.public_book(text, uuid, uuid, timestamptz, text, text, text, text, boolean) to anon, authenticated;
grant execute on function public.public_booking(uuid, uuid) to anon, authenticated;
grant execute on function public.public_cancel(uuid, uuid) to anon, authenticated;
