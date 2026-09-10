-- Monto original y estado de una deuda (pantalla 04).
--
-- Los dos están en el prototipo y se habían dejado afuera con el argumento de
-- que ningún cálculo los usaría. Se agregan igual: el prototipo es el diseño
-- terminado y la app es su implementación, así que un campo que él pide no se
-- descarta porque todavía no tenga consumidor.
--
-- Ninguno de los dos se deriva ni se puede derivar, que es lo que justifica
-- que se carguen a mano en una app donde ninguna cifra visible se escribe a
-- mano:
--
--   `original_amount` es lo que se debía cuando la deuda empezó. El modelo
--   solo conoce los pagos hechos DESDE que la app existe, así que el "22%
--   saldado" del dashboard es pagado/(pagado+saldo) y no cuenta lo que se
--   venía pagando antes. Es la única forma de que ese porcentaje diga la
--   verdad para una deuda que no arrancó acá.
--
--   `status` es al día o en mora, y la mora es un hecho del banco: la app
--   puede sospecharla mirando el vencimiento, pero no sabe si el pago entró.
--
-- Las dos son nullable o con default, así que las deudas existentes no
-- necesitan backfill: sin monto original el porcentaje se calcula como hasta
-- ahora, y sin estado se asume al día.

alter table debts
  add column if not exists original_amount numeric(14, 2),
  add column if not exists status text not null default 'al_dia'
    check (status in ('al_dia', 'en_mora'));

comment on column debts.original_amount is
  'Lo que se debía al empezar. Solo se carga a mano: la app únicamente conoce los pagos hechos desde que existe.';

comment on column debts.status is
  'al_dia | en_mora. Lo dice la persona, no la app: la mora depende de si el pago entró al banco.';

-- -----------------------------------------------------------------------------
-- copy_scenario tiene que arrastrar las dos columnas nuevas.
--
-- Si no, copiar un escenario perdería la mora y el monto original sin decir
-- nada, que es la clase de bug que aparece meses después. `create_scenario_from`
-- no hace falta tocarla: delega las deudas en esta.
--
-- El cuerpo es el de `schema.sql` con las dos columnas sumadas al INSERT de
-- `debts` y nada más. Se generó a partir del archivo, no a mano: copiar una
-- función de ochenta líneas de memoria es cómo se pierde una tabla.
-- -----------------------------------------------------------------------------

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
      monthly_payment, account_last4, is_active,
      original_amount, status
    )
    values (
      old_debt.user_id, new_scen_id, old_debt.name, old_debt.kind,
      old_debt.base_balance, old_debt.base_balance_at,
      old_debt.annual_interest_rate, old_debt.tem, old_debt.credit_limit,
      old_debt.due_day, old_debt.closing_day, old_debt.installments_total,
      old_debt.installments_paid, old_debt.min_payment_formula,
      old_debt.monthly_payment, old_debt.account_last4, old_debt.is_active,
      old_debt.original_amount, old_debt.status
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
