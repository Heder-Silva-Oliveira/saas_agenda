-- Controlativa — dados de demonstração (opcional)
-- Execute DEPOIS de criar a conta pelo app (o trigger cria negócio/perfil).
-- Popula o primeiro negócio cadastrado com clientes, serviços e agenda.
-- Não faz nada se o negócio já possuir clientes.

do $$
declare
  v_business uuid;
begin
  select business_id into v_business
  from public.profiles
  order by created_at
  limit 1;

  if v_business is null then
    raise notice 'Nenhum perfil encontrado. Cadastre-se no app antes de rodar o seed.';
    return;
  end if;

  if exists (select 1 from public.clients where business_id = v_business) then
    raise notice 'O negócio % já possui clientes. Seed ignorado.', v_business;
    return;
  end if;

  insert into public.services (id, business_id, name, duration_minutes, price)
  values
    ('11111111-1111-4111-8111-111111111101', v_business, 'Corte masculino', 30, 45.00),
    ('11111111-1111-4111-8111-111111111102', v_business, 'Barba completa', 30, 35.00),
    ('11111111-1111-4111-8111-111111111103', v_business, 'Corte + barba', 60, 70.00),
    ('11111111-1111-4111-8111-111111111104', v_business, 'Hidratação', 45, 55.00)
  on conflict (id) do nothing;

  insert into public.clients
    (id, business_id, name, phone, email, birth_date, notes, tags, status, marketing_consent, consent_date)
  values
    ('22222222-2222-4222-8222-222222222201', v_business, 'Ana Beatriz Souza', '5511991110001',
      'ana@email.com', current_date - interval '32 years', 'Prefere atendimento pela manhã.',
      array['vip', 'cabelo'], 'ativo', true, now()),
    ('22222222-2222-4222-8222-222222222202', v_business, 'Carlos Eduardo Lima', '5511991110002',
      'carlos@email.com', current_date - interval '28 years', null,
      array['recorrente'], 'ativo', true, now()),
    ('22222222-2222-4222-8222-222222222203', v_business, 'Mariana Ferreira', '5511991110003',
      'mariana@email.com', current_date + interval '3 days' - interval '25 years', null,
      array['sobrancelha'], 'ativo', true, now()),
    ('22222222-2222-4222-8222-222222222204', v_business, 'João Pedro Alves', '5511991110004',
      null, '1990-04-18', null, array['barba'], 'ativo', false, null),
    ('22222222-2222-4222-8222-222222222205', v_business, 'Fernanda Costa', '5511991110005',
      'fernanda@email.com', '1994-09-02', 'Cliente sem retorno há 45 dias.',
      array['retorno'], 'inativo', true, now()),
    ('22222222-2222-4222-8222-222222222206', v_business, 'Ricardo Santos', '5511991110006',
      'ricardo@email.com', '1988-02-14', null, array[]::text[], 'ativo', true, now())
  on conflict (id) do nothing;

  insert into public.appointments
    (business_id, client_id, service_id, professional_name, starts_at, ends_at, price, status, notes)
  values
    (v_business, '22222222-2222-4222-8222-222222222201',
      '11111111-1111-4111-8111-111111111103', 'Rafael',
      current_date + time '10:00', current_date + time '11:00', 70.00, 'concluido', null),
    (v_business, '22222222-2222-4222-8222-222222222202',
      '11111111-1111-4111-8111-111111111101', 'Rafael',
      current_date + time '14:00', current_date + time '14:30', 45.00, 'confirmado', null),
    (v_business, '22222222-2222-4222-8222-222222222203',
      '11111111-1111-4111-8111-111111111102', 'Rafael',
      current_date + interval '1 day' + time '09:00',
      current_date + interval '1 day' + time '09:30', 35.00, 'agendado', null),
    (v_business, '22222222-2222-4222-8222-222222222204',
      '11111111-1111-4111-8111-111111111103', 'Rafael',
      current_date + interval '3 days' + time '16:00',
      current_date + interval '3 days' + time '17:00', 70.00, 'agendado', null),
    (v_business, '22222222-2222-4222-8222-222222222205',
      '11111111-1111-4111-8111-111111111104', 'Rafael',
      current_date - interval '45 days' + time '11:00',
      current_date - interval '45 days' + time '11:45', 55.00, 'concluido', null),
    (v_business, '22222222-2222-4222-8222-222222222206',
      '11111111-1111-4111-8111-111111111101', 'Rafael',
      current_date - interval '10 days' + time '15:00',
      current_date - interval '10 days' + time '15:30', 45.00, 'faltou', null);

  raise notice 'Seed aplicado ao negócio %.', v_business;
end;
$$;
