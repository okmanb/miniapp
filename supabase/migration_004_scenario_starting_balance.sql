-- ============================================================
-- Migración 004 — saldo real de partida por escenario.
--
-- Correr en el SQL Editor de Supabase después de migration_003.
--
-- Por qué hace falta: el "ribbon de salud financiera" (spec §2.1 —
-- "¿en qué mes me quedo sin plata?", el gráfico que más se volvió a
-- mirar en la sesión real) necesita un punto de partida real para
-- encadenar el saldo acumulado mes a mes. Sin esto no hay forma de
-- distinguir "-$600K este mes" (el resultado del mes) de "cuánta
-- plata me queda en la cuenta" (lo acumulado).
-- Vive en scenarios y no en una tabla aparte porque es un dato de
-- partida por plan: al clonar un escenario (plan base -> plan de
-- contingencia) ambos arrancan del mismo saldo real, y de ahí en
-- más pueden divergir si el usuario decide simular un punto de
-- partida distinto en uno de los dos.
-- ============================================================

alter table scenarios add column if not exists starting_cash_balance numeric(14, 2) not null default 0;

comment on column scenarios.starting_cash_balance is
  'Saldo real en cuenta/efectivo al momento de cargarlo — el punto de partida desde el que se encadena el saldo acumulado proyectado mes a mes.';
