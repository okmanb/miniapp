-- -----------------------------------------------------------------------------
-- 004 · Crear un escenario a partir de otro, en una sola operación.
--
-- La pantalla de escenarios ofrece "arrancar copiando las deudas de …" y, al
-- lado, tu ingreso y tu gasto fijo. La frase del prototipo dice exactamente
-- qué copia y qué no: "las deudas del mes las toma del plan que copiás; acá
-- cambiás tu lado de la cuenta".
--
-- Eso es copy_scenario con dos diferencias: los ingresos y los gastos en
-- efectivo del original NO viajan (son el lado que se está reemplazando), y
-- los gastos de tarjeta SÍ, porque son parte del saldo de su tarjeta y sacarlos
-- dejaría deudas con un saldo que no coincide con el original.
--
-- Va como función de base y no como cinco pasos en el servidor por lo mismo que
-- copy_scenario: tiene que ser atómica. Un escenario copiado a medias —con las
-- deudas del original y también con sus ingresos— es peor que no copiarlo,
-- porque parece completo y proyecta el doble de plata entrando.
-- -----------------------------------------------------------------------------

create or replace function create_scenario_from(
  source_id uuid,
  new_name text,
  new_note text,
  start_balance numeric,
  monthly_income numeric,
  monthly_fixed numeric
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  new_scen_id uuid;
  owner uuid;
  first_period text := to_char(now(), 'YYYY-MM');
begin
  if source_id is null then
    select auth.uid() into owner;
    if owner is null then
      raise exception 'sin sesión';
    end if;

    insert into scenarios (user_id, name, starting_balance, is_active, note)
    values (owner, new_name, coalesce(start_balance, 0), false, new_note)
    returning id into new_scen_id;
  else
    select copy_scenario(source_id, new_name) into new_scen_id;
    select user_id into owner from scenarios where id = new_scen_id;

    update scenarios
    set starting_balance = coalesce(start_balance, starting_balance),
        note = new_note
    where id = new_scen_id;

    -- Tu lado de la cuenta se reemplaza; el de las deudas se conserva.
    delete from incomes where scenario_id = new_scen_id;
    delete from expenses where scenario_id = new_scen_id and debt_id is null;
  end if;

  if coalesce(monthly_income, 0) > 0 then
    insert into incomes (user_id, scenario_id, description, amount, kind, eligible_months, period)
    values (owner, new_scen_id, 'Ingreso mensual', monthly_income, 'mensual', '{}', first_period);
  end if;

  if coalesce(monthly_fixed, 0) > 0 then
    insert into expenses (
      user_id, scenario_id, description, amount, period, is_recurring, paid_with
    )
    values (
      owner, new_scen_id, 'Gastos fijos', monthly_fixed, first_period, true, 'efectivo'
    );
  end if;

  return new_scen_id;
end;
$$;
