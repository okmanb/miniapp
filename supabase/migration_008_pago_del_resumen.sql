-- =============================================================================
-- 008 — el pago del resumen deja recibo
-- =============================================================================
--
-- Que arregla.
--
-- El campo "cuanto pagaste" del resumen se guardaba restado adentro del saldo
-- de cierre, que es lo que se escribia en debts.base_balance. No creaba
-- ninguna fila en debt_payments, y el Historial de pagos lee solo esa tabla.
-- Resultado: el pago movia el saldo y no dejaba rastro en ningun lado. Peor,
-- quien no lo veia lo registraba de nuevo a mano y el saldo bajaba dos veces,
-- porque el saldo se deriva como base_balance - suma(pagos) y nada cruzaba las
-- dos tablas.
--
-- Ahora el pago del resumen es un pago como cualquier otro, y base_balance
-- guarda el cierre ANTES de restarlo. El saldo derivado da identico.
--
-- Por que hace falta is_absorbed.
--
-- Un resumen arrastra adentro de su "saldo anterior" todo lo que se pago
-- antes. Si esos pagos siguieran vivos en debt_payments se restarian de nuevo
-- contra el saldo nuevo. Asi que el resumen los ABSORBE, que es exactamente la
-- Regla 3 que ya archiva los gastos que el resumen trae adentro: no se borran,
-- dejan de sumar y se siguen viendo en el historial.
--
-- Un pago vivo (is_absorbed = false) es el unico que resta.

begin;

-- -----------------------------------------------------------------------------
-- 1. Las columnas
-- -----------------------------------------------------------------------------

alter table debt_payments add column if not exists statement_id uuid;
alter table debt_payments add column if not exists is_absorbed boolean not null default false;
alter table debt_payments add column if not exists absorbed_by_statement_id uuid;

alter table debt_payments drop constraint if exists debt_payments_statement_fk;
alter table debt_payments
  add constraint debt_payments_statement_fk
  foreign key (statement_id) references card_statements(id) on delete cascade;

alter table debt_payments drop constraint if exists debt_payments_absorbed_by_fk;
alter table debt_payments
  add constraint debt_payments_absorbed_by_fk
  foreign key (absorbed_by_statement_id) references card_statements(id) on delete set null;

create index if not exists debt_payments_live_idx
  on debt_payments (debt_id) where not is_absorbed;

-- Un pago por resumen: volver a guardar el mismo resumen corrige el pago que
-- ya tiene, no agrega otro.
create unique index if not exists debt_payments_one_per_statement_idx
  on debt_payments (statement_id) where statement_id is not null;

-- -----------------------------------------------------------------------------
-- 2. Los pagos que ya estaban adentro de un resumen salen a la luz
-- -----------------------------------------------------------------------------
--
-- Uno por resumen con amount_paid > 0. El del resumen mas reciente de cada
-- tarjeta queda VIVO —es el que base_balance va a dejar de tener restado en el
-- paso 3— y los anteriores quedan absorbidos, porque ya venian adentro del
-- saldo anterior del resumen que les siguio.

with ranked as (
  select
    s.*,
    row_number() over (
      partition by s.debt_id order by s.period desc, s.created_at desc
    ) as rn
  from card_statements s
  where s.amount_paid is not null and s.amount_paid > 0
)
insert into debt_payments (
  user_id, scenario_id, debt_id, period, paid_on, amount, kind, note,
  statement_id, is_absorbed
)
select
  r.user_id, r.scenario_id, r.debt_id,
  -- El mes en que se PAGO, que no es el del resumen: el de agosto se paga en
  -- septiembre. Todo lo que pregunta "que pagaste este mes" mira esta columna.
  coalesce(to_char(r.due_date, 'YYYY-MM'), r.period),
  r.due_date, r.amount_paid,
  'pago_variable', 'Pago del resumen de ' || r.period,
  r.id, r.rn > 1
from ranked r
where not exists (select 1 from debt_payments p where p.statement_id = r.id);

-- De quien es la culpa de que esten absorbidos: del resumen siguiente.
update debt_payments p
set absorbed_by_statement_id = nxt.id
from card_statements s
join lateral (
  select s2.id
  from card_statements s2
  where s2.debt_id = s.debt_id and s2.period > s.period
  order by s2.period asc
  limit 1
) nxt on true
where p.statement_id = s.id
  and p.is_absorbed
  and p.absorbed_by_statement_id is null;

-- -----------------------------------------------------------------------------
-- 3. base_balance deja de tener el ultimo pago restado
-- -----------------------------------------------------------------------------
--
-- base_balance quedo, en cada tarjeta, en el cierre del ultimo resumen que se
-- guardo — que ya tenia el pago descontado. Ahora ese pago vive como fila, asi
-- que hay que devolverselo al saldo o se restaria dos veces.
--
-- Se asume que el ultimo resumen por periodo es el que dejo el saldo. Si
-- alguien edito el saldo a mano DESPUES de cargar el resumen, este paso lo
-- sube de mas y hay que corregirlo desde "editar deuda".

with latest as (
  select distinct on (s.debt_id) s.debt_id, s.amount_paid
  from card_statements s
  where s.amount_paid is not null and s.amount_paid > 0
  order by s.debt_id, s.period desc, s.created_at desc
)
update debts d
set base_balance = d.base_balance + latest.amount_paid
from latest
where latest.debt_id = d.id;

-- -----------------------------------------------------------------------------
-- 4. copy_scenario, al dia con is_absorbed
-- -----------------------------------------------------------------------------
--
-- Copiada tal cual de schema.sql, no reescrita de memoria: es una funcion de
-- mas de cien lineas y transcribirla a mano es como se pierde una tabla.

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

  -- Se copia is_absorbed pero no las dos referencias a resumenes: el flag es
  -- lo que decide si el pago sigue restando, y los ids apuntan a resumenes del
  -- escenario viejo. Mismo criterio que expenses.is_archived, unas lineas mas
  -- abajo.
  insert into debt_payments (
    user_id, scenario_id, debt_id, period, paid_on, amount, kind, note, is_absorbed
  )
  select p.user_id, new_scen_id, m.new_id, p.period, p.paid_on, p.amount, p.kind, p.note,
         p.is_absorbed
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

commit;
