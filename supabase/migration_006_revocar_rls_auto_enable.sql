-- -----------------------------------------------------------------------------
-- 006 · Sacarle el EXECUTE público a rls_auto_enable().
--
-- Lo marcó el linter de Supabase: una función SECURITY DEFINER ejecutable por
-- `anon` a través de /rest/v1/rpc.
--
-- La función NO es nuestra: es un guardarraíl de la plataforma que prende RLS
-- sola en cada tabla nueva del esquema public. Por eso no está en schema.sql.
-- Tampoco es explotable — es una función de event trigger, y llamarla por RPC
-- falla porque pg_event_trigger_ddl_commands() solo corre dentro de un event
-- trigger. Pero estar expuesta no le sirve a nadie, así que se cierra.
--
-- Un event trigger se dispara por cuenta del sistema, no por un GRANT de rol,
-- así que revocarlo no lo apaga. Verificado creando una tabla de prueba después
-- de correr esto: siguió quedando con RLS activa.
-- -----------------------------------------------------------------------------

revoke execute on function public.rls_auto_enable() from public;
revoke execute on function public.rls_auto_enable() from anon;
revoke execute on function public.rls_auto_enable() from authenticated;
