-- -----------------------------------------------------------------------------
-- 005 · La cuota mensual de una deuda sin resumen.
--
-- Apareció al comparar la pantalla 04 con el prototipo, que tiene un campo
-- "PAGO MENSUAL ESTIMADO" que acá no existía. No era una diferencia de
-- formulario: era un agujero en el modelo.
--
-- La obligación mensual de una deuda salía del mínimo del último resumen. Una
-- tarjeta tiene resúmenes; un préstamo personal no. Resultado: los préstamos
-- entraban al flujo de caja y al plan destructor con cuota CERO, así que la
-- proyección los ignoraba por completo y el alcance del mes daba más holgado
-- de lo que es.
--
-- El orden de prioridad queda: la entry del plan para ese mes (un compromiso
-- cargado) > el mínimo del último resumen (lo que dice el banco) > esta cuota
-- (lo que la persona sabe que paga todos los meses).
-- -----------------------------------------------------------------------------

alter table debts add column if not exists monthly_payment numeric(14, 2);

comment on column debts.monthly_payment is
  'Cuota mensual de una deuda sin resumen (prestamos). Se usa como minimo cuando no hay statement ni entry del plan.';

-- copy_scenario tiene que arrastrar la columna nueva. Se re-crea entera porque
-- plpgsql no admite parches parciales; el cuerpo es el de la 003 con
-- monthly_payment agregado al INSERT de debts.

create or replace function copy_scenario(source_id uuid, new_name text)
returns uuid
language plpgsql
security invoker
-- Sin search_path fijo, quien pueda crear objetos en un esquema que caiga
-- antes en el search_path del que llama puede secuestrar las referencias a
-- tablas de acá adentro. pg_temp va al final y explícito porque la función
-- crea una tabla temporal.
set search_path = public, pg_temp
as $$
declare
  -- No se llama new_id: esa es tambien la columna de _debt_map, y plpgsql no
  -- sabria a cual se refieren los INSERT ... SELECT que usan las dos.
  new_scen_id uuid;
  owner uuid;
  old_debt debts%rowtype;
  copied_debt_id uuid;
begin
  select user_id into owner from scenarios where id = source_id;
  if owner is null then
    raise exception 'escenario inexistente o sin acceso';
  end if;

  insert into scenarios (user_id, name, starting_balance, is_active, note)
  select user_id, new_name, starting_balance, false, note
  from scenarios where id = source_id
  returning id into new_scen_id;

  -- Mapa de deudas viejas a nuevas: lo necesitan gastos y todo lo que cuelga
  -- de una deuda.
  create temp table _debt_map (old_id uuid primary key, new_id uuid) on commit drop;

  -- Fila por fila y no con un INSERT ... SELECT masivo: para emparejar la
  -- deuda vieja con la nueva hace falta una clave, y el nombre no lo es (dos
  -- tarjetas pueden llamarse igual, y ahí los gastos se irían a la tarjeta
  -- equivocada). Un escenario tiene decenas de deudas, no miles.
  for old_debt in select * from debts where scenario_id = source_id loop
    insert into debts (
      user_id, scenario_id, name, kind, base_balance, base_balance_at,
      annual_interest_rate, tem, credit_limit, due_day, closing_day,
      installments_total, installments_paid, min_payment_formula,
      monthly_payment, account_last4, is_active
    )
    values (
      old_debt.user_id, new_scen_id, old_debt.name, old_debt.kind,
      old_debt.base_balance, old_debt.base_balance_at,
      old_debt.annual_interest_rate, old_debt.tem, old_debt.credit_limit,
      old_debt.due_day, old_debt.closing_day, old_debt.installments_total,
      old_debt.installments_paid, old_debt.min_payment_formula,
      old_debt.monthly_payment, old_debt.account_last4, old_debt.is_active
    )
    returning id into copied_debt_id;

    insert into _debt_map (old_id, new_id) values (old_debt.id, copied_debt_id);
  end loop;

  insert into debt_payments (user_id, scenario_id, debt_id, period, paid_on, amount, kind, note)
  select p.user_id, new_scen_id, m.new_id, p.period, p.paid_on, p.amount, p.kind, p.note
  from debt_payments p join _debt_map m on m.old_id = p.debt_id
  where p.scenario_id = source_id;

  insert into debt_schedule_entries (user_id, scenario_id, debt_id, period, amount, kind, is_estimate, note)
  select e.user_id, new_scen_id, m.new_id, e.period, e.amount, e.kind, e.is_estimate, e.note
  from debt_schedule_entries e join _debt_map m on m.old_id = e.debt_id
  where e.scenario_id = source_id;

  insert into card_statements (
    user_id, scenario_id, debt_id, period, closing_date, due_date,
    previous_balance, interest_charged, new_charges, installments_charge,
    total_due, minimum_payment, amount_paid, usd_charges_excluded, source, warnings
  )
  select
    s.user_id, new_scen_id, m.new_id, s.period, s.closing_date, s.due_date,
    s.previous_balance, s.interest_charged, s.new_charges, s.installments_charge,
    s.total_due, s.minimum_payment, s.amount_paid, s.usd_charges_excluded, s.source, s.warnings
  from card_statements s join _debt_map m on m.old_id = s.debt_id
  where s.scenario_id = source_id;

  insert into card_installment_plans (
    user_id, scenario_id, debt_id, cupon, description, first_period,
    total_installments, installment_amount, tna, is_active
  )
  select
    c.user_id, new_scen_id, m.new_id, c.cupon, c.description, c.first_period,
    c.total_installments, c.installment_amount, c.tna, c.is_active
  from card_installment_plans c join _debt_map m on m.old_id = c.debt_id
  where c.scenario_id = source_id;

  -- El gasto de tarjeta sigue a su tarjeta copiada; el de efectivo lleva null.
  insert into expenses (
    user_id, scenario_id, description, amount, category, period,
    is_recurring, ended_period, is_archived, paid_with, debt_id
  )
  select
    e.user_id, new_scen_id, e.description, e.amount, e.category, e.period,
    e.is_recurring, e.ended_period, e.is_archived, e.paid_with, m.new_id
  from expenses e left join _debt_map m on m.old_id = e.debt_id
  where e.scenario_id = source_id;

  insert into incomes (user_id, scenario_id, description, amount, kind, eligible_months, period, ended_period)
  select user_id, new_scen_id, description, amount, kind, eligible_months, period, ended_period
  from incomes where scenario_id = source_id;

  -- Un puente simulado en el original sigue simulado en la copia: copiar un
  -- plan para probar variantes no es tomar la plata.
  insert into bridge_loans (
    user_id, scenario_id, lender, amount, taken_period, repay_period,
    monthly_interest_rate, is_taken, note
  )
  select
    user_id, new_scen_id, lender, amount, taken_period, repay_period,
    monthly_interest_rate, is_taken, note
  from bridge_loans where scenario_id = source_id;

  return new_scen_id;
end;
$$;
