-- ============================================================
-- Migración 002 — Escenarios, cronograma mes-a-mes, préstamos
-- puente, cash flow persistido y alertas.
--
-- Correr esto en el SQL Editor de Supabase DESPUÉS de
-- supabase/schema.sql. Es aditiva a propósito: no borra ni
-- renombra ninguna tabla/columna existente, así la app actual
-- (que todavía no sabe de scenario_id) sigue funcionando mientras
-- migramos el código en paralelo.
--
-- Deprecadas pero NO borradas en esta migración (se dan de baja
-- en una migración posterior, una vez que el código deje de
-- escribirlas y los datos reales estén recargados vía el importador
-- de PDF ya corregido — ver 00-BRIEF, paso 3):
--   - card_installment_plans, card_statements -> lo reemplaza
--     debt_schedule_entries (cada compra Plan V pasa a ser su
--     propia deuda hija, ver debts.parent_debt_id más abajo).
--   - income_sources -> lo reemplaza incomes (ya migrado abajo).
--   - expenses -> lo reemplaza fixed_expenses (ya migrado abajo).
--   - debt_payments -> lo reemplaza debt_schedule_entries.is_estimate
--     = false (un pago confirmado ES la entry del mes, no un
--     registro aparte — evita tener dos fuentes de verdad para el
--     mismo hecho).
-- bcra_rates_cache se mantiene tal cual, sin cambios: es caché de
-- tasas de mercado, no depende de escenario ni de usuario.
-- ============================================================

-- uuid_generate_v5 / uuid_ns_url (usados más abajo para generar un
-- id determinístico del escenario base por usuario) vienen de esta
-- extensión — gen_random_uuid() ya estaba disponible (pgcrypto),
-- pero esta no, así que Supabase no la tiene prendida por defecto.
create extension if not exists "uuid-ossp";

-- ------------------------------------------------------------
-- Tipos nuevos (guardados en DO blocks porque Postgres no soporta
-- "CREATE TYPE IF NOT EXISTS")
-- ------------------------------------------------------------
do $$ begin
  create type debt_status as enum ('al_dia', 'mora', 'refinanciado', 'cancelado', 'regularizado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type schedule_kind as enum ('cuota_fija', 'pago_variable', 'minimo_estimado', 'unico');
exception when duplicate_object then null; end $$;

do $$ begin
  create type alert_type as enum (
    'saldo_creciente', 'doble_conteo', 'mes_no_reflejado',
    'gasto_no_capturado', 'vencimiento_hoy', 'tasa_mas_cara'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type alert_severity as enum ('info', 'atencion', 'critico');
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------
-- Escenarios: el mismo usuario puede tener "plan base" y "plan de
-- contingencia" a la vez, sin pisarse.
-- ------------------------------------------------------------
create table if not exists scenarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  is_base boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_scenarios_user_id on scenarios(user_id);

alter table scenarios enable row level security;
drop policy if exists "own rows only" on scenarios;
create policy "own rows only" on scenarios for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Backfill: un escenario "Plan base" por cada usuario que ya tiene
-- datos cargados (deudas, ingresos o gastos), para que tengan dónde
-- colgar sus filas existentes una vez que el código empiece a pedir
-- scenario_id. Usa un id determinístico por usuario (no
-- gen_random_uuid) para que correr esta migración dos veces no
-- duplique el escenario base.
insert into scenarios (id, user_id, name, is_base)
select
  uuid_generate_v5(uuid_ns_url(), 'base-scenario:' || u.user_id::text),
  u.user_id,
  'Plan base',
  true
from (
  select user_id from debts
  union
  select user_id from income_sources
  union
  select user_id from expenses
) u
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- Deudas: ampliamos la tabla existente en vez de recrearla.
-- ------------------------------------------------------------

-- Nullable por ahora a propósito: el código de la app todavía no
-- setea scenario_id al insertar, y esta tabla ya tiene datos reales
-- de usuarios en producción. Se pasa a NOT NULL en una migración
-- posterior, una vez que app/dashboard/debts/** quede actualizado
-- para pedir/pasar siempre un escenario.
alter table debts add column if not exists scenario_id uuid references scenarios(id) on delete cascade;

update debts d
set scenario_id = uuid_generate_v5(uuid_ns_url(), 'base-scenario:' || d.user_id::text)
where d.scenario_id is null;

alter table debts add column if not exists entity text;
alter table debts add column if not exists status debt_status not null default 'al_dia';
alter table debts add column if not exists tea numeric(6, 4);
alter table debts add column if not exists cft numeric(6, 4);
alter table debts add column if not exists tem numeric(6, 4);
alter table debts add column if not exists next_due_date date;
alter table debts add column if not exists min_payment_formula jsonb;
alter table debts add column if not exists source_note text;
alter table debts add column if not exists source_captured_at timestamptz;
alter table debts add column if not exists is_estimate boolean not null default false;

-- Deudas hermanas agrupadas bajo una tarjeta madre (ej: cada compra
-- Plan V es su propia deuda con debt_type = 'plan_v', enlazada a la
-- tarjeta que la financia). Se usa para agrupar visualmente en el
-- dashboard sin inventar una entidad nueva de "producto financiero".
alter table debts add column if not exists parent_debt_id uuid references debts(id) on delete set null;

comment on column debts.min_payment_formula is
  'Fórmula de pago mínimo configurable por tarjeta. Ej:
   {"pct_1_pago": 0.10, "pct_saldo_financiado": 0.10, "pct_2_6_cuotas": 0.25,
    "pct_7_mas_cuotas": 0.50, "pct_adelantos": 1.0, "pct_interes_periodo": 1.0,
    "pct_minimo_impago": 1.0, "pct_exceso_limite": 1.0}
   Ver lib/debt-engine para el default razonable si la tarjeta no trae la propia.';

comment on column debts.parent_debt_id is
  'Si esta deuda es una compra financiada (Plan V u otro) que se paga
   A TRAVÉS de otra tarjeta, apunta a la deuda de la tarjeta madre.
   Null si es una deuda independiente.';

-- 'informal' (deuda con un familiar, sin producto bancario detrás)
-- no estaba contemplado en el constraint original.
alter table debts drop constraint if exists debts_debt_type_check;
alter table debts add constraint debts_debt_type_check check (
  debt_type in ('credit_card', 'personal_loan', 'plan_v', 'mortgage', 'prendario', 'informal')
);

create index if not exists idx_debts_scenario_id on debts(scenario_id);
create index if not exists idx_debts_parent_debt_id on debts(parent_debt_id);

-- ------------------------------------------------------------
-- Cronograma mes a mes: qué se paga CADA MES por cada deuda, y de
-- qué tipo es ese pago. Esto reemplaza el supuesto de "monthly_payment
-- fijo para siempre" — el corazón del problema #1 del brief.
-- ------------------------------------------------------------
create table if not exists debt_schedule_entries (
  id uuid primary key default gen_random_uuid(),
  debt_id uuid not null references debts(id) on delete cascade,
  month date not null,                   -- normalizado al día 1: '2026-09-01'
  amount numeric(14, 2) not null,
  kind schedule_kind not null,
  is_estimate boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  unique (debt_id, month)
);

create index if not exists idx_debt_schedule_entries_debt_month on debt_schedule_entries(debt_id, month);

alter table debt_schedule_entries enable row level security;
drop policy if exists "own rows only via debt" on debt_schedule_entries;
create policy "own rows only via debt" on debt_schedule_entries for all
  using (exists (select 1 from debts d where d.id = debt_schedule_entries.debt_id and d.user_id = auth.uid()))
  with check (exists (select 1 from debts d where d.id = debt_schedule_entries.debt_id and d.user_id = auth.uid()));

-- ------------------------------------------------------------
-- Ingresos: reemplaza income_sources. Clave: el split entre
-- "sueldo" y "adelanto" puede cambiar de un mes a otro sin que
-- cambie el total real (spec §1, nos pasó el 26/08 con $2M -> $2.5M
-- de adelanto).
-- ------------------------------------------------------------
create table if not exists incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scenario_id uuid not null references scenarios(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('sueldo', 'adelanto', 'bono', 'aguinaldo', 'changa', 'otro')),
  month date not null,
  amount numeric(14, 2) not null,
  is_recurring boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_incomes_user_scenario_month on incomes(user_id, scenario_id, month);

alter table incomes enable row level security;
drop policy if exists "own rows only" on incomes;
create policy "own rows only" on incomes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Backfill best-effort desde income_sources: una fila "vigente
-- desde hoy" por cada fuente activa. No reconstruye historial
-- mensual (income_sources nunca lo tuvo) — es sólo para no perder
-- lo que ya estaba cargado mientras se recarga a mano el detalle
-- real del punto #3 del brief.
insert into incomes (user_id, scenario_id, name, kind, month, amount, is_recurring)
select
  s.user_id,
  s.id,
  src.name,
  'sueldo',
  date_trunc('month', now())::date,
  src.monthly_amount,
  true
from income_sources src
join scenarios s on s.user_id = src.user_id and s.is_base
where src.is_active
on conflict do nothing;

-- ------------------------------------------------------------
-- Gastos fijos: reemplaza expenses. Suma dimensión de mes (para
-- atrasos partidos en cuotas) y paid_via_debt_id (para gastos que
-- "se mudan" de una tarjeta deshabilitada a otra).
-- ------------------------------------------------------------
create table if not exists fixed_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scenario_id uuid not null references scenarios(id) on delete cascade,
  name text not null,
  month date not null,
  amount numeric(14, 2) not null,
  paid_via_debt_id uuid references debts(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_fixed_expenses_user_scenario_month on fixed_expenses(user_id, scenario_id, month);

alter table fixed_expenses enable row level security;
drop policy if exists "own rows only" on fixed_expenses;
create policy "own rows only" on fixed_expenses for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into fixed_expenses (user_id, scenario_id, name, month, amount)
select
  s.user_id,
  s.id,
  exp.name,
  date_trunc('month', now())::date,
  exp.monthly_amount
from expenses exp
join scenarios s on s.user_id = exp.user_id and s.is_base
where exp.is_active
on conflict do nothing;

-- ------------------------------------------------------------
-- Préstamos puente, encadenables (tomo uno para devolver el
-- anterior).
-- ------------------------------------------------------------
create table if not exists bridge_loans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scenario_id uuid not null references scenarios(id) on delete cascade,
  source text not null,
  amount numeric(14, 2) not null,
  received_month date not null,
  repay_month date not null,
  estimated_rate numeric(6, 4),
  repaid boolean not null default false,
  chained_from_id uuid references bridge_loans(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_bridge_loans_user_scenario on bridge_loans(user_id, scenario_id);

alter table bridge_loans enable row level security;
drop policy if exists "own rows only" on bridge_loans;
create policy "own rows only" on bridge_loans for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- Snapshots de cash flow, calculados y persistidos (no editables a
-- mano). is_actual distingue saldo real (mes <= hoy) de proyección
-- (mes > hoy) — la regla de integridad más importante del spec
-- (§4.1): nunca sumar el resultado proyectado de un mes que ya tiene
-- saldo real cargado.
-- ------------------------------------------------------------
create table if not exists cash_flow_months (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scenario_id uuid not null references scenarios(id) on delete cascade,
  month date not null,
  total_income numeric(14, 2) not null,
  total_expense numeric(14, 2) not null,
  net_result numeric(14, 2) not null,
  cumulative_balance numeric(14, 2) not null,
  is_actual boolean not null default false,
  computed_at timestamptz not null default now(),
  unique (scenario_id, month)
);

create index if not exists idx_cash_flow_months_user_scenario_month on cash_flow_months(user_id, scenario_id, month);

alter table cash_flow_months enable row level security;
drop policy if exists "own rows only" on cash_flow_months;
create policy "own rows only" on cash_flow_months for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- Alertas.
-- ------------------------------------------------------------
create table if not exists alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scenario_id uuid references scenarios(id) on delete cascade,
  debt_id uuid references debts(id) on delete cascade,
  alert_type alert_type not null,
  severity alert_severity not null default 'atencion',
  message text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_alerts_user_resolved on alerts(user_id, resolved);

alter table alerts enable row level security;
drop policy if exists "own rows only" on alerts;
create policy "own rows only" on alerts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
