-- El pago que ya tomo el banco y el pago que haces vos no son el mismo pago.
--
-- El formulario del resumen preguntaba "Cuanto pagaste" y prellenaba ese campo
-- con la linea "SU PAGO" del PDF. Son dos cosas distintas y mezclarlas hacia
-- que la pantalla preguntara por algo que no habia pasado:
--
--   * El pago que trae el resumen de septiembre se hizo en AGOSTO, contra el
--     resumen anterior. El banco ya lo resto para llegar a su SALDO ACTUAL.
--     No es editable: es un dato, como los intereses o los impuestos.
--
--   * El pago de ESTE resumen todavia no existe cuando el resumen se emite:
--     vence el mes que viene. Cero es la respuesta normal al cargarlo, y se
--     registra cuando se paga.
--
-- Asi que el campo se parte en dos: `payments_in_period` (del banco, adentro
-- del cierre) y `amount_paid` (tuyo, afuera, con su fila en debt_payments).
--
-- ## De paso arregla un doble conteo que estaba latente
--
-- El calculo restaba los pagos vivos del saldo anterior Y despues restaba
-- `amount_paid` del cierre. Si alguien registraba el pago cuando lo hacia y
-- despues cargaba el resumen que lo declaraba, la misma plata se descontaba
-- dos veces. Ahora el saldo anterior es el del banco, tal cual, y lo unico que
-- resta adentro del cierre son los pagos que el banco declara.
--
-- ## Que hace con lo que ya estaba cargado
--
-- Lo que vivia en `amount_paid` era, en todos los casos, lo que declaraba el
-- PDF: pasa a `payments_in_period`. Como ese pago ahora esta adentro del
-- cierre, el saldo base deja de tenerlo por fuera --se le resta una vez-- y
-- las filas de pago quedan absorbidas.
--
-- El saldo que ve la app no se mueve: antes era base menos pago vivo, ahora es
-- base neta sin pago vivo. Y el recibo se conserva en el historial, que era el
-- motivo por el que esos pagos existen como filas.

alter table card_statements
  add column if not exists payments_in_period numeric(14, 2) not null default 0;

comment on column card_statements.payments_in_period is
  'Lo que el banco ya descontó adentro de este resumen (la línea SU PAGO). Se pagó durante el período que cerró, contra el resumen anterior. Entra en la cuenta del cierre.';

comment on column card_statements.amount_paid is
  'Lo que se pagó de ESTE resumen, si ya se pagó. Cero es lo normal al cargarlo: el vencimiento todavía no llegó. No cambia el cierre; se guarda además como fila en debt_payments.';

update card_statements
   set payments_in_period = amount_paid,
       amount_paid = 0
 where amount_paid <> 0;

with vivos as (
  select p.debt_id, sum(p.amount) as monto
    from debt_payments p
   where p.statement_id is not null and not p.is_absorbed
   group by p.debt_id
)
update debts d
   set base_balance = greatest(0, d.base_balance - v.monto)
  from vivos v
 where v.debt_id = d.id;

update debt_payments
   set is_absorbed = true
 where statement_id is not null and not is_absorbed;
