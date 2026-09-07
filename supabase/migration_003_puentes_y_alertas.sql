-- -----------------------------------------------------------------------------
-- 003 · Los puentes entran al flujo, y las alertas se pueden posponer y configurar.
--
-- Tres huecos que aparecieron al poner las pantallas 07-16 al lado del
-- prototipo:
--
--  1. `bridge_loans` se escribía y no lo leía nadie. Para que un puente pueda
--     entrar en la proyección hace falta saber si se tomó de verdad (mirar
--     cuánto costaría no puede mover el flujo solo) y a qué tasa. La tasa del
--     prototipo es MENSUAL y simple, no anual: `costo = monto * tasa * meses`.
--     La columna anual nunca se escribió desde la app, así que se va.
--
--  2. `alert_dismissals` guardaba un descarte permanente. El prototipo pospone:
--     la alerta vuelve mañana, o antes si el vencimiento aprieta.
--
--  3. Las preferencias de aviso (cuándo, por dónde, sobre qué deudas) no
--     tenían dónde vivir.
-- -----------------------------------------------------------------------------

alter table bridge_loans add column if not exists is_taken boolean not null default false;
alter table bridge_loans add column if not exists monthly_interest_rate numeric(8, 4);
alter table bridge_loans drop column if exists annual_interest_rate;

-- La nota del escenario: para acordarse después de qué se cambió en ese plan.
alter table scenarios add column if not exists note text;

-- Posponer no es descartar: lo que se guarda es hasta cuándo.
alter table alert_dismissals add column if not exists snoozed_until timestamptz;
update alert_dismissals set snoozed_until = dismissed_at where snoozed_until is null;
alter table alert_dismissals alter column snoozed_until set not null;

-- El enum de alertas no tenía la del flujo ("en noviembre el mes no cierra") ni
-- la de las cuotas fijas, que el prototipo sí deriva.
alter type alert_kind add value if not exists 'mes_no_cierra';
alter type alert_kind add value if not exists 'cuotas_fijas';

create table if not exists alert_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  -- Cuántos días antes del vencimiento avisamos. 0 = el mismo día.
  lead_days smallint not null default 3 check (lead_days in (0, 1, 3, 7)),
  -- Al menos un canal: una preferencia vacía es no tener preferencia.
  channels text[] not null default '{push}' check (array_length(channels, 1) >= 1),
  -- 'todas' | 'algunas'. Con 'algunas' manda only_debt_ids.
  scope text not null default 'todas' check (scope in ('todas', 'algunas')),
  only_debt_ids uuid[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table alert_settings enable row level security;

drop policy if exists "preferencias propias" on alert_settings;
create policy "preferencias propias" on alert_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- copy_scenario, al día con las columnas nuevas.
--
-- La copia arrastra la nota del escenario y el estado de cada puente: un
-- puente simulado en el original sigue simulado en la copia, porque copiar un
-- plan para probar variantes no es tomar la plata.
-- -----------------------------------------------------------------------------

create or replace function copy_scenario(source_id uuid, new_name text)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
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

  create temp table _debt_map (old_id uuid primary key, new_id uuid) on commit drop;

  for old_debt in select * from debts where scenario_id = source_id loop
    insert into debts (
      user_id, scenario_id, name, kind, base_balance, base_balance_at,
      annual_interest_rate, tem, credit_limit, due_day, closing_day,
      installments_total, installments_paid, min_payment_formula,
      account_last4, is_active
    )
    values (
      old_debt.user_id, new_scen_id, old_debt.name, old_debt.kind,
      old_debt.base_balance, old_debt.base_balance_at,
      old_debt.annual_interest_rate, old_debt.tem, old_debt.credit_limit,
      old_debt.due_day, old_debt.closing_day, old_debt.installments_total,
      old_debt.installments_paid, old_debt.min_payment_formula,
      old_debt.account_last4, old_debt.is_active
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
