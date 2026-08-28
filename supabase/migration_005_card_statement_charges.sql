-- ============================================================
-- Migración 005 — detalle de consumos por resumen, para poder
-- categorizarlos en fijo/necesario vs. discrecional (spec §2.4).
--
-- Correr en el SQL Editor de Supabase después de migration_004.
--
-- Por qué hace falta: hasta ahora el parser de PDF solo guardaba
-- el TOTAL de consumos nuevos (card_statements.new_charges) — la
-- pantalla de "gastos por tarjeta" del spec necesita cada línea de
-- consumo por separado para poder categorizarla una por una y
-- mostrar cuánto de eso es realmente recortable (spec: "no asumir
-- que recortar gastos siempre alcanza").
-- ============================================================

create table if not exists card_statement_charges (
  id uuid primary key default gen_random_uuid(),
  debt_id uuid not null references debts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  period date not null, -- mismo período que el card_statement al que pertenece
  description text not null,
  amount numeric(14, 2) not null,
  category text not null default 'sin_categorizar'
    check (category in ('fijo_necesario', 'discrecional', 'sin_categorizar')),
  created_at timestamptz not null default now()
);

create index if not exists idx_card_statement_charges_debt_period
  on card_statement_charges(debt_id, period);

alter table card_statement_charges enable row level security;

drop policy if exists "own rows only" on card_statement_charges;
create policy "own rows only" on card_statement_charges for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
