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
import { closeStatement } from "../lib/calc/statement";
import { parseMoney, formatMoney } from "../lib/calc/money";
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

console.log("=== Diferencias encontradas ===\n");
if (differences.length === 0) {
  console.log("Ninguna: los dos motores dan lo mismo en este caso.");
} else {
  for (const d of differences) console.log("- " + d);
}
