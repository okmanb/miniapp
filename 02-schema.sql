-- ============================================================
-- Simulador de Deudas y Flujo de Caja — esquema Supabase (Postgres)
-- Deriva directamente de 01-SPEC.md — cada tabla mapea a una entidad de ahí.
-- ============================================================

-- auth.users ya lo maneja Supabase Auth. Todo lo demás cuelga de auth.uid().

create type debt_type as enum ('tarjeta', 'prestamo', 'plan_cuotas', 'informal');
create type debt_status as enum ('al_dia', 'mora', 'refinanciado', 'cancelado', 'regularizado');
create type schedule_kind as enum ('cuota_fija', 'pago_variable', 'minimo_estimado', 'unico');
create type alert_type as enum (
  'saldo_creciente', 'doble_conteo', 'mes_no_reflejado',
  'gasto_no_capturado', 'vencimiento_hoy', 'tasa_mas_cara'
);
create type alert_severity as enum ('info', 'atencion', 'critico');

-- ------------------------------------------------------------
-- Escenarios: el mismo usuario puede tener "plan base" y "plan de contingencia" a la vez
-- ------------------------------------------------------------
create table scenarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  is_base boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Deudas
-- ------------------------------------------------------------
create table debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scenario_id uuid not null references scenarios(id) on delete cascade,
  name text not null,                    -- "Visa Signature ....6412"
  entity text not null,                  -- "BBVA", "Banco Patagonia", "MercadoPago", "Familiar"
  debt_type debt_type not null,
  status debt_status not null default 'al_dia',
  balance numeric(14,2) not null,
  tna numeric(6,4),                      -- tasa nominal anual, ej. 0.6944
  tea numeric(6,4),
  cft numeric(6,4),                      -- costo financiero total (con IVA si aplica)
  tem numeric(6,4),                      -- tasa efectiva mensual, si se conoce directo
  next_due_date date,
  min_payment_formula jsonb,             -- ver estructura sugerida más abajo
  source_note text,                      -- "captura de pantalla app BBVA, 10/08/2026"
  source_captured_at timestamptz,
  is_estimate boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column debts.min_payment_formula is
  'Ej: {"pct_1_pago": 0.10, "pct_saldo_financiado": 0.10, "pct_2_6_cuotas": 0.25,
        "pct_7_mas_cuotas": 0.50, "pct_adelantos": 1.0, "pct_interes_periodo": 1.0,
        "pct_minimo_impago": 1.0, "pct_exceso_limite": 1.0}';

-- ------------------------------------------------------------
-- Cronograma mes a mes de cada deuda (lo que realmente se paga cada mes)
-- ------------------------------------------------------------
create table debt_schedule_entries (
  id uuid primary key default gen_random_uuid(),
  debt_id uuid not null references debts(id) on delete cascade,
  month date not null,                   -- normalizado al día 1: '2026-09-01'
  amount numeric(14,2) not null,
  kind schedule_kind not null,
  is_estimate boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  unique (debt_id, month)
);

-- ------------------------------------------------------------
-- Ingresos
-- ------------------------------------------------------------
create table incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scenario_id uuid not null references scenarios(id) on delete cascade,
  name text not null,                    -- "Sueldo neto", "Adelanto de sueldo", "Bono", "Aguinaldo"
  kind text not null,                    -- 'sueldo' | 'adelanto' | 'bono' | 'aguinaldo' | 'changa' | 'otro'
  month date not null,
  amount numeric(14,2) not null,
  is_recurring boolean not null default false,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Gastos fijos (no ligados a una deuda puntual)
-- ------------------------------------------------------------
create table fixed_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scenario_id uuid not null references scenarios(id) on delete cascade,
  name text not null,                    -- "Colegio", "Supermercado", "Cuota fija a mi hija"
  month date not null,
  amount numeric(14,2) not null,
  paid_via_debt_id uuid references debts(id),   -- si este mes se cargó a una tarjeta en vez de cash
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Préstamos puente
-- ------------------------------------------------------------
create table bridge_loans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scenario_id uuid not null references scenarios(id) on delete cascade,
  source text not null,                  -- "MercadoPago", "Brubank"
  amount numeric(14,2) not null,
  received_month date not null,
  repay_month date not null,
  estimated_rate numeric(6,4),           -- TEM estimada para el período del préstamo
  repaid boolean not null default false,
  chained_from_id uuid references bridge_loans(id),  -- si este préstamo se pidió para pagar el anterior
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Snapshots calculados mes a mes (se regeneran, no se editan a mano)
-- ------------------------------------------------------------
create table cash_flow_months (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scenario_id uuid not null references scenarios(id) on delete cascade,
  month date not null,
  total_income numeric(14,2) not null,
  total_expense numeric(14,2) not null,
  net_result numeric(14,2) not null,
  cumulative_balance numeric(14,2) not null,
  is_actual boolean not null default false,   -- true si month <= hoy (dato real, no proyección)
  computed_at timestamptz not null default now(),
  unique (scenario_id, month)
);

-- ------------------------------------------------------------
-- Alertas
-- ------------------------------------------------------------
create table alerts (
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

-- ------------------------------------------------------------
-- Índices básicos
-- ------------------------------------------------------------
create index on debts (user_id, scenario_id);
create index on debt_schedule_entries (debt_id, month);
create index on incomes (user_id, scenario_id, month);
create index on fixed_expenses (user_id, scenario_id, month);
create index on cash_flow_months (user_id, scenario_id, month);
create index on alerts (user_id, resolved);

-- ------------------------------------------------------------
-- RLS (cada usuario ve solo lo suyo)
-- ------------------------------------------------------------
alter table scenarios enable row level security;
alter table debts enable row level security;
alter table debt_schedule_entries enable row level security;
alter table incomes enable row level security;
alter table fixed_expenses enable row level security;
alter table bridge_loans enable row level security;
alter table cash_flow_months enable row level security;
alter table alerts enable row level security;

create policy "own rows only" on scenarios for all using (auth.uid() = user_id);
create policy "own rows only" on debts for all using (auth.uid() = user_id);
create policy "own rows only" on incomes for all using (auth.uid() = user_id);
create policy "own rows only" on fixed_expenses for all using (auth.uid() = user_id);
create policy "own rows only" on bridge_loans for all using (auth.uid() = user_id);
create policy "own rows only" on cash_flow_months for all using (auth.uid() = user_id);
create policy "own rows only" on alerts for all using (auth.uid() = user_id);
create policy "own rows only via debt" on debt_schedule_entries for all
  using (exists (select 1 from debts d where d.id = debt_schedule_entries.debt_id and d.user_id = auth.uid()));
