-- Las cuentas de prueba viven 24 horas y se borran solas.
--
-- Probar sin cuenta dejo de ser una pantalla suelta: el tablero de la prueba
-- es el tablero de verdad, con una sesion anonima de Supabase detras. Esa
-- cuenta es igual a cualquier otra --su propio auth.uid(), sus propias filas,
-- las mismas politicas de RLS-- con una sola diferencia: no tiene mail, asi
-- que nadie puede volver a abrirla. Ni siquiera nosotros.
--
-- Por eso no puede quedarse para siempre. Supabase no tiene limpieza
-- automatica de usuarios anonimos ("Automatic cleanup of anonymous users is
-- currently not available", dice su documentacion), asi que la hace pg_cron
-- una vez por hora.
--
-- Guardar la cuenta es colgarle un mail: ahi deja de ser anonima y esto no la
-- mira nunca mas. No hay que mover una sola fila, porque el usuario es el
-- mismo.
--
-- ## Las 24 horas estan en dos lados
--
-- Aca y en `lib/auth/prueba.ts`, que es lo que dice el cartel de todas las
-- pantallas privadas. No hay forma de que uno lea al otro --esto es SQL en la
-- base, aquello TypeScript en el servidor-- asi que si cambia, cambian los
-- dos. Un cartel que promete 24 horas sobre un cron que borra a las 12 es peor
-- que no tener cartel.
--
-- ## Por que una funcion y no el DELETE suelto en el cron
--
-- Para que quede nombrada, comentada y con el motivo adentro de la base. El
-- `cron.schedule` se lee en una tabla del sistema donde nadie va a encontrar
-- una explicacion; `\df+ borrar_cuentas_de_prueba` la trae. Ademas devuelve
-- cuantas borro, que es lo unico que se puede mirar despues.
--
-- Todo lo que la cuenta haya cargado se va con ella: las once tablas apuntan a
-- auth.users con `on delete cascade`, verificado contra la base.

create extension if not exists pg_cron;

create or replace function public.borrar_cuentas_de_prueba()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare borradas integer;
begin
  delete from auth.users
  where is_anonymous is true
    and created_at < now() - interval '24 hours';

  get diagnostics borradas = row_count;
  return borradas;
end;
$$;

comment on function public.borrar_cuentas_de_prueba is
  'Borra las cuentas de prueba (anonimas) de mas de 24 horas. Todo lo que cargaron se va en cascada por las FK a auth.users. Guardar la cuenta le cuelga un mail, deja de ser anonima y esto no la toca. Las 24 horas estan tambien en lib/auth/prueba.ts: si cambia una, cambia la otra.';

-- Nadie la llama desde la app: es del cron y de una consola.
revoke all on function public.borrar_cuentas_de_prueba() from public, anon, authenticated;

-- En el minuto 7 y no en el 0: la hora en punto es cuando corre todo lo demas.
select cron.schedule(
  'borrar-cuentas-de-prueba',
  '7 * * * *',
  $$select public.borrar_cuentas_de_prueba()$$
);
