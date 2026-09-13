-- Las cuotas del resumen nunca se guardaron, y el indice era el motivo.
--
-- `card_installment_plans` tenia CERO filas en produccion despues de cargar
-- seis resumenes reales, varios de ellos con refinanciaciones y compras en
-- cuotas que la pantalla mostraba bien ("Encontramos 8 compras en cuotas").
-- Se leian, viajaban en el formulario, y desaparecian al guardar.
--
-- El motivo es este indice, que era PARCIAL:
--
--   create unique index card_installment_plans_debt_cupon_idx
--     on card_installment_plans (debt_id, cupon) where cupon is not null;
--
-- El codigo hace `upsert(..., { onConflict: "debt_id,cupon" })`, que PostgREST
-- traduce a `on conflict (debt_id, cupon)`. Postgres solo acepta un indice
-- parcial como arbitro si el INSERT repite su clausula WHERE, y PostgREST no
-- tiene forma de emitirla. Entonces cada upsert fallaba con
--
--   42P10: there is no unique or exclusion constraint matching the
--          ON CONFLICT specification
--
-- ...y el codigo descartaba el error. Un fallo total, silencioso, en el unico
-- camino por el que las cuotas entran a la app.
--
-- El indice completo conserva la intencion del parcial. Postgres considera
-- distintos a dos NULL en un indice unico (NULLS DISTINCT es el default), asi
-- que dos cuotas cargadas a mano sin cupon siguen pudiendo convivir, que era
-- exactamente lo que el WHERE protegia. La diferencia es que ahora sirve de
-- arbitro y el upsert funciona.
--
-- La correccion del lado del codigo va junto con esto: el error del upsert se
-- devuelve en vez de descartarse, para que si esto se vuelve a romper se vea.

drop index if exists card_installment_plans_debt_cupon_idx;

create unique index if not exists card_installment_plans_debt_cupon_idx
  on card_installment_plans (debt_id, cupon);

comment on index card_installment_plans_debt_cupon_idx is
  'Arbitro del upsert por (debt_id, cupon): cargar dos veces el mismo resumen corrige las cuotas en vez de duplicarlas. NO puede ser parcial: un indice parcial no sirve de arbitro para el ON CONFLICT que emite PostgREST.';
