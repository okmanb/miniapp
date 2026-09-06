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
  created_at timestamptz not null default now()
);

create index if not exists debt_payments_debt_idx on debt_payments (debt_id, period);
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
  usd_charges_excluded numeric(14, 2) not null default 0,
  source text not null default 'manual',
  warnings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (debt_id, period)
);

create index if not exists statements_debt_idx on card_statements (debt_id, period);

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
  annual_interest_rate numeric(8, 4),
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
  'gasto_no_capturado', 'vencimiento_hoy', 'tasa_mas_cara'
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
  unique (scenario_id, kind, subject_id)
);

alter table alert_dismissals enable row level security;

create policy "descartes propios" on alert_dismissals
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

  insert into scenarios (user_id, name, starting_balance, is_active)
  select user_id, new_name, starting_balance, false
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
      account_last4, is_active
    )
    values (
      old_debt.user_id, new_scen_id, old_debt.name, old_debt.kind,
      old_debt.base_balance, old_debt.base_balance_at,
      old_debt.annual_interest_rate, old_debt.tem, old_debt.credit_limit,
      old_debt.due_day, old_debt.closing_day, old_debt.installments_total,
      old_debt.installments_paid, old_debt.min_payment_formula,
      old_debt.account_last4, old_debt.is_active
    )
    returning id into copied_debt_id;

    insert into _debt_map (old_id, new_id) values (old_debt.id, copied_debt_id);
  end loop;

  insert into debt_payments (user_id, scenario_id, debt_id, period, paid_on, amount, kind, note)
  select p.user_id, new_scen_id, m.new_id, p.period, p.paid_on, p.amount, p.kind, p.note
  from debt_payments p join _debt_map m on m.old_id = p.debt_id
  where p.scenario_id = source_id;

  insert into debt_schedule_entries (user_id, scenario_id, debt_id, period, amount, kind, is_estimate, note)
  select e.user_id, new_scen_id, m.new_id, e.period, e.amount, e.kind, e.is_estimate, e.note
  from debt_schedule_entries e join _debt_map m on m.old_id = e.debt_id
  where e.scenario_id = source_id;

  insert into card_statements (
    user_id, scenario_id, debt_id, period, closing_date, due_date,
    previous_balance, interest_charged, new_charges, installments_charge,
    total_due, minimum_payment, amount_paid, usd_charges_excluded, source, warnings
  )
  select
    s.user_id, new_scen_id, m.new_id, s.period, s.closing_date, s.due_date,
    s.previous_balance, s.interest_charged, s.new_charges, s.installments_charge,
    s.total_due, s.minimum_payment, s.amount_paid, s.usd_charges_excluded, s.source, s.warnings
  from card_statements s join _debt_map m on m.old_id = s.debt_id
  where s.scenario_id = source_id;

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

  insert into bridge_loans (user_id, scenario_id, lender, amount, taken_period, repay_period, annual_interest_rate, note)
  select user_id, new_scen_id, lender, amount, taken_period, repay_period, annual_interest_rate, note
  from bridge_loans where scenario_id = source_id;

  return new_scen_id;
end;
$$;
