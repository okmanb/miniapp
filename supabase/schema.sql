-- Correr esto en el SQL Editor de tu proyecto de Supabase.
-- Tablas mínimas para que cualquier mini app de la fábrica arranque.

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('stripe', 'mercadopago')),
  external_id text not null unique,
  status text not null default 'incomplete',
  plan text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_subscriptions_user_id on subscriptions(user_id);

-- Idempotencia de webhooks: sin esto, un reintento de Stripe/MP
-- puede procesar el mismo evento dos veces.
create table if not exists webhook_events (
  id text primary key,
  provider text not null,
  type text not null,
  received_at timestamptz not null default now()
);

-- webhook_events es de uso interno (solo la toca el webhook backend
-- con la service_role key, que siempre se salta RLS). Activamos RLS
-- sin policies para que nadie más pueda leerla vía la API pública.
alter table webhook_events enable row level security;

-- Row Level Security: cada usuario solo ve su propia suscripción.
alter table subscriptions enable row level security;

drop policy if exists "Users can view their own subscription" on subscriptions;

create policy "Users can view their own subscription"
  on subscriptions for select
  using (auth.uid() = user_id);

-- ============================================================
-- Simulador de deuda y cash flow
-- ============================================================

-- Una fila por deuda del usuario. debt_type determina cómo se
-- calcula la proyección de cuotas (ver lib/debt-engine).
create table if not exists debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, -- ej: "Tarjeta Visa BBVA", "Préstamo Plan V"
  debt_type text not null check (
    debt_type in ('credit_card', 'personal_loan', 'plan_v', 'mortgage', 'prendario')
  ),

  -- Monto original y saldo actual
  original_amount numeric(14, 2) not null,
  current_balance numeric(14, 2) not null,
  currency text not null default 'ARS',

  -- Tasa: fija, ajustable por UVA/inflación, o variable (el banco
  -- la puede cambiar periódicamente — ni fija ni indexada por
  -- inflación, hay que actualizarla a mano cuando avisan un cambio).
  rate_type text not null default 'fixed' check (rate_type in ('fixed', 'uva', 'variable')),
  annual_interest_rate numeric(6, 3), -- ej: 65.5 (%), null si es UVA puro

  -- Plan de pagos
  installments_total integer, -- null para tarjetas (revolving, sin plazo fijo)
  installments_paid integer not null default 0,
  monthly_payment numeric(14, 2), -- cuota estimada actual

  due_day integer check (due_day between 1 and 31), -- día del mes de vencimiento
  start_date date,
  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Si la tabla debts ya existía de antes (con rate_type limitado a
-- 'fixed'/'uva'), ampliamos el constraint para permitir 'variable'.
alter table debts drop constraint if exists debts_rate_type_check;
alter table debts add constraint debts_rate_type_check check (rate_type in ('fixed', 'uva', 'variable'));

create index if not exists idx_debts_user_id on debts(user_id);

-- Pagos reales que el usuario va cargando, para comparar contra
-- lo proyectado y detectar desvíos.
create table if not exists debt_payments (
  id uuid primary key default gen_random_uuid(),
  debt_id uuid not null references debts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(14, 2) not null,
  payment_date date not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_debt_payments_debt_id on debt_payments(debt_id);

-- Cache de tasas del BCRA (UVA, inflación, tasa de referencia) para
-- no pegarle a la API en cada carga de página. Se refresca por job
-- o al pedirla si está vencida (ver lib/bcra).
create table if not exists bcra_rates_cache (
  id text primary key, -- ej: 'uva', 'inflacion_mensual', 'tasa_referencia'
  value numeric(14, 6) not null,
  as_of_date date not null,
  fetched_at timestamptz not null default now()
);

alter table debts enable row level security;
alter table debt_payments enable row level security;
alter table bcra_rates_cache enable row level security;

drop policy if exists "Users can manage their own debts" on debts;
create policy "Users can manage their own debts"
  on debts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can manage their own debt payments" on debt_payments;
create policy "Users can manage their own debt payments"
  on debt_payments for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- bcra_rates_cache es data pública de mercado, cualquier usuario
-- autenticado la puede leer; solo el backend (service_role) escribe.
drop policy if exists "Authenticated users can read BCRA rates" on bcra_rates_cache;
create policy "Authenticated users can read BCRA rates"
  on bcra_rates_cache for select
  using (auth.role() = 'authenticated');

-- ============================================================
-- Ingresos y gastos fijos — para cruzar contra el cash flow de
-- deudas y saber el neto disponible real cada mes.
-- ============================================================

create table if not exists income_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, -- ej: "Sueldo Citi", "Freelance"
  monthly_amount numeric(14, 2) not null, -- neto de bolsillo, mensual

  -- Aguinaldo/SAC: en Argentina se cobra un extra en junio y
  -- diciembre, típicamente la mitad del mejor sueldo del semestre.
  -- Si includes_sac es true y no se especifica sac_amount, se
  -- estima como monthly_amount / 2.
  includes_sac boolean not null default false,
  sac_amount numeric(14, 2), -- null = estimar como monthly_amount/2

  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, -- ej: "Alquiler", "Servicios", "Supermercado"
  monthly_amount numeric(14, 2) not null,
  category text, -- opcional, libre: "vivienda", "servicios", "comida", etc.
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_income_sources_user_id on income_sources(user_id);
create index if not exists idx_expenses_user_id on expenses(user_id);

alter table income_sources enable row level security;
alter table expenses enable row level security;

drop policy if exists "Users can manage their own income" on income_sources;
create policy "Users can manage their own income"
  on income_sources for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can manage their own expenses" on expenses;
create policy "Users can manage their own expenses"
  on expenses for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- Tarjetas de crédito de uso activo: resúmenes mensuales y
-- compras en cuotas (Plan V u otro financiamiento).
--
-- Modelo: cada compra grande financiada vive en
-- card_installment_plans con sus cuotas restantes. Cada resumen
-- mensual (card_statements) registra consumos nuevos NO
-- financiados, el interés punitorio sobre lo que quedó impago del
-- mes anterior, y cuánto pagaste. El saldo real de la tarjeta
-- (debts.current_balance) se recalcula automáticamente cada vez
-- que cargás un resumen nuevo — ver lib/card-statements.
-- ============================================================

create table if not exists card_installment_plans (
  id uuid primary key default gen_random_uuid(),
  debt_id uuid not null references debts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null, -- ej: "Notebook en 12 cuotas"
  total_installments integer not null check (total_installments > 0),
  installment_amount numeric(14, 2) not null,
  first_period date not null, -- primer mes en que aparece la cuota (día 1 del mes)
  is_active boolean not null default true,
  -- Número de cupón del resumen (si vino de una lectura automática
  -- de PDF) — sirve para no duplicar el mismo plan si el usuario
  -- sube el resumen del mes siguiente y el plan sigue apareciendo.
  source_cupon text,
  created_at timestamptz not null default now()
);

-- Si la tabla ya existía de antes (versión previa de este schema),
-- esto agrega la columna nueva sin romper nada.
alter table card_installment_plans add column if not exists source_cupon text;

create table if not exists card_statements (
  id uuid primary key default gen_random_uuid(),
  debt_id uuid not null references debts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  period date not null, -- día 1 del mes que representa este resumen

  previous_balance numeric(14, 2) not null default 0, -- lo que quedó impago del resumen anterior
  interest_charged numeric(14, 2) not null default 0, -- interés punitorio sobre previous_balance
  new_charges numeric(14, 2) not null default 0, -- consumos nuevos NO financiados en cuotas
  installments_charge numeric(14, 2) not null default 0, -- suma de cuotas activas que vencen este período
  total_due numeric(14, 2) not null, -- previous_balance + interest_charged + new_charges + installments_charge

  minimum_payment numeric(14, 2),
  amount_paid numeric(14, 2) not null default 0,
  due_date date,

  created_at timestamptz not null default now(),
  unique (debt_id, period)
);

create index if not exists idx_card_installment_plans_debt_id on card_installment_plans(debt_id);
create index if not exists idx_card_statements_debt_id on card_statements(debt_id);

alter table card_installment_plans enable row level security;
alter table card_statements enable row level security;

drop policy if exists "Users can manage their own installment plans" on card_installment_plans;
create policy "Users can manage their own installment plans"
  on card_installment_plans for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can manage their own card statements" on card_statements;
create policy "Users can manage their own card statements"
  on card_statements for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
