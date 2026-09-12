-- Lo que el resumen cobra y el modelo no tenia donde guardar.
--
-- Se reconstruyeron seis resumenes reales de dos bancos, linea por linea, y
-- los seis cierran EXACTO con la misma estructura:
--
--   cierre = anterior - pagos - creditos + transferencia de dolares
--            + consumos + intereses + impuestos y otros cargos
--
-- Tres de esos terminos no tenian columna:
--
--   taxes_charged     IVA sobre los intereses, IVA de los planes en cuotas,
--                     sellos, IIBB, percepciones (RG 4240, RG 5617) y
--                     adelantos. Van de $ 59.180 a $ 663.227 segun el
--                     resumen: en uno son el 4% del saldo. No modelarlos no
--                     los hacia desaparecer; hacia que el cierre diera
--                     siempre por debajo del real.
--
--   credits           Lo que el banco saca del saldo sin que sea un pago. Hoy
--                     es la cuotificacion: en la Mastercard de septiembre son
--                     $ 2.952.659 que salieron de la tarjeta y pasaron a
--                     cuotas fijas. Sin esto el cierre daba tres millones de
--                     mas y nada lo delataba.
--
--   financed_balance  El saldo sobre el que el banco cobro intereses,
--                     deducido de intereses/TEM. Es una division nuestra, no
--                     un dato del resumen: ningun banco lo publica. Se guarda
--                     porque es la diferencia entre estimar el interes del mes
--                     que viene sobre el saldo entero o sobre la parte que de
--                     verdad devenga. En una Visa real son $ 80.000 por mes.
--
-- Las tres son nullable o con default, asi que los resumenes ya cargados
-- siguen valiendo: quedan sin desglose, no rotos.

alter table card_statements
  add column if not exists taxes_charged numeric(14, 2) not null default 0,
  add column if not exists credits numeric(14, 2) not null default 0,
  add column if not exists financed_balance numeric(14, 2);

comment on column card_statements.taxes_charged is
  'Impuestos y demas cargos del resumen (IVA, sellos, IIBB, percepciones, adelantos). Sale por diferencia contra el saldo de cierre que declara el banco, no de sumar renglones.';

comment on column card_statements.credits is
  'Lo que salio del saldo sin ser un pago, como una cuotificacion.';

comment on column card_statements.financed_balance is
  'Saldo sobre el que el banco cobro intereses, deducido de intereses/TEM. Division nuestra: ningun resumen lo publica.';

-- -----------------------------------------------------------------------------
-- copy_scenario tiene que arrastrar las tres, o copiar un escenario pierde el
-- desglose sin decir nada.
--
-- Este cuerpo es el de la migracion 010 tal cual, GENERADO DESDE EL ARCHIVO,
-- con las tres columnas sumadas al INSERT de card_statements y nada mas.
--
-- Escribirla de memoria ya salio mal una vez, en esta misma sesion: el primer
-- intento le puso un `returning id into` a un INSERT de varias filas --plpgsql
-- aborta con "query returned more than one row"-- y de paso perdio el
-- `absorbed_by_statement_id` de los pagos, que era justo el arreglo de la 010.
-- Se corrigio y se verifico copiando el escenario real: cuatro deudas, cuatro
-- resumenes, dos pagos, los dos con su statement_id.
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

  insert into debt_schedule_entries (user_id, scenario_id, debt_id, period, amount, kind, is_estimate, note)
  select e.user_id, new_scen_id, m.new_id, e.period, e.amount, e.kind, e.is_estimate, e.note
  from debt_schedule_entries e join _debt_map m on m.old_id = e.debt_id
  where e.scenario_id = source_id;

  insert into card_statements (
    user_id, scenario_id, debt_id, period, closing_date, due_date,
    previous_balance, interest_charged, new_charges, installments_charge,
    total_due, minimum_payment, amount_paid, usd_charges_excluded,
    usd_balance, usd_rate, taxes_charged, credits, financed_balance,
    source, warnings
  )
  select
    s.user_id, new_scen_id, m.new_id, s.period, s.closing_date, s.due_date,
    s.previous_balance, s.interest_charged, s.new_charges, s.installments_charge,
    s.total_due, s.minimum_payment, s.amount_paid, s.usd_charges_excluded,
    s.usd_balance, s.usd_rate, s.taxes_charged, s.credits, s.financed_balance,
    s.source, s.warnings
  from card_statements s join _debt_map m on m.old_id = s.debt_id
  where s.scenario_id = source_id;

  /*
   * Los pagos van DESPUES de los resumenes, y no al reves, porque cada pago
   * que salio de un resumen tiene que quedar apuntando al resumen COPIADO.
   *
   * Dejarlos en null era lo primero que se hizo, por analogia con
   * expenses.is_archived, y estaba mal: sin `statement_id`, volver a guardar
   * ese resumen en la copia no encuentra el pago para corregirlo y agrega otro
   * — dos pagos por el mismo resumen, y el saldo bajando dos veces.
   *
   * El emparejamiento no necesita un mapa aparte: (debt_id, period) es unico
   * en card_statements, asi que con la deuda copiada y el periodo se llega al
   * resumen copiado.
   */
  insert into debt_payments (
    user_id, scenario_id, debt_id, period, paid_on, amount, kind, note,
    statement_id, is_absorbed, absorbed_by_statement_id
  )
  select
    p.user_id, new_scen_id, m.new_id, p.period, p.paid_on, p.amount, p.kind, p.note,
    ns.id, p.is_absorbed, na.id
  from debt_payments p
  join _debt_map m on m.old_id = p.debt_id
  -- El resumen del que salio, viejo y copiado.
  left join card_statements os on os.id = p.statement_id
  left join card_statements ns
    on ns.scenario_id = new_scen_id and ns.debt_id = m.new_id and ns.period = os.period
  -- Y el que lo absorbio, viejo y copiado.
  left join card_statements oa on oa.id = p.absorbed_by_statement_id
  left join card_statements na
    on na.scenario_id = new_scen_id and na.debt_id = m.new_id and na.period = oa.period
  where p.scenario_id = source_id;

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
