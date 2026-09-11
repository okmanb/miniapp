-- =============================================================================
-- Simuladeudas — esquema base
--
-- No hay nada que migrar: el modelo viejo quedó en el tag v0-preliminar y en
-- supabase/migration_00*.sql, que se conservan solo como referencia.
--
-- Dos decisiones estructuran todo lo demás:
--
-- 1. TODO DATO DE SIMULACIÓN CUELGA DE UN ESCENARIO. Deudas, gastos, ingresos,
--    pagos y resúmenes llevan scenario_id NOT NULL. Un gasto creado en el plan
--    base no existe en el plan de contingencia. Copiar un escenario copia sus
--    filas, no las comparte (ver copy_scenario más abajo).
--
-- 2. EL SALDO SE DERIVA, NO SE GUARDA. Las tablas guardan hechos —saldo base
--    del resumen, gastos abiertos, pagos registrados— y el saldo sale de
--    sumarlos en lib/calc/. No hay columna current_balance que parchear al
--    agregar o quitar un gasto: si hiciera falta revertir un parche, el modelo
--    estaría mal.
--
-- Las políticas de acceso por fila van escritas junto a cada tabla, no en un
-- bloque al final, para que agregar una tabla sin su política se note.
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Escenarios
-- -----------------------------------------------------------------------------

create table if not exists scenarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  -- Plata disponible al arrancar la proyección. Es un dato del escenario, no
  -- del usuario: el plan de contingencia puede partir de otro colchón.
  starting_balance numeric(14, 2) not null default 0,
  is_active boolean not null default false,
  -- Para acordarse después de qué se cambió en este plan. La lista de
  -- escenarios los muestra todos parecidos; la nota es lo que los distingue.
  note text,
  created_at timestamptz not null default now()
);

create index if not exists scenarios_user_idx on scenarios (user_id);
-- Un solo escenario activo por usuario, garantizado por la base y no por la app.
create unique index if not exists scenarios_one_active_idx
  on scenarios (user_id) where is_active;

alter table scenarios enable row level security;

create policy "scenarios propios" on scenarios
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- Deudas
-- -----------------------------------------------------------------------------

create type debt_kind as enum (
  'tarjeta', 'prestamo_personal', 'prendario', 'hipotecario', 'plan_v', 'otro'
);

create table if not exists debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scenario_id uuid not null references scenarios(id) on delete cascade,
  name text not null,
  kind debt_kind not null default 'otro',

  -- Saldo de arranque: para una tarjeta es el saldo del último resumen
  -- cargado; el saldo vigente se deriva sumándole los gastos abiertos y
  -- restándole los pagos. Nunca se escribe desde la pantalla de gastos.
  base_balance numeric(14, 2) not null default 0,
  base_balance_at date,

  -- La tasa se guarda como viene del banco. tem tiene prioridad sobre
  -- annual_interest_rate cuando las dos están cargadas.
  annual_interest_rate numeric(8, 4),
  tem numeric(8, 6),

  credit_limit numeric(14, 2),
  due_day smallint check (due_day between 1 and 31),
  closing_day smallint check (closing_day between 1 and 31),

  -- Solo para deudas con plazo conocido: habilita la amortización francesa
  -- analítica en vez de pedir 36 filas idénticas cargadas a mano.
  installments_total smallint,
  installments_paid smallint not null default 0,

  -- La letra chica del mínimo cambia por banco; el default vive en el código.
  min_payment_formula jsonb,

  -- Cuota mensual de una deuda que no tiene resumen. Una tarjeta trae su
  -- mínimo en el resumen; un préstamo no trae nada, y sin esto entraba al
  -- flujo con cuota cero — la proyección lo ignoraba y el mes daba más
  -- holgado de lo que es.
  monthly_payment numeric(14, 2),

  -- Lo que se debia al empezar. No se deriva ni se puede: el modelo solo
  -- conoce los pagos hechos desde que la app existe, asi que sin esto el
  -- porcentaje saldado de una deuda anterior a la app cuenta de menos.
  original_amount numeric(14, 2),

  -- al_dia | en_mora. Lo dice la persona, no la app: la app ve que el
  -- vencimiento paso, pero no sabe si el pago entro al banco.
  status text not null default 'al_dia' check (status in ('al_dia', 'en_mora')),

  account_last4 text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists debts_scenario_idx on debts (scenario_id);
create index if not exists debts_user_idx on debts (user_id);

alter table debts enable row level security;

create policy "deudas propias" on debts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- Pagos de una deuda
-- -----------------------------------------------------------------------------

create type payment_kind as enum ('cuota_fija', 'pago_variable', 'minimo_estimado', 'unico');

create table if not exists debt_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scenario_id uuid not null references scenarios(id) on delete cascade,
  debt_id uuid not null references debts(id) on delete cascade,
  period text not null check (period ~ '^\d{4}-\d{2}$'),
  paid_on date,
  amount numeric(14, 2) not null,
  kind payment_kind not null default 'pago_variable',
  note text,
  -- De que resumen salio este pago. El campo "cuanto pagaste" del resumen no
  -- se guarda restado adentro del saldo: se guarda aca, como pago, para que
  -- tenga recibo en el historial igual que uno cargado a mano.
  -- La FK se agrega mas abajo, porque card_statements todavia no existe.
  statement_id uuid,
  -- Un pago absorbido ya esta adentro del saldo base que dejo un resumen, asi
  -- que NO se vuelve a restar. Es la Regla 3 aplicada a los pagos: el resumen
  -- se come lo que ya trae adentro, igual que archiva los gastos duplicados.
  -- Sin esto, el pago de un resumen sigue descontando para siempre y el saldo
  -- baja dos veces por el mismo peso.
  is_absorbed boolean not null default false,
  absorbed_by_statement_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists debt_payments_debt_idx on debt_payments (debt_id, period);
-- Los que siguen contando. Es el filtro de todas las lecturas que derivan saldo.
create index if not exists debt_payments_live_idx
  on debt_payments (debt_id) where not is_absorbed;
-- Un pago por resumen: volver a guardar el mismo resumen corrige el pago, no
-- agrega otro.
create unique index if not exists debt_payments_one_per_statement_idx
  on debt_payments (statement_id) where statement_id is not null;
-- Integridad: un mínimo por deuda por mes. El atajo de "registrar el mínimo"
-- no puede aplicarse dos veces en el mismo período sin que se note.
create unique index if not exists debt_payments_one_minimum_idx
  on debt_payments (debt_id, period) where kind = 'minimo_estimado';

alter table debt_payments enable row level security;

create policy "pagos propios" on debt_payments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- Plan de pago mes a mes
-- -----------------------------------------------------------------------------

create table if not exists debt_schedule_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scenario_id uuid not null references scenarios(id) on delete cascade,
  debt_id uuid not null references debts(id) on delete cascade,
  period text not null check (period ~ '^\d{4}-\d{2}$'),
  amount numeric(14, 2) not null,
  kind payment_kind not null,
  -- Un valor confirmado por el usuario deja de ser estimación en el acto,
  -- aunque la app lo hubiera estimado antes.
  is_estimate boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  unique (debt_id, period)
);

create index if not exists schedule_debt_idx on debt_schedule_entries (debt_id, period);

alter table debt_schedule_entries enable row level security;

create policy "plan propio" on debt_schedule_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- Resúmenes de tarjeta y sus cuotas
-- -----------------------------------------------------------------------------

create table if not exists card_statements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scenario_id uuid not null references scenarios(id) on delete cascade,
  debt_id uuid not null references debts(id) on delete cascade,
  period text not null check (period ~ '^\d{4}-\d{2}$'),
  closing_date date,
  due_date date,

  -- Los cinco números que hacen al total, guardados por separado para poder
  -- explicar por qué el saldo creció y no solo cuánto.
  previous_balance numeric(14, 2) not null default 0,
  interest_charged numeric(14, 2) not null default 0,
  new_charges numeric(14, 2) not null default 0,
  installments_charge numeric(14, 2) not null default 0,
  total_due numeric(14, 2) not null default 0,

  minimum_payment numeric(14, 2),
  amount_paid numeric(14, 2) not null default 0,
  -- Lo que el parser pudo leer linea por linea en dolares. NO es el total del
  -- resumen: sirve para avisar cuando no coinciden, no para mostrar.
  usd_charges_excluded numeric(14, 2) not null default 0,
  -- El total en dolares que declara el resumen, y la cotizacion con la que se
  -- convirtio. Se guardan los dos porque el peso equivalente ya quedo adentro
  -- del cierre: sin la cotizacion no hay forma de explicar de donde salio.
  -- Sin cotizacion cargada, los dolares no entran al saldo.
  usd_balance numeric(14, 2) not null default 0,
  usd_rate numeric(14, 4),
  source text not null default 'manual',
  warnings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (debt_id, period)
);

create index if not exists statements_debt_idx on card_statements (debt_id, period);

-- Las dos referencias de debt_payments a los resumenes. Van aca y no en la
-- tabla porque debt_payments se crea antes que card_statements.
alter table debt_payments
  drop constraint if exists debt_payments_statement_fk,
  add constraint debt_payments_statement_fk
    foreign key (statement_id) references card_statements(id) on delete cascade;

alter table debt_payments
  drop constraint if exists debt_payments_absorbed_by_fk,
  add constraint debt_payments_absorbed_by_fk
    foreign key (absorbed_by_statement_id) references card_statements(id) on delete set null;

alter table card_statements enable row level security;

create policy "resumenes propios" on card_statements
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists card_installment_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scenario_id uuid not null references scenarios(id) on delete cascade,
  debt_id uuid not null references debts(id) on delete cascade,
  cupon text,
  description text,
  first_period text not null check (first_period ~ '^\d{4}-\d{2}$'),
  total_installments smallint not null,
  installment_amount numeric(14, 2) not null,
  -- 0 es una tasa real conocida (cuota sin interés del comercio), no "no sé
  -- la tasa". Por eso admite 0 y el código chequea null, no falsy.
  tna numeric(8, 4),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists plans_debt_idx on card_installment_plans (debt_id);

-- El cupón es el identificador que el banco le da a cada compra en cuotas.
-- Sin esto, cargar dos veces el mismo resumen duplica todas sus cuotas.
-- Parcial: una cuota cargada a mano puede no tener cupón, y dos sin cupón no
-- son necesariamente la misma compra.
create unique index if not exists card_installment_plans_debt_cupon_idx
  on card_installment_plans (debt_id, cupon)
  where cupon is not null;

alter table card_installment_plans enable row level security;

create policy "cuotas propias" on card_installment_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- Gastos
--
-- Las ocho reglas de PRODUCT-RULES.md viven acá. La diferencia entre gasto
-- fijo y consumo único es de comportamiento: is_recurring decide si suma a
-- cada mes de la proyección o una sola vez, en period.
-- -----------------------------------------------------------------------------

create type expense_payment as enum ('efectivo', 'tarjeta');

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scenario_id uuid not null references scenarios(id) on delete cascade,

  description text not null,
  amount numeric(14, 2) not null,
  category text,

  -- Regla 1: todo gasto guarda el mes en que se cargó y su escenario.
  period text not null check (period ~ '^\d{4}-\d{2}$'),

  -- Fijo (repite todos los meses) vs. consumo único (entra una sola vez).
  is_recurring boolean not null default false,

  -- Regla 4: cambiar el monto "desde este mes" cierra el registro viejo con el
  -- mes en que dejó de valer y abre uno nuevo. El historial no se reescribe.
  -- Regla 5: un fijo terminado deja de contar en la repetición mensual.
  ended_period text check (ended_period ~ '^\d{4}-\d{2}$'),

  -- Regla 3: al cargar el resumen, los gastos abiertos de esa tarjeta se
  -- archivan, no se borran. Dejan de sumar al saldo, siguen consultables y se
  -- pueden recuperar. Un fijo archivado igual sigue repitiéndose.
  is_archived boolean not null default false,
  archived_by_statement_id uuid references card_statements(id) on delete set null,

  -- Regla 7: un fijo pagado con tarjeta no sale del efectivo. El total de
  -- gastos del mes cuenta solo lo que sí sale del efectivo.
  paid_with expense_payment not null default 'efectivo',
  -- Regla 8: cambiar un gasto de tarjeta se hace editando esta columna.
  debt_id uuid references debts(id) on delete set null,

  created_at timestamptz not null default now(),

  -- Un gasto pagado con tarjeta necesita saber con cuál.
  constraint expense_card_needs_debt
    check (paid_with <> 'tarjeta' or debt_id is not null)
);

create index if not exists expenses_scenario_period_idx on expenses (scenario_id, period);
create index if not exists expenses_debt_idx on expenses (debt_id) where debt_id is not null;

alter table expenses enable row level security;

create policy "gastos propios" on expenses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- Ingresos
--
-- El sueldo puede venir en dos partes con montos que cambian mes a mes, y hay
-- ingresos que entran una vez al año. Por eso kind + eligible_months en vez de
-- un booleano "es mensual".
-- -----------------------------------------------------------------------------

create type income_kind as enum ('mensual', 'aguinaldo', 'bono');

create table if not exists incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scenario_id uuid not null references scenarios(id) on delete cascade,

  description text not null,
  amount numeric(14, 2) not null,
  kind income_kind not null default 'mensual',

  -- Meses del año (1-12) en que entra este ingreso. Vacío = todos, para el
  -- caso mensual. El aguinaldo vive naturalmente como {6,12}.
  eligible_months smallint[] not null default '{}',

  period text not null check (period ~ '^\d{4}-\d{2}$'),
  -- Un aumento se aplica desde el mes correspondiente en adelante; no se
  -- reescribe el histórico (misma regla que el monto de un gasto fijo).
  ended_period text check (ended_period ~ '^\d{4}-\d{2}$'),

  created_at timestamptz not null default now()
);

create index if not exists incomes_scenario_period_idx on incomes (scenario_id, period);

alter table incomes enable row level security;

create policy "ingresos propios" on incomes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- Préstamos puente
-- -----------------------------------------------------------------------------

create table if not exists bridge_loans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scenario_id uuid not null references scenarios(id) on delete cascade,
  lender text not null,
  amount numeric(14, 2) not null,
  taken_period text not null check (taken_period ~ '^\d{4}-\d{2}$'),
  repay_period text check (repay_period ~ '^\d{4}-\d{2}$'),
  -- Tasa MENSUAL y simple, como la pide la pantalla: costo = monto * tasa * meses.
  monthly_interest_rate numeric(8, 4),
  -- Simulado no es tomado: mirar cuanto costaria no puede mover la proyeccion
  -- sola. Solo los tomados entran al flujo de caja.
  is_taken boolean not null default false,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists bridge_scenario_idx on bridge_loans (scenario_id);

alter table bridge_loans enable row level security;

create policy "puentes propios" on bridge_loans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- Alertas
--
-- Los tipos salen de handoff/RESCATE-integridad-y-alertas.md. Se derivan del
-- modelo en cada lectura; la tabla guarda solo el estado de descartada, para
-- que una alerta ya vista no vuelva sola.
-- -----------------------------------------------------------------------------

create type alert_kind as enum (
  'saldo_creciente', 'doble_conteo', 'mes_no_reflejado',
  'gasto_no_capturado', 'vencimiento_hoy', 'tasa_mas_cara',
  'mes_no_cierra', 'cuotas_fijas'
);

create table if not exists alert_dismissals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scenario_id uuid not null references scenarios(id) on delete cascade,
  kind alert_kind not null,
  -- Identifica la instancia concreta (por ejemplo el id de la deuda), para no
  -- silenciar toda una categoría de alerta de por vida.
  subject_id text not null,
  dismissed_at timestamptz not null default now(),
  -- Posponer no descarta: la alerta vuelve manana, o antes si el vencimiento
  -- aprieta. Lo que se guarda es hasta cuando.
  snoozed_until timestamptz not null default now(),
  unique (scenario_id, kind, subject_id)
);

alter table alert_dismissals enable row level security;

create policy "descartes propios" on alert_dismissals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- Preferencias de aviso: cuándo, por dónde y sobre qué deudas.
--
-- Van por usuario y no por escenario: la preferencia es de la persona, y
-- cambiar de escenario no debería cambiar cómo le avisamos.
-- -----------------------------------------------------------------------------

create table if not exists alert_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  -- Cuántos días antes del vencimiento avisamos. 0 = el mismo día.
  lead_days smallint not null default 3 check (lead_days in (0, 1, 3, 7)),
  -- Al menos un canal: una preferencia vacía es no tener preferencia.
  channels text[] not null default '{push}' check (array_length(channels, 1) >= 1),
  -- 'todas' | 'algunas'. Con 'algunas' manda only_debt_ids.
  scope text not null default 'todas' check (scope in ('todas', 'algunas')),
  only_debt_ids uuid[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table alert_settings enable row level security;

create policy "preferencias propias" on alert_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- Copiar un escenario copia sus datos, no los comparte.
--
-- Va como función de base y no como cinco inserts en el servidor de Next
-- porque tiene que ser atómica: un escenario copiado a medias es peor que no
-- copiarlo. El orden respeta las FK, y el mapa old->new mantiene las
-- referencias internas (un gasto de tarjeta sigue apuntando a SU tarjeta, la
-- copiada, no a la del escenario original).
-- -----------------------------------------------------------------------------

create or replace function copy_scenario(source_id uuid, new_name text)
returns uuid
language plpgsql
security invoker
-- Sin search_path fijo, quien pueda crear objetos en un esquema que caiga
-- antes en el search_path del que llama puede secuestrar las referencias a
-- tablas de acá adentro. pg_temp va al final y explícito porque la función
-- crea una tabla temporal.
set search_path = public, pg_temp
as $$
declare
  -- No se llama new_id: esa es tambien la columna de _debt_map, y plpgsql no
  -- sabria a cual se refieren los INSERT ... SELECT que usan las dos.
  new_scen_id uuid;
  owner uuid;
  old_debt debts%rowtype;
  copied_debt_id uuid;
begin
  select user_id into owner from scenarios where id = source_id;
  if owner is null then
    raise exception 'escenario inexistente o sin acceso';
  end if;

  insert into scenarios (user_id, name, starting_balance, is_active, note)
  select user_id, new_name, starting_balance, false, note
  from scenarios where id = source_id
  returning id into new_scen_id;

  -- Mapa de deudas viejas a nuevas: lo necesitan gastos y todo lo que cuelga
  -- de una deuda.
  create temp table _debt_map (old_id uuid primary key, new_id uuid) on commit drop;

  -- Fila por fila y no con un INSERT ... SELECT masivo: para emparejar la
  -- deuda vieja con la nueva hace falta una clave, y el nombre no lo es (dos
  -- tarjetas pueden llamarse igual, y ahí los gastos se irían a la tarjeta
  -- equivocada). Un escenario tiene decenas de deudas, no miles.
  for old_debt in select * from debts where scenario_id = source_id loop
    insert into debts (
      user_id, scenario_id, name, kind, base_balance, base_balance_at,
      annual_interest_rate, tem, credit_limit, due_day, closing_day,
      installments_total, installments_paid, min_payment_formula,
      monthly_payment, account_last4, is_active,
      original_amount, status
    )
    values (
      old_debt.user_id, new_scen_id, old_debt.name, old_debt.kind,
      old_debt.base_balance, old_debt.base_balance_at,
      old_debt.annual_interest_rate, old_debt.tem, old_debt.credit_limit,
      old_debt.due_day, old_debt.closing_day, old_debt.installments_total,
      old_debt.installments_paid, old_debt.min_payment_formula,
      old_debt.monthly_payment, old_debt.account_last4, old_debt.is_active,
      old_debt.original_amount, old_debt.status
    )
    returning id into copied_debt_id;

    insert into _debt_map (old_id, new_id) values (old_debt.id, copied_debt_id);
  end loop;

  insert into debt_schedule_entries (user_id, scenario_id, debt_id, period, amount, kind, is_estimate, note)
  select e.user_id, new_scen_id, m.new_id, e.period, e.amount, e.kind, e.is_estimate, e.note
  from debt_schedule_entries e join _debt_map m on m.old_id = e.debt_id
  where e.scenario_id = source_id;

  insert into card_statements (
    user_id, scenario_id, debt_id, period, closing_date, due_date,
    previous_balance, interest_charged, new_charges, installments_charge,
    total_due, minimum_payment, amount_paid, usd_charges_excluded,
    usd_balance, usd_rate, source, warnings
  )
  select
    s.user_id, new_scen_id, m.new_id, s.period, s.closing_date, s.due_date,
    s.previous_balance, s.interest_charged, s.new_charges, s.installments_charge,
    s.total_due, s.minimum_payment, s.amount_paid, s.usd_charges_excluded,
    s.usd_balance, s.usd_rate, s.source, s.warnings
  from card_statements s join _debt_map m on m.old_id = s.debt_id
  where s.scenario_id = source_id;

  /*
   * Los pagos van DESPUES de los resumenes, y no al reves, porque cada pago
   * que salio de un resumen tiene que quedar apuntando al resumen COPIADO.
   *
   * Dejarlos en null era lo primero que se hizo, por analogia con
   * expenses.is_archived, y estaba mal: sin `statement_id`, volver a guardar
   * ese resumen en la copia no encuentra el pago para corregirlo y agrega otro
   * — dos pagos por el mismo resumen, y el saldo bajando dos veces.
   *
   * El emparejamiento no necesita un mapa aparte: (debt_id, period) es unico
   * en card_statements, asi que con la deuda copiada y el periodo se llega al
   * resumen copiado.
   */
  insert into debt_payments (
    user_id, scenario_id, debt_id, period, paid_on, amount, kind, note,
    statement_id, is_absorbed, absorbed_by_statement_id
  )
  select
    p.user_id, new_scen_id, m.new_id, p.period, p.paid_on, p.amount, p.kind, p.note,
    ns.id, p.is_absorbed, na.id
  from debt_payments p
  join _debt_map m on m.old_id = p.debt_id
  -- El resumen del que salio, viejo y copiado.
  left join card_statements os on os.id = p.statement_id
  left join card_statements ns
    on ns.scenario_id = new_scen_id and ns.debt_id = m.new_id and ns.period = os.period
  -- Y el que lo absorbio, viejo y copiado.
  left join card_statements oa on oa.id = p.absorbed_by_statement_id
  left join card_statements na
    on na.scenario_id = new_scen_id and na.debt_id = m.new_id and na.period = oa.period
  where p.scenario_id = source_id;

  insert into card_installment_plans (
    user_id, scenario_id, debt_id, cupon, description, first_period,
    total_installments, installment_amount, tna, is_active
  )
  select
    c.user_id, new_scen_id, m.new_id, c.cupon, c.description, c.first_period,
    c.total_installments, c.installment_amount, c.tna, c.is_active
  from card_installment_plans c join _debt_map m on m.old_id = c.debt_id
  where c.scenario_id = source_id;

  -- El gasto de tarjeta sigue a su tarjeta copiada; el de efectivo lleva null.
  insert into expenses (
    user_id, scenario_id, description, amount, category, period,
    is_recurring, ended_period, is_archived, paid_with, debt_id
  )
  select
    e.user_id, new_scen_id, e.description, e.amount, e.category, e.period,
    e.is_recurring, e.ended_period, e.is_archived, e.paid_with, m.new_id
  from expenses e left join _debt_map m on m.old_id = e.debt_id
  where e.scenario_id = source_id;

  insert into incomes (user_id, scenario_id, description, amount, kind, eligible_months, period, ended_period)
  select user_id, new_scen_id, description, amount, kind, eligible_months, period, ended_period
  from incomes where scenario_id = source_id;

  -- Un puente simulado en el original sigue simulado en la copia: copiar un
  -- plan para probar variantes no es tomar la plata.
  insert into bridge_loans (
    user_id, scenario_id, lender, amount, taken_period, repay_period,
    monthly_interest_rate, is_taken, note
  )
  select
    user_id, new_scen_id, lender, amount, taken_period, repay_period,
    monthly_interest_rate, is_taken, note
  from bridge_loans where scenario_id = source_id;

  return new_scen_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 004 · Crear un escenario a partir de otro, en una sola operación.
--
-- La pantalla de escenarios ofrece "arrancar copiando las deudas de …" y, al
-- lado, tu ingreso y tu gasto fijo. La frase del prototipo dice exactamente
-- qué copia y qué no: "las deudas del mes las toma del plan que copiás; acá
-- cambiás tu lado de la cuenta".
--
-- Eso es copy_scenario con dos diferencias: los ingresos y los gastos en
-- efectivo del original NO viajan (son el lado que se está reemplazando), y
-- los gastos de tarjeta SÍ, porque son parte del saldo de su tarjeta y sacarlos
-- dejaría deudas con un saldo que no coincide con el original.
--
-- Va como función de base y no como cinco pasos en el servidor por lo mismo que
-- copy_scenario: tiene que ser atómica. Un escenario copiado a medias —con las
-- deudas del original y también con sus ingresos— es peor que no copiarlo,
-- porque parece completo y proyecta el doble de plata entrando.
-- -----------------------------------------------------------------------------

create or replace function create_scenario_from(
  source_id uuid,
  new_name text,
  new_note text,
  start_balance numeric,
  monthly_income numeric,
  monthly_fixed numeric
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  new_scen_id uuid;
  owner uuid;
  first_period text := to_char(now(), 'YYYY-MM');
begin
  if source_id is null then
    select auth.uid() into owner;
    if owner is null then
      raise exception 'sin sesión';
    end if;

    insert into scenarios (user_id, name, starting_balance, is_active, note)
    values (owner, new_name, coalesce(start_balance, 0), false, new_note)
    returning id into new_scen_id;
  else
    select copy_scenario(source_id, new_name) into new_scen_id;
    select user_id into owner from scenarios where id = new_scen_id;

    update scenarios
    set starting_balance = coalesce(start_balance, starting_balance),
        note = new_note
    where id = new_scen_id;

    -- Tu lado de la cuenta se reemplaza; el de las deudas se conserva.
    delete from incomes where scenario_id = new_scen_id;
    delete from expenses where scenario_id = new_scen_id and debt_id is null;
  end if;

  if coalesce(monthly_income, 0) > 0 then
    insert into incomes (user_id, scenario_id, description, amount, kind, eligible_months, period)
    values (owner, new_scen_id, 'Ingreso mensual', monthly_income, 'mensual', '{}', first_period);
  end if;

  if coalesce(monthly_fixed, 0) > 0 then
    insert into expenses (
      user_id, scenario_id, description, amount, period, is_recurring, paid_with
    )
    values (
      owner, new_scen_id, 'Gastos fijos', monthly_fixed, first_period, true, 'efectivo'
    );
  end if;

  return new_scen_id;
end;
$$;
