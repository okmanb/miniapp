-- ============================================================
-- Migración 006 — tabla puente para la revisión de un resumen
-- recién subido, en vez de pasar el JSON parseado entero por la
-- URL (?data=...).
--
-- Correr en el SQL Editor de Supabase después de migration_005.
--
-- Por qué hace falta: con un resumen real (varias líneas de
-- consumo + varios cupones de Plan V/Cuotificación), el JSON
-- parseado sumado a las cookies de sesión de Supabase supera el
-- límite de tamaño de headers que acepta el servidor — el
-- navegador corta la petición con 431 "Request Header Fields Too
-- Large" sin mostrar ningún error visible, así que el botón
-- "Crear tarjeta y guardar resumen" parecía no hacer nada.
--
-- La pantalla de subida ahora guarda el JSON acá y pasa solo el
-- id (un uuid corto) por la URL; la pantalla de revisión lo lee
-- de vuelta de la tabla, y la fila se borra apenas se confirma o
-- se descarta.
-- ============================================================

create table if not exists pending_statement_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now()
);

alter table pending_statement_imports enable row level security;

drop policy if exists "own rows only" on pending_statement_imports;
create policy "own rows only" on pending_statement_imports for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
