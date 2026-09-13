-- Borrar la cuenta, no solo los datos.
--
-- Ajustes ya tenia "Borrar todos mis datos", que borra los escenarios en
-- cascada y deja la cuenta abierta y vacia. Faltaba la otra mitad, y se noto
-- al escribir la politica de privacidad: la pagina tenia que decir "escribinos
-- un mail y te damos de baja", que es pedirle a alguien que confie en que
-- alguien mas se acuerde.
--
-- ## Por que una funcion en la base y no la API de admin
--
-- Borrar un usuario de `auth.users` desde la app necesitaria la service role
-- key, que ni siquiera esta en el entorno local y que --si se filtra-- da
-- acceso a TODO salteando RLS. Una funcion `security definer` hace lo mismo
-- sin repartir esa llave: corre con los permisos del dueño, pero borra
-- exactamente una fila, la de `auth.uid()`.
--
-- Ese filtro es toda la seguridad del asunto: no hay parametro, no hay forma
-- de pedirle que borre a otro. Por eso tampoco recibe argumentos.
--
-- El resto se va solo: las once tablas apuntan a auth.users con
-- `on delete cascade`, igual que cuando el cron borra una cuenta de prueba.

create or replace function public.borrar_mi_cuenta()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare quien uuid := auth.uid();
begin
  if quien is null then
    raise exception 'No hay sesion: no hay cuenta que borrar.' using errcode = '28000';
  end if;

  -- Una sola fila, y siempre la de quien llama.
  delete from auth.users where id = quien;
end;
$$;

comment on function public.borrar_mi_cuenta is
  'Borra la cuenta de quien la llama y, en cascada, todo lo suyo. Security definer porque auth.users no es de nadie mas que del admin; el filtro por auth.uid() es lo que hace que nadie pueda borrar a otro.';

revoke all on function public.borrar_mi_cuenta() from public, anon;
grant execute on function public.borrar_mi_cuenta() to authenticated;
