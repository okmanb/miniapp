/**
 * Control cruzado entre el motor viejo (lib/debt-engine, lib/card-statements)
 * y el portado del prototipo (lib/calc), sobre el caso real que trae
 * handoff/prototipo.html: las cinco deudas del dataset base, que suman
 * $47.133.454 — el mismo total que muestra el dashboard del prototipo.
 *
 * RESET.md pide conservar el motor viejo como control, no como
 * implementación: donde las dos difieran gana el prototipo, pero la
 * diferencia hay que decirla. Este script la dice.
 *
 * Correr con:  npx tsx scripts/cross-check.ts
 */

import { amortize } from "../lib/calc/amortize";
// La comparación de la pantalla 03 sale del mismo módulo, a propósito: si el
// motor cambia, este control tiene que moverse con él.
import { closeStatement } from "../lib/calc/statement";
import { deriveBalance } from "../lib/calc/balance";
import { projectCashflow, projectDebtDueByPeriod } from "../lib/calc/cashflow";
import { toBridgeFlows } from "../lib/data/bridges";
import { parseMoney, formatMoney, monthlyRateFromAnnual } from "../lib/calc/money";
import { bridgeCost, compareAgainstWorstDebt } from "../lib/calc/bridge";
import { simulatePayoff, formatMonthSpan } from "../lib/calc/payoff";
import { compareFixedPaymentScenarios } from "../lib/debt-engine/schedule";
import { calculateStatement } from "../lib/card-statements";

// Dataset base del prototipo, copiado tal cual de su _debtData().
const DEBTS = [
  { name: "Mastercard Banco Patagonia …4139", saldo: 3386911, tna: "83,80%", min: "$ 290.017" },
  { name: "Mastercard Black …3311", saldo: 5806439, tna: "69,44%", min: "$ 1.085.218" },
  { name: "Visa Signature …2166", saldo: 30845480, tna: "98,03%", min: "$ 1.300.000" },
  { name: "Prestamo 2 BBVA", saldo: 5738552, tna: "74,90%", min: "$ 716.569" },
  { name: "Prestamo 1 BBVA", saldo: 1356072, tna: "71,90%", min: "$ 262.695" },
];

const differences: string[] = [];

function note(line: string) {
  differences.push(line);
}

console.log("Saldo total del caso:", formatMoney(DEBTS.reduce((a, d) => a + d.saldo, 0)));
console.log("(el dashboard del prototipo muestra $ 47.133.454)\n");

console.log("=== 1. Amortización pagando el mínimo ===\n");

for (const d of DEBTS) {
  const payment = parseMoney(d.min);
  const annual = parseFloat(d.tna.replace("%", "").replace(",", "."));

  const nuevo = amortize({ balance: d.saldo, annualRate: annual, payment });
  const [viejo] = compareFixedPaymentScenarios({
    balance: d.saldo,
    monthlyRate: annual / 100 / 12,
    candidatePayments: [payment],
  });

  const nuevoTxt = nuevo.months === null ? "no se salda" : `${nuevo.months} meses`;
  const viejoTxt = viejo.monthsToPayoff === null ? "no se salda" : `${viejo.monthsToPayoff} meses`;
  const igual = nuevoTxt === viejoTxt;

  console.log(`${d.name}`);
  console.log(`  saldo ${formatMoney(d.saldo)} · TNA ${d.tna} · mínimo ${d.min}`);
  console.log(`  prototipo: ${nuevoTxt}   motor viejo: ${viejoTxt}   ${igual ? "=" : "DIFIEREN"}`);

  if (!igual) {
    note(`Plazo de "${d.name}": prototipo dice ${nuevoTxt}, motor viejo dice ${viejoTxt}.`);
  }

  if (nuevo.interest !== null && viejo.totalInterestPaid !== null) {
    const diff = nuevo.interest - viejo.totalInterestPaid;
    console.log(
      `  interés total — prototipo ${formatMoney(nuevo.interest)} · viejo ${formatMoney(viejo.totalInterestPaid)}` +
        (diff === 0 ? "  =" : `  DIFIEREN por ${formatMoney(diff)}`)
    );
    if (diff !== 0) {
      note(
        `Interés total de "${d.name}": difieren en ${formatMoney(diff)} — el motor viejo topea el último pago al saldo restante (Math.min), el prototipo paga la cuota entera.`
      );
    }
  }
  console.log("");
}

console.log("=== 2. Cierre de un resumen ===\n");

// Caso: la Visa, que es la que concentra el saldo. Se paga el mínimo justo.
const visa = DEBTS[2];
const annualVisa = 98.03;
const consumos = 450000;
const minimo = parseMoney(visa.min);

for (const pagado of [minimo, minimo - 300000, 0]) {
  const nuevo = closeStatement({
    previousBalance: visa.saldo,
    annualRate: annualVisa,
    newCharges: consumos,
    minimumPayment: minimo,
    amountPaid: pagado,
  });

  // El motor viejo arranca del saldo YA neto de lo pagado y cobra interés sobre eso.
  const viejo = calculateStatement({
    carriedBalance: visa.saldo - pagado,
    monthlyInterestRate: annualVisa / 100 / 12,
    newCharges: consumos,
    installmentsChargeThisPeriod: 0,
  });

  const diff = nuevo.newBalance - Math.round(viejo.totalDue);
  console.log(`pagando ${formatMoney(pagado)} (mínimo ${formatMoney(minimo)}):`);
  console.log(
    `  prototipo — interés ${formatMoney(nuevo.interest)}, punitorio ${formatMoney(nuevo.lateFee)}, cierra en ${formatMoney(nuevo.newBalance)}`
  );
  console.log(
    `  viejo     — interés ${formatMoney(Math.round(viejo.interestCharged))}, sin punitorio, cierra en ${formatMoney(Math.round(viejo.totalDue))}`
  );
  console.log(`  diferencia: ${formatMoney(diff)}\n`);

  if (diff !== 0) {
    note(
      `Cierre de la Visa pagando ${formatMoney(pagado)}: el prototipo cierra ${formatMoney(diff)} por encima del motor viejo.`
    );
  }
}

console.log("=== 3. Pantalla 03 contra las cifras que muestra el prototipo ===\n");

// Leidas de la pantalla 03 del prototipo para la Patagonia.
const SCREEN_03 = {
  saldo: 3386911,
  tna: 83.8,
  interesDelMes: 236519,
  minimo: 290017,
  mesesAlMinimo: 26,
  interesTotalAlMinimo: 3875621,
  mesesAlDoble: 8,
  ahorro: 2757627,
};

function check(label: string, mine: number | null, theirs: number) {
  const ok = mine === theirs;
  console.log(
    `  ${ok ? "=" : "DIFIERE"}  ${label}: nuestro ${mine ?? "—"} · prototipo ${theirs}`
  );
  if (!ok) note(`Pantalla 03 — ${label}: nuestro ${mine ?? "—"}, prototipo ${theirs}.`);
}

const interesMes = Math.round(SCREEN_03.saldo * (SCREEN_03.tna / 100 / 12));
check("interés del mes", interesMes, SCREEN_03.interesDelMes);

const alMinimo = amortize({
  balance: SCREEN_03.saldo,
  annualRate: SCREEN_03.tna,
  payment: SCREEN_03.minimo,
});
check("meses pagando el mínimo", alMinimo.months, SCREEN_03.mesesAlMinimo);
check("interés total al mínimo", alMinimo.interest, SCREEN_03.interesTotalAlMinimo);

const alDoble = amortize({
  balance: SCREEN_03.saldo,
  annualRate: SCREEN_03.tna,
  payment: SCREEN_03.minimo * 2,
});
check("meses pagando el doble", alDoble.months, SCREEN_03.mesesAlDoble);

const ahorro =
  alMinimo.interest != null && alDoble.interest != null
    ? alMinimo.interest - alDoble.interest
    : null;
check("ahorro pagando el doble", ahorro, SCREEN_03.ahorro);

console.log("");
console.log("=== 4. Pantalla 11 contra la cuenta del puente que muestra el prototipo ===\n");

// El prototipo, con $ 800.000 a un mes al 5% mensual y la Visa (98,03% TNA)
// como deuda mas cara, muestra: interes $ 40.000, total $ 840.000, la
// alternativa de dejarlo ahi $ 65.353 y un ahorro de $ 25.353.
const BRIDGE = {
  monto: 800000,
  meses: 1,
  tasaMensual: 5,
  interes: 40000,
  total: 840000,
  alternativa: 65353,
  ahorro: 25353,
};

const puente = bridgeCost({
  amount: BRIDGE.monto,
  months: BRIDGE.meses,
  ratePercent: BRIDGE.tasaMensual,
});
check("interes del puente", puente.interest, BRIDGE.interes);
check("total a devolver", puente.total, BRIDGE.total);

const contra = compareAgainstWorstDebt({
  amount: BRIDGE.monto,
  months: BRIDGE.meses,
  worstMonthlyRate: monthlyRateFromAnnual(98.03),
  bridgeInterest: puente.interest,
});
check("interes de dejarlo en la Visa", contra.alternativeInterest, BRIDGE.alternativa);
check("ahorro del puente", contra.saving, BRIDGE.ahorro);

console.log("");
console.log("=== 5. Pantalla 08 contra el plan que muestra el prototipo ===\n");

// El prototipo, con avalancha y $ 500.000 de extra sobre el dataset base,
// muestra 2 anios y 7 meses, $ 78.862.408 de interes total, y este orden de
// CANCELACION (que no es el de ataque: la mas cara suele caer ultima).
const PLAN = {
  extra: 500000,
  plazo: "2 anos y 7 meses",
  interes: 78862408,
  orden: [
    "Prestamo 1 BBVA",
    "Mastercard Black ...3311",
    "Prestamo 2 BBVA",
    "Mastercard Banco Patagonia ...4139",
    "Visa Signature ...2166",
  ],
};

const plan = simulatePayoff({
  debts: DEBTS.map((d, i) => ({
    id: String(i),
    name: d.name,
    kind: /Prestamo/i.test(d.name) ? "prestamo_personal" : "tarjeta",
    balance: d.saldo,
    minimum: parseMoney(d.min),
    monthlyRate: monthlyRateFromAnnual(d.tna),
    recurringCharge: 0,
  })),
  extraPerMonth: PLAN.extra,
  strategy: "avalancha",
});

check("interes total del plan", plan.totalInterest, PLAN.interes);

const plazo = formatMonthSpan(plan.totalMonths).replace(/ñ/g, "n");
console.log(
  "  " + (plazo === PLAN.plazo ? "= " : "!=") + " plazo del plan: nuestro " + plazo + " . prototipo " + PLAN.plazo
);
if (plazo !== PLAN.plazo) note("Pantalla 08 - plazo: nuestro " + plazo + ", prototipo " + PLAN.plazo + ".");

const orden = plan.debts
  .filter((d) => d.clearedMonth !== null && d.clearedMonth > 0)
  .sort((a, b) => a.clearedMonth! - b.clearedMonth! || a.order - b.order)
  .map((d) => d.name.replace(/…/g, "..."));

const mismoOrden = orden.length === PLAN.orden.length && orden.every((n, i) => n === PLAN.orden[i]);
console.log("  " + (mismoOrden ? "= " : "!=") + " orden de cancelacion: " + orden.join(" > "));
if (!mismoOrden) note("Pantalla 08 - orden de cancelacion: nuestro " + orden.join(" > ") + ".");

/*
 * El pago del resumen, ida y vuelta.
 *
 * El campo "cuanto pagaste" ya no se guarda restado adentro del saldo: se
 * guarda como pago en debt_payments y la resta la hace deriveBalance. El saldo
 * que ve la app tiene que dar EXACTAMENTE lo mismo que daba antes, o la
 * migracion 008 movio plata. Y un pago absorbido no tiene que restar: ese es
 * el bug que se arreglo, el saldo bajando dos veces por el mismo peso.
 */
console.log("");
console.log("=== 6. El pago del resumen deja recibo y el saldo no se mueve ===\n");

{
  const visa = DEBTS.find((d) => /Visa/i.test(d.name))!;
  const cierre = closeStatement({
    previousBalance: visa.saldo,
    annualRate: visa.tna,
    newCharges: 0,
    minimumPayment: parseMoney(visa.min),
    amountPaid: parseMoney(visa.min),
  });

  const deuda = {
    id: "visa",
    base_balance: cierre.grossBalance,
    annual_interest_rate: Number(visa.tna),
    tem: null,
  };
  const delResumen = { debt_id: "visa", amount: parseMoney(visa.min), is_absorbed: false };
  const yaAbsorbido = { debt_id: "visa", amount: 999_999, is_absorbed: true };

  check("saldo derivado = cierre neto", deriveBalance(deuda, [], [delResumen]), cierre.newBalance);
  check(
    "un pago absorbido no vuelve a restar",
    deriveBalance(deuda, [], [delResumen, yaAbsorbido]),
    cierre.newBalance
  );
}

/*
 * El puente tiene que LLEGAR al flujo de caja.
 *
 * La seccion 4 verifica que la cuenta del puente de bien, pero esa cuenta ya
 * daba bien cuando el bug era que `bridge_loans` se escribia y no lo leia
 * nadie: la pantalla 11 estaba completa y era decorativa. Lo que hay que
 * probar es el camino entero — fila de la base -> BridgeFlow -> proyeccion —,
 * que es donde se corto.
 *
 * Y que un puente SIMULADO no mueva nada: mirar cuanto costaria un prestamo
 * no puede cambiar el mes que viene.
 */
console.log("");
console.log("=== 7. El puente entra al flujo de caja ===\n");

{
  const fila = {
    id: "b1",
    lender: "Un amigo",
    amount: 800_000,
    taken_period: "2026-09",
    repay_period: "2026-10",
    monthly_interest_rate: 5,
    is_taken: true,
    note: null,
  };

  const proyectar = (tomado: boolean) =>
    projectCashflow({
      startBalance: 0,
      startPeriod: "2026-09",
      months: 3,
      incomes: [],
      expenses: [],
      debtDueFor: () => 0,
      bridges: toBridgeFlows([{ ...fila, is_taken: tomado }]),
    });

  const conPuente = proyectar(true);
  const simulado = proyectar(false);

  check("la plata entra el mes que se toma", conPuente.months[0].bridgeIn, 800_000);
  check("no entra dos veces", conPuente.months[1].bridgeIn, 0);
  check("se devuelve el mes pactado, con interes", conPuente.months[1].bridgeDue, 840_000);
  check("la devolucion pesa como deuda del mes", conPuente.months[1].debtDue, 840_000);
  check("y deja el acumulado en el costo", conPuente.months[1].cumulative, -40_000);
  check("un puente simulado no mueve nada", simulado.months[0].bridgeIn, 0);
  check("ni su devolucion", simulado.months[1].bridgeDue, 0);
}

/*
 * El minimo de una tarjeta NO es fijo: se calcula sobre el saldo, asi que si
 * el saldo crece, crece. Congelarlo hacia que la obligacion proyectada se
 * quedara corta y que el mes de quedarse sin plata saliera mas tarde de lo que
 * va a ser — el error para el lado optimista, que es el peor.
 *
 * La proporcion se OBSERVA del ultimo resumen. Los numeros de abajo son los de
 * la Visa real: cerro en $8.089.852 y el banco pidio $4.614.770, el 57%.
 */
console.log("");
console.log("=== 8. El minimo proyectado sigue al saldo ===\n");

{
  const visa = {
    balance: 8_089_852,
    monthlyRate: 0.05641,
    fixedPayment: null,
    minimumRatio: 4_614_770 / 8_089_852,
  };

  const meses = projectDebtDueByPeriod([visa], "2026-09", 3);
  const primero = meses.get("2026-09")!;
  const segundo = meses.get("2026-10")!;

  check("el primer mes reproduce lo que pidio el banco", primero, 4_614_770);
  console.log(
    "  " + (segundo < primero ? "= " : "!=") +
      " y el siguiente baja, porque el saldo bajo: " + formatMoney(segundo)
  );
  if (segundo >= primero) note("El minimo proyectado no acompana al saldo.");

  // Un prestamo paga lo mismo todos los meses, pase lo que pase con el saldo.
  const prestamo = { balance: 1_356_072, monthlyRate: 0.0599, fixedPayment: 262_695, minimumRatio: null };
  const fijos = projectDebtDueByPeriod([prestamo], "2026-09", 3);
  check("la cuota de un prestamo no se mueve", fijos.get("2026-10")!, 262_695);
}

console.log("");
console.log("=== Diferencias encontradas ===\n");
if (differences.length === 0) {
  console.log("Ninguna: los dos motores dan lo mismo en este caso.");
} else {
  for (const d of differences) console.log("- " + d);
}
