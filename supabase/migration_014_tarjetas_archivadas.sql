-- Las tarjetas archivadas se borran solas a los 7 dias.
--
-- Borrar una deuda en la app nunca borro nada: pone `is_active = false`, y la
-- razon estaba escrita en `archiveDebt` --"sus pagos y resumenes son historial
-- real"--. El problema es que ese historial **no se muestra en ningun lado**:
-- la pantalla de pagos filtra por `debts.is_active`, el tablero y el flujo
-- solo leen las activas. O sea que archivar guardaba datos que nadie podia
-- mirar nunca mas.
--
-- Y se acumulan rapido por un camino que no tiene nada de raro: volver a
-- cargar el resumen de una tarjeta como "tarjeta nueva" crea una fila nueva y
-- deja la anterior archivada. En una sola tarde quedaron siete, todas del
-- mismo periodo, todas versiones viejas de las tres que seguian vivas.
--
-- Asi que el archivado pasa a ser una papelera con fecha, que es lo que
-- siempre fue en los hechos. Siete dias es la ventana para arrepentirse; lo
-- que se borra se lleva en cascada sus resumenes, pagos y cuotas.
--
-- ## Por que hace falta una columna
--
-- `created_at` no sirve para medir la espera: dice cuando se creo la tarjeta,
-- no cuando se archivo. Una tarjeta de hace tres meses archivada hoy se
-- borraria en el acto. Por eso `archived_at`, y por eso lo pone un TRIGGER y
-- no la app: cualquier camino que apague `is_active` --el boton, una
-- correccion a mano, una copia de escenario-- tiene que marcarlo igual.
--
-- Volver a activarla lo limpia, que es lo que hace falta para que
-- desarchivar, si alguna vez existe, no deje una fecha de ejecucion colgada.
--
-- ## Los 7 dias estan en dos lados
--
-- Aca y en el texto de la pantalla que archiva ("se borra del todo a los 7
-- dias", en `DebtActionsSheet`). Si cambia uno, cambia el otro.

alter table debts add column if not exists archived_at timestamptz;

comment on column debts.archived_at is
  'Cuando se archivo (is_active paso a false). Lo pone el trigger, no la app. A los 7 dias la borra borrar_tarjetas_archivadas().';

create or replace function public.marcar_archivada()
returns trigger
language plpgsql
as $$
begin
  if new.is_active = false and (tg_op = 'INSERT' or old.is_active = true) then
    new.archived_at = now();
  elsif new.is_active = true then
    new.archived_at = null;
  end if;
  return new;
end;
$$;

drop trigger if exists debts_marcar_archivada on debts;

create trigger debts_marcar_archivada
  before insert or update of is_active on debts
  for each row execute function public.marcar_archivada();

-- Las que ya estaban archivadas (si quedara alguna) arrancan el reloj hoy.
update debts set archived_at = now() where is_active = false and archived_at is null;

create or replace function public.borrar_tarjetas_archivadas()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare borradas integer;
begin
  delete from public.debts
  where is_active = false
    and archived_at is not null
    and archived_at < now() - interval '7 days';

  get diagnostics borradas = row_count;
  return borradas;
end;
$$;

comment on function public.borrar_tarjetas_archivadas is
  'Borra de verdad las deudas archivadas hace mas de 7 dias, con sus resumenes, pagos y cuotas en cascada. Los 7 dias estan tambien en el texto de la pantalla que archiva: si cambia uno, cambia el otro.';

revoke all on function public.borrar_tarjetas_archivadas() from public, anon, authenticated;

-- Una vez por dia alcanza para una ventana de siete: 4:23 UTC, de madrugada aca.
select cron.schedule(
  'borrar-tarjetas-archivadas',
  '23 4 * * *',
  $$select public.borrar_tarjetas_archivadas()$$
);
