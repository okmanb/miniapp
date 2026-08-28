-- ============================================================
-- Migración 003 — is_recurring en fixed_expenses.
--
-- Correr en el SQL Editor de Supabase después de migration_002.
--
-- Por qué hace falta: fixed_expenses ya soporta cargar una fila por
-- mes (spec §1, atrasos que se parten en cuotas — ej. $404K se
-- partió en $202K en agosto + $202K en septiembre). Pero sin una
-- forma de distinguir "este monto vale SOLO este mes" de "este
-- monto vale desde este mes EN ADELANTE" (colegio, súper — genuinos
-- gastos fijos que no cambian), la proyección no puede saber si
-- debe repetir el monto hacia los meses futuros o no. incomes ya
-- tenía esta misma distinción (is_recurring) — esto la agrega acá
-- para que ambas tablas se proyecten con la misma lógica.
-- ============================================================

alter table fixed_expenses add column if not exists is_recurring boolean not null default true;

comment on column fixed_expenses.is_recurring is
  'true (default): este monto sigue vigente hacia los meses siguientes hasta que aparezca otra fila del mismo nombre. false: vale SOLO para este mes puntual (ej. una de las dos cuotas de un atraso partido).';
