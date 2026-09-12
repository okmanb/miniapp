"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { saveStatement } from "@/app/dashboard/statements/actions";
import { EMPTY_STATEMENT_STATE, type StatementState } from "@/app/dashboard/statements/form-state";
import { parseStatementPdf, type ParseResult } from "@/app/dashboard/statements/parse-actions";
import { fetchUsdRate } from "@/app/dashboard/statements/rate-actions";
import {
  formatArgNumber,
  formatMoney,
  formatUsd,
  monthlyRateFromAnnual,
  parseMoney,
} from "@/lib/calc/money";
import { parseArgNumber } from "@/app/dashboard/debts/validation";
import { closeStatement } from "@/lib/calc/statement";
import { Spinner, Chevron } from "./ui";
import { CalendarField, describeCalendarValue } from "./CalendarField";
import { ChoiceGroup } from "./ChoiceGroup";
import { PdfCard } from "./StatementImport";

/**
 * Carga del resumen del mes (pantalla 06).
 *
 * El PDF prellena, no guarda. El parser está atado a la maquetación de cada
 * banco y se rompe cuando el banco la cambia, así que lo que sale de ahí va a
 * campos editables para que la persona lo confirme. Lo que el parser no pudo
 * leer se dice con todas las letras en vez de quedar en cero: un cero puesto
 * por nosotros es indistinguible de un cero real del resumen.
 *
 * Cuando el servidor detecta posible doble conteo, el formulario no se reenvía
 * solo: aparece la lista de los gastos que se van a archivar y el botón cambia
 * de texto. Confirmar es un acto aparte, porque la consecuencia (que esos
 * gastos dejen de sumar al saldo) no se ve hasta después.
 *
 * Acá también se da de alta la tarjeta, y por eso el PDF se pide una sola vez
 * en toda la app. El prototipo tiene el bloque del PDF únicamente en esta
 * pantalla; el que estaba en el alta de la deuda lo habíamos agregado nosotros,
 * y partía en dos el camino más común —"tengo el resumen de una tarjeta
 * nueva"— obligando a cargar el archivo, guardar, y volver a empezar acá. El
 * resumen ya trae los cuatro datos que pedía el alta.
 */
export interface StatementCard {
  id: string;
  name: string;
  /**
   * El saldo anterior de un resumen nuevo: el saldo base de la tarjeta menos
   * los pagos que todavia restan.
   *
   * Neto de pagos y no crudo, porque es lo que el servidor usa al guardar.
   * Cuando venia crudo, cargar el resumen de un mes despues de haber
   * registrado un pago mostraba un saldo anterior mas alto que el que se
   * guardaba, y la cuenta de la pantalla no era la que quedaba en la base.
   */
  balance: number;
  /**
   * El saldo anterior que ya guardo cada resumen de esta tarjeta, por periodo.
   *
   * Volver a cargar un resumen lo CORRIGE: el servidor reusa el saldo anterior
   * que ese resumen guardo, en vez del saldo base —que a esa altura ya es el
   * cierre que dejo el mismo resumen, y usarlo cobraria el mes dos veces. La
   * pantalla tiene que mirar lo mismo o muestra un saldo inflado.
   */
  previousByPeriod?: Record<string, number>;
  /** Tasa mensual en decimal. */
  monthlyRate: number;
  /**
   * Los dólares que ya convertimos a pesos en el último resumen de esta
   * tarjeta, si los hubo. Sirve para avisar del doble conteo del mes
   * siguiente: el banco convierte los dólares que no pagaste y los unifica con
   * los pesos, y acá ya entraron al saldo.
   */
  lastUsd: { period: string; balance: number; rate: number } | null;
}

/** La opción de la lista de tarjetas que abre el alta acá mismo. */
const NEW_CARD = "nueva";

export function StatementForm({
  cards,
  defaultDebtId,
  defaultPeriod,
}: {
  cards: StatementCard[];
  defaultDebtId?: string;
  defaultPeriod: string;
}) {
  const [state, formAction, pending] = useActionState<StatementState, FormData>(
    saveStatement,
    EMPTY_STATEMENT_STATE
  );

  const [parsing, startParsing] = useTransition();
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [fileName, setFileName] = useState("");

  // Controlados para que el PDF pueda prellenarlos y la persona corregirlos.
  // Sin ninguna tarjeta cargada, "es una tarjeta nueva" es la única respuesta
  // posible: elegirla a mano sería pedirle a alguien que confirme lo obvio.
  const [debtId, setDebtId] = useState(
    defaultDebtId ?? (cards.length === 0 ? NEW_CARD : "")
  );

  /*
   * Los cuatro datos de una tarjeta que todavía no existe. Son exactamente los
   * que pide el alta, y los cuatro salen del PDF.
   *
   * El saldo que se pide es el ANTERIOR, no el que cierra: esta pantalla
   * calcula el cierre sumándole el interés y los consumos. El alta pedía
   * "saldo actual" y se prellenaba con el total del resumen, así que al cargar
   * ese mismo resumen se le volvía a sumar el mes encima.
   */
  const [cardName, setCardName] = useState("");
  const [cardPrevious, setCardPrevious] = useState("");
  const [cardRate, setCardRate] = useState("");
  /*
   * La mensual que declara el resumen, tal cual viene. No tiene campo propio:
   * es un dato del banco que no se edita, y mostrarlo como un segundo campo de
   * tasa al lado de la anual invitaría a tocarlo. Se dice en la ayuda de la
   * anual y viaja escondido.
   */
  const [cardMonthlyRate, setCardMonthlyRate] = useState<number | null>(null);
  const [cardDueDay, setCardDueDay] = useState("");
  const [period, setPeriod] = useState(defaultPeriod);
  const [newCharges, setNewCharges] = useState("");
  const [minimum, setMinimum] = useState("");
  const [paid, setPaid] = useState("");
  /*
   * Lo que el resumen cobra y hasta ahora no tenia donde entrar.
   *
   * Los intereses se pedian antes: se deducian del saldo por la TEM. El banco
   * no cobra asi --cobra sobre la parte financiada-- y la diferencia, medida
   * sobre una Visa real, fue de $ 80.000 en un mes. Cuando el PDF los declara,
   * mandan ellos.
   *
   * Los impuestos no se modelaban en absoluto. En seis resumenes reales van de
   * $ 59.180 a $ 663.227: no es un redondeo, en uno son el 4% del saldo.
   */
  const [interest, setInterest] = useState("");
  const [otherCharges, setOtherCharges] = useState("");
  /*
   * La cuotificacion: el banco acredita el saldo financiado y lo pasa a cuotas
   * fijas. En la Mastercard de septiembre son $ 2.952.659 que salieron de la
   * tarjeta. Sin esto el cierre daba tres millones de mas.
   */
  const [credits, setCredits] = useState("");

  /*
   * Los dolares. El total sale del PDF; la cotizacion no, porque el resumen no
   * la trae — se pagan a la del dia del cierre. Sin ella no se convierte nada:
   * un tipo de cambio inventado por nosotros seria peor que no sumarlos.
   */
  const [usdBalance, setUsdBalance] = useState("");
  const [usdRate, setUsdRate] = useState("");
  const [chargesOpen, setChargesOpen] = useState(false);
  // El bloque arranca cerrado —el prototipo no tiene dolares en esta pantalla—
  // y se abre solo cuando el PDF declara un saldo en dolares, que es cuando la
  // pregunta deja de ser hipotetica.
  const [usdOpen, setUsdOpen] = useState(false);

  /*
   * Cuando se pago el resumen. El resumen de agosto se paga en septiembre, asi
   * que el mes del pago NO es el del resumen: si se guardara con el del
   * resumen, "ya pagaste el minimo de este mes" nunca lo encontraria.
   *
   * Sale del vencimiento que trae el PDF. Sin PDF queda vacio y el servidor
   * usa hoy, que es cuando se esta cargando.
   */
  const [paidOn, setPaidOn] = useState("");
  const [rateBusy, startRate] = useTransition();
  const [rateNote, setRateNote] = useState<string | null>(null);

  /*
   * Traer la cotización de hoy. Prellena, no decide: cae en el mismo campo
   * editable, y la pantalla dice de dónde salió para que nadie la confunda con
   * la que aplicó el banco.
   */
  function pickTodaysRate() {
    setRateNote(null);
    startRate(async () => {
      const result = await fetchUsdRate();
      if (!result.ok) {
        setRateNote(result.message);
        return;
      }
      setUsdRate(formatArgNumber(result.rate));
      setRateNote(
        `Oficial (venta) de hoy${
          result.updatedAt ? `, actualizada ${describeCalendarValue("date", result.updatedAt.slice(0, 10))}` : ""
        }. Es de referencia: el banco pudo haber usado otra.`
      );
    });
  }
  const [payKind, setPayKind] = useState<PayKind>("variable");

  const needsConfirm = Boolean(state.pendingDuplicates?.length);
  const creatingCard = debtId === NEW_CARD;

  /*
   * Qué falta para que los atajos de "tipo de pago" se puedan usar. Los dos
   * escriben el campo "cuánto pagaste", así que necesitan el número que van a
   * escribir: el mínimo, del campo de arriba; el total, del saldo de la
   * tarjeta. Sin esta línea el botón gris no explica nada.
   */
  const missing: string[] = [];
  if (parseMoney(minimum) <= 0) missing.push("cargá el pago mínimo");
  if (!debtId) missing.push("elegí la tarjeta");
  const blockedHint =
    missing.length > 0
      ? `«Pago variable» es lo que pudiste pagar, sea cual sea el monto. Para usar los otros dos, ${missing.join(" y ")}.`
      : "«Pago variable» es lo que pudiste pagar, sea cual sea el monto. Los otros dos escriben el monto por vos.";

  /**
   * Lo que el PDF prellena. Solo se toca lo que el parser SÍ leyó: un campo
   * que no pudo leer se deja como estaba, no se pisa con cero, porque un cero
   * puesto por nosotros es indistinguible de un cero real del resumen.
   */
  function applyParsed(result: ParseResult) {
    if (!result.ok) return;

    if (result.period) setPeriod(result.period);
    if (result.newCharges != null) setNewCharges(String(Math.round(result.newCharges)));
    if (result.interest != null) setInterest(String(Math.round(result.interest)));
    if (result.otherCharges != null) setOtherCharges(String(Math.round(result.otherCharges)));
    if (result.credits != null) setCredits(String(Math.round(result.credits)));
    // Lo que el resumen dice que se pago en el periodo. Es el dato del banco:
    // antes habia que buscarlo en el PDF y escribirlo.
    if (result.paidInPeriod != null && result.paidInPeriod > 0) {
      setPaid(String(Math.round(result.paidInPeriod)));
      setPayKind("variable");
    }
    // Y la cotizacion a la que el banco paso los dolares a pesos, que viene en
    // su linea de transferencia de deuda.
    if (result.usdRateFromStatement != null) setUsdRate(formatArgNumber(result.usdRateFromStatement));
    if (result.minimumPayment != null) setMinimum(String(Math.round(result.minimumPayment)));

    // Los de la tarjeta se llenan siempre, aunque todavía no se haya elegido
    // "es una tarjeta nueva": si se elige después, ya están puestos.
    if (result.cardName) {
      setCardName(
        result.accountLast4 ? `${result.cardName} …${result.accountLast4}` : result.cardName
      );
    }
    if (result.previousBalance != null) {
      setCardPrevious(String(Math.round(result.previousBalance)));
    }
    if (result.dueDate) setPaidOn(result.dueDate);
    if (result.usdBalance != null && result.usdBalance > 0) {
      setUsdBalance(formatArgNumber(result.usdBalance));
      setUsdOpen(true);
    }
    if (result.annualRate != null) setCardRate(formatArgNumber(result.annualRate));
    if (result.monthlyRate != null) setCardMonthlyRate(result.monthlyRate);
    if (result.dueDate) {
      const day = Number(result.dueDate.slice(8, 10));
      if (day >= 1 && day <= 31) setCardDueDay(String(day));
    }
  }

  /*
   * La tarjeta contra la que se hace la cuenta. Si se está creando, sale de los
   * campos de arriba en vez de la base: el "cómo queda la tarjeta" tiene que
   * funcionar antes de que la fila exista, que es cuando más se lo necesita.
   */
  // Lo que los dolares suman al saldo, en pesos. Cero mientras falte cualquiera
  // de los dos: es lo mismo que decir "todavia no se pueden contar".
  const usdInPesos = Math.round((parseArgNumber(usdBalance) ?? 0) * (parseArgNumber(usdRate) ?? 0));

  const existingCard = cards.find((c) => c.id === debtId) ?? null;

  const card: StatementCard | null = creatingCard
    ? {
        id: NEW_CARD,
        name: cardName.trim() || "la tarjeta nueva",
        balance: parseMoney(cardPrevious),
        // La declarada manda sobre la derivada, igual que en el resto de la app.
        monthlyRate:
          cardMonthlyRate != null
            ? cardMonthlyRate / 100
            : monthlyRateFromAnnual(parseArgNumber(cardRate) ?? 0),
        // Una tarjeta que se está creando no tiene resúmenes anteriores.
        lastUsd: null,
      }
    : existingCard;

  /*
   * El aviso del doble conteo de dólares. Solo si el resumen que se está
   * cargando es POSTERIOR al que los convirtió: volver a guardar aquel mismo
   * resumen no tiene nada que avisar.
   *
   * Va acá arriba y no al guardar, a diferencia del aviso de gastos: este es un
   * consejo sobre qué escribir en "consumos nuevos", así que tiene que estar a
   * la vista ANTES de escribirlo. Uno que aparece al apretar guardar llega
   * cuando el número ya está puesto.
   */
  const usdWarning = card?.lastUsd && period > card.lastUsd.period ? card.lastUsd : null;

  /*
   * El saldo anterior contra el que se hace la cuenta, con el mismo criterio
   * que el servidor: si este mes ya tiene un resumen guardado, el suyo; si no,
   * el saldo de la tarjeta neto de pagos.
   */
  const previousBalance = card
    ? (card.previousByPeriod?.[period] ?? card.balance)
    : 0;

  // Cómo queda la tarjeta, con la misma función que va a correr el servidor al
  // guardar. Es la cuenta que decide si conviene pagar el mínimo o algo más, y
  // esa decisión se toma antes de guardar, no después.
  const preview = useMemo(() => {
    if (!card) return null;
    return closeStatement({
      previousBalance,
      // La mensual va derecho. Antes se la multiplicaba por doce para que
      // `closeStatement` volviera a dividirla, y ese ida y vuelta escondia que
      // el servidor no hacia lo mismo: guardaba con la anual.
      annualRate: null,
      monthlyRate: card.monthlyRate,
      newCharges: parseMoney(newCharges),
      minimumPayment: parseMoney(minimum),
      amountPaid: parseMoney(paid),
      usdCharges: usdInPesos,
      declaredInterest: interest ? parseMoney(interest) : null,
      otherCharges: parseMoney(otherCharges),
      credits: parseMoney(credits),
    });
  }, [card, previousBalance, newCharges, minimum, paid, usdInPesos, interest, otherCharges, credits]);

  /**
   * El tipo de pago no es un dato aparte: es un atajo que escribe "cuánto
   * pagaste". Guardarlo como una tercera cifra abriría la puerta a que diga
   * "pago total" y el monto no lo sea.
   */
  function pickPayKind(kind: PayKind) {
    setPayKind(kind);
    if (kind === "minimo") setPaid(minimum);
    if (kind === "total" && preview) {
      setPaid(
        String(
          Math.round(
            card!.balance + preview.interest + parseMoney(newCharges) + preview.usdCharges
          )
        )
      );
    }
  }

  function readPdf(file: File) {
    setFileName(file.name);
    startParsing(async () => {
      const data = new FormData();
      data.set("pdf", file);
      const result = await parseStatementPdf(data);
      setParsed(result);
      applyParsed(result);
    });
  }

  return (
    <>
      {/*
        La tarjeta la pone `PdfCard`, no esta pantalla. Antes acá había una
        copia del bloque —con el `<input type="file">` crudo adentro— y cuando
        se arregló el del alta de la tarjeta, este quedó atrás mostrando
        "Choose file / No file chosen". Lo único propio de esta pantalla es el
        resumen de lo leído, que va como hijo.
      */}
      <div className="mt-4">
        <PdfCard
          title="Resumen en PDF"
          note="Lo leemos y completamos los campos de abajo. No se guarda nada hasta que revises y confirmes."
          fileName={fileName}
          busy={parsing}
          onPick={readPdf}
        >
          {parsing && (
            <p role="status" className="mt-3 flex items-center gap-2 text-[11.5px] text-muted">
              <Spinner className="text-teal" />
              Leyendo el PDF…
            </p>
          )}

          {parsed && !parsed.ok && (
            <p role="alert" className="mt-3 text-[11.5px] text-brick-ink">
              {parsed.message}
            </p>
          )}

          {parsed?.ok && <ParseSummary parsed={parsed} />}
        </PdfCard>
      </div>

      <form action={formAction} className="mt-6">
        <h2 className="text-[15px] font-semibold text-ink">Revisá los montos</h2>
        <p className="help mt-1">
          El saldo anterior y el interés se calculan solos. Vos confirmás los consumos nuevos, el
          pago mínimo y cuánto pagaste realmente. Si no subiste el PDF, cargalos a mano acá.
        </p>

        {needsConfirm && <input type="hidden" name="confirmed" value="1" />}
        <input type="hidden" name="declared_interest" value={interest} />
        <input type="hidden" name="other_charges_total" value={otherCharges} />
        <input type="hidden" name="credits_total" value={credits} />
        {paidOn && <input type="hidden" name="paid_on" value={paidOn} />}
        {/*
          La TEM que declaro el PDF, para cualquier tarjeta y no solo la que se
          crea acá. Antes viajaba únicamente en el alta, así que una tarjeta
          cargada a mano —o creada antes de que esto existiera— cerraba para
          siempre con la anual sobre doce, que da de más. El campo de editar
          deuda no tiene dónde ponerla: este resumen es la única fuente.
        */}
        {cardMonthlyRate != null && (
          <input type="hidden" name="declared_monthly_rate" value={cardMonthlyRate} />
        )}
        {/* Las cuotas detectadas viajan enteras: se guardan al confirmar. */}
        {parsed?.ok && parsed.installments && parsed.installments.length > 0 && (
          <input type="hidden" name="installments" value={JSON.stringify(parsed.installments)} />
        )}

        <ChoiceGroup
          name="debt_id"
          label="Tarjeta"
          value={debtId}
          onChange={setDebtId}
          layout="list"
          required
          options={[
            ...cards.map((c) => ({ value: c.id, label: c.name })),
            { value: NEW_CARD, label: "Es una tarjeta nueva" },
          ]}
        />
        {parsed?.ok && parsed.cardName && !creatingCard && (
          <p className="help mt-1.5">
            El PDF dice “{parsed.cardName}
            {parsed.accountLast4 ? ` …${parsed.accountLast4}` : ""}”. Elegí a cuál de tus
            tarjetas corresponde, o “Es una tarjeta nueva” si todavía no la cargaste.
          </p>
        )}

        {/*
          El alta de la tarjeta, acá mismo. Son los cuatro campos del
          formulario de deuda y los cuatro salen del PDF, así que en el caso
          normal no hay nada que escribir: solo confirmar lo leído.
        */}
        {creatingCard && (
          <div className="mt-5 rounded-surface-lg border border-border bg-surface-sunken px-4 py-3">
            <div className="text-label uppercase text-muted">La tarjeta nueva</div>
            <p className="help mt-1">
              Se crea con este resumen. Si subiste el PDF ya está todo cargado — revisalo y
              seguí.
            </p>

            <div className="mt-4">
              <label htmlFor="new_card_name" className="block text-label uppercase text-muted">
                Nombre
              </label>
              <input
                id="new_card_name"
                name="new_card_name"
                autoComplete="off"
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                placeholder="Visa Signature …2166"
                className="mt-2 min-h-touch w-full rounded-surface border border-border-input bg-surface px-3 text-[15px] text-ink outline-none placeholder:text-muted"
              />
              <p className="help mt-1.5">
                Así la vas a ver en el dashboard — poné algo que reconozcas de un vistazo.
              </p>
            </div>

            <MoneyField
              id="new_card_previous_balance"
              label="Saldo anterior"
              help="Con cuánto venía la tarjeta ANTES de este resumen. No es el total que cierra: ese lo calcula la app sumándole el interés y los consumos de abajo."
              value={cardPrevious}
              onChange={setCardPrevious}
            />

            <div className="mt-5">
              <label
                htmlFor="new_card_annual_rate"
                className="block text-label uppercase text-muted"
              >
                Tasa de interés punitorio anual (%)
              </label>
              <div className="mt-2 flex items-center rounded-surface border border-border-input bg-surface px-3">
                <input
                  id="new_card_annual_rate"
                  name="new_card_annual_rate"
                  inputMode="decimal"
                  autoComplete="off"
                  value={cardRate}
                  onChange={(e) => setCardRate(e.target.value)}
                  placeholder="98,03"
                  className="min-h-touch w-full bg-transparent font-mono text-[15px] text-ink outline-none placeholder:text-muted"
                />
                <span className="font-mono text-[15px] text-muted" aria-hidden>
                  %
                </span>
              </div>
              {cardMonthlyRate != null ? (
                <p className="help mt-1.5">
                  La anual, del resumen. Para calcular vamos a usar la{" "}
                  <strong>mensual que él mismo declara, {formatArgNumber(cardMonthlyRate)}%</strong>:
                  el banco no la saca dividiendo la anual por doce, y la diferencia es de un
                  1,4% todos los meses.
                </p>
              ) : (
                <p className="help mt-1.5">La anual, no la del mes. Es la que mueve todo el cálculo.</p>
              )}
            </div>

            <div className="mt-5">
              <CalendarField
                id="new_card_due_day"
                name="new_card_due_day"
                label="Día de vencimiento (1–31)"
                mode="day"
                value={cardDueDay}
                onChange={setCardDueDay}
                kicker="Día de vencimiento"
                note="Se repite todos los meses. Elegí el día en que cierra el resumen."
              />
            </div>
          </div>
        )}

        <div className="mt-5">
          <CalendarField
            id="period"
            name="period"
            label="Mes del resumen"
            mode="month"
            value={period}
            onChange={setPeriod}
            kicker="Mes del resumen"
            note="El período que cierra este resumen."
          />
        </div>

        {usdWarning && (
          <div className="mt-5 rounded-surface border border-gold-border bg-gold-bg px-3 py-3">
            <p className="text-[12px] font-semibold text-gold-ink">Ojo con los dólares</p>
            <p className="mt-1 text-[11.5px] text-gold-ink">
              En el resumen de {describeCalendarValue("month", usdWarning.period).toLowerCase()}{" "}
              había {formatUsd(usdWarning.balance)} que ya
              sumamos al saldo en pesos, a {formatMoney(usdWarning.rate)} cada uno. Si no los
              pagaste, el banco los convierte él y te los unifica con los pesos en este resumen:{" "}
              <strong>no los cargues otra vez en “consumos nuevos”</strong>. Si los convirtió a
              otra cotización, lo único que va acá es la diferencia.
            </p>
          </div>
        )}

        <MoneyField
          id="new_charges"
          label="Consumos nuevos del mes"
          help="Todo lo que el banco te cargó este mes, CUOTAS INCLUIDAS. El resumen lo trae sumado en su línea de “Total Consumos”. Antes acá decía que no incluyeras las cuotas porque el sistema ya las tenía: no es cierto — se guardan aparte, para la lista y la proyección, y nunca entraban al saldo."
          value={newCharges}
          onChange={setNewCharges}
        />
        {/*
          Lo que el resumen cobra encima de los consumos. Se reconstruyeron
          seis resumenes reales de dos bancos y los seis cierran EXACTO con
          estos terminos; antes de tenerlos, el cierre daba siempre por debajo
          del real y no habia forma de ver por que.

          Van adentro de un <details> y no sueltos porque salen del PDF ya
          cargados: quien sube el resumen no tiene que tocarlos. El que carga a
          mano los abre.
        */}
        <details
          className="group mt-5 rounded-surface-lg border border-border bg-surface-sunken px-4 py-3"
          open={chargesOpen}
          onToggle={(e) => setChargesOpen((e.currentTarget as HTMLDetailsElement).open)}
        >
          <summary className="inline-flex min-h-touch cursor-pointer list-none items-center gap-1.5 text-card text-pine hover:text-leaf">
            Intereses, impuestos y cuotificación
            <Chevron className="group-open:rotate-180" />
          </summary>

          <p className="help mt-1">
            Los trae el PDF. Si cargás a mano, están en el resumen: los intereses como
            “INTERESES FINANCIACIÓN”, y los impuestos repartidos en varios renglones (IVA,
            sellos, IIBB, percepciones).
          </p>

          <MoneyField
            id="interest"
            label="Intereses del período"
            help="Lo que el banco dice haber cobrado. Vacío: lo estimamos con la tasa sobre el saldo, que da de más — el banco cobra sobre la parte financiada, no sobre el total."
            value={interest}
            onChange={setInterest}
          />

          <MoneyField
            id="other_charges"
            label="Impuestos y otros cargos"
            help="IVA sobre los intereses, IVA de los planes en cuotas, sellos, IIBB, percepciones y adelantos. En los resúmenes reales van de $ 59.000 a $ 663.000."
            value={otherCharges}
            onChange={setOtherCharges}
          />

          <MoneyField
            id="credits"
            label="Cuotificación y otros créditos"
            help="Lo que el banco sacó del saldo sin que sea un pago tuyo. Si te cuotificaron el saldo, acá va lo que salió de la tarjeta y pasó a cuotas fijas."
            value={credits}
            onChange={setCredits}
          />
        </details>

        {/*
          Los dolares, que antes quedaban afuera del saldo con un aviso que
          decia "cargalos a mano" y no decia donde. Se pagan a la cotizacion del
          cierre y el PDF no la trae, asi que la unica salida honesta es
          pedirla: convertir con un numero inventado por nosotros seria peor
          que no sumarlos.
        */}
        <details
          className="group mt-5 rounded-surface-lg border border-border bg-surface-sunken px-4 py-3"
          open={usdOpen}
          onToggle={(e) => setUsdOpen((e.currentTarget as HTMLDetailsElement).open)}
        >
          <summary className="inline-flex min-h-touch cursor-pointer list-none items-center gap-1.5 text-card text-pine hover:text-leaf">
            Consumos en dólares
            <Chevron className="group-open:rotate-180" />
          </summary>

          <p className="help mt-1">
            Si el resumen cierra con un total en dólares, poné acá cuánto es y a qué cotización
            lo pagaste. Con las dos cosas entran al saldo como un consumo más. Sin la
            cotización no los podemos convertir y quedan afuera.
          </p>

          <div className="mt-4">
            <label htmlFor="usd_balance" className="block text-label uppercase text-muted">
              Total en dólares del resumen
            </label>
            <div className="mt-2 flex items-center rounded-surface border border-border-input bg-surface px-3">
              <span className="font-mono text-[15px] text-muted" aria-hidden>
                US$
              </span>
              <input
                id="usd_balance"
                name="usd_balance"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0,00"
                value={usdBalance}
                onChange={(e) => setUsdBalance(e.target.value)}
                className="min-h-touch w-full bg-transparent px-2 font-mono text-[15px] text-ink outline-none placeholder:text-muted"
              />
            </div>
            <p className="help mt-1.5">El que dice el resumen, no la suma de los consumos.</p>
          </div>

          <MoneyField
            id="usd_rate"
            label="Cotización del dólar"
            help="A cuánto se pagó cada dólar. El resumen no la trae — mirá el débito de tu cuenta, o traé la de hoy y corregila si hace falta."
            value={usdRate}
            onChange={(v) => {
              setUsdRate(v);
              // Escrita a mano deja de ser la que trajimos: la nota mentiría.
              setRateNote(null);
            }}
          />

          <button
            type="button"
            onClick={pickTodaysRate}
            disabled={rateBusy}
            className="mt-2 inline-flex min-h-touch items-center gap-2 rounded-pill border border-border-input bg-surface px-3 text-[12px] font-semibold text-pine transition-colors duration-150 ease-sd hover:border-pine disabled:opacity-60"
          >
            {rateBusy && <Spinner className="text-teal" />}
            Usar la cotización de hoy
          </button>

          {rateNote && <p className="help mt-1.5">{rateNote}</p>}

          {usdInPesos > 0 && (
            <p className="mt-3 text-[12px] text-leaf-deep">
              Entran{" "}
              <span className="font-mono font-semibold">{formatMoney(usdInPesos)}</span> al saldo:{" "}
              {formatUsd(parseArgNumber(usdBalance) ?? 0)} × {formatMoney(parseArgNumber(usdRate) ?? 0)}.
            </p>
          )}
        </details>

        <MoneyField
          id="minimum_payment"
          label="Pago mínimo del resumen"
          help="El que exige el banco. Es el que usamos para avisarte si el saldo va a crecer."
          value={minimum}
          onChange={setMinimum}
        />
        <MoneyField
          id="amount_paid"
          label="Cuánto pagaste"
          help="Si pagás menos que el mínimo se suma un punitorio del 3% sobre la diferencia. Dejalo en cero si todavía no pagaste."
          value={paid}
          onChange={(v) => {
            setPaid(v);
            setPayKind("variable");
          }}
        />

        <fieldset className="mt-5">
          <legend className="text-label uppercase text-muted">Tipo de pago</legend>
          {/*
            Tres columnas iguales, no una fila que envuelve. Con la etiqueta
            larga —"Pago variable (lo que pude pagar)"— los tres no entraban y
            quedaban escalonados: dos arriba y uno abajo, cada uno de un ancho
            distinto. La etiqueta se acortó y lo que decía el paréntesis pasó a
            la ayuda, que es donde no empuja a nadie.
          */}
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {PAY_KINDS.map((k) => {
              /*
                Los dos atajos escriben "cuánto pagaste", así que solo se
                pueden usar cuando existe el número que van a escribir: el
                mínimo sale del campo de arriba y el total sale del saldo de
                la tarjeta. Antes los dos dependían de la tarjeta, y "Pago
                mínimo" quedaba apagado incluso con el mínimo ya cargado.
              */
              const blocked =
                (k.value === "minimo" && parseMoney(minimum) <= 0) ||
                (k.value === "total" && !card);

              return (
                <button
                  key={k.value}
                  type="button"
                  onClick={() => pickPayKind(k.value)}
                  aria-pressed={payKind === k.value}
                  disabled={blocked}
                  className="flex min-h-touch items-center justify-center rounded-pill border px-2 text-center text-[12px] font-semibold leading-tight transition-colors duration-150 ease-sd disabled:opacity-50"
                  style={{
                    backgroundColor: payKind === k.value ? "#0E3A31" : "#FFFFFF",
                    borderColor: payKind === k.value ? "#0E3A31" : "#DEE3DD",
                    color: payKind === k.value ? "#FFFFFF" : "#5C6B65",
                  }}
                >
                  {k.label}
                </button>
              );
            })}
          </div>

          {/*
            Un botón gris sin explicación es un callejón: se ve que no se
            puede y no se ve por qué. Acá se dice qué falta para destrabarlo.
          */}
          {blockedHint && <p className="help mt-1.5">{blockedHint}</p>}
        </fieldset>

        {card && preview && previousBalance > 0 && (
          <StatementPreview
            card={card}
            previousBalance={previousBalance}
            close={preview}
            bankBalance={parsed?.ok ? (parsed.statementBalance ?? null) : null}
          />
        )}

        {state.message && (
          <div
            role="alert"
            className="mt-5 rounded-surface border px-3 py-3"
            style={{
              backgroundColor: needsConfirm ? "#FCF4E7" : "#FFE9E4",
              borderColor: needsConfirm ? "#EBD9B8" : "#F2C7BE",
            }}
          >
            <p
              className="text-[12px] font-semibold"
              style={{ color: needsConfirm ? "#A77530" : "#8E3B2C" }}
            >
              {needsConfirm ? "Ojo con el doble conteo" : "No se pudo guardar"}
            </p>
            <p
              className="mt-1 text-[11.5px]"
              style={{ color: needsConfirm ? "#7A5116" : "#823123" }}
            >
              {state.message}
            </p>

            {state.pendingDuplicates && (
              <>
                <ul className="mt-2 space-y-1">
                  {state.pendingDuplicates.map((expense) => (
                    <li
                      key={expense.id}
                      className="flex justify-between gap-3 text-[11.5px] text-gold-ink"
                    >
                      <span className="truncate">{expense.description}</span>
                      <span className="shrink-0 font-mono">{formatMoney(expense.amount)}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] text-gold-ink">
                  Si confirmás, estos gastos se archivan: dejan de sumar al saldo porque el
                  resumen ya los trae adentro. No se borran — podés recuperarlos desde la lista
                  de gastos si el resumen no los incluía.
                </p>
              </>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-6 flex min-h-touch w-full items-center justify-center gap-2 rounded-pill bg-teal px-[14px] py-[11px] text-card text-white transition-colors duration-150 ease-sd hover:bg-teal-hover disabled:opacity-70"
        >
          {pending && <Spinner className="text-white" />}
          {needsConfirm
            ? "Entiendo, archivar esos gastos y guardar"
            : creatingCard
              ? "Crear la tarjeta y agregar el resumen"
              : "Agregar resumen"}
        </button>
      </form>
    </>
  );
}

type PayKind = "variable" | "minimo" | "total";

/**
 * Las etiquetas son de dos palabras para que los tres botones midan lo mismo.
 * Lo que decía "Pago variable (lo que pude pagar)" ahora vive en la ayuda: en
 * el botón obligaba a que los otros dos quedaran chiquitos al lado, o a que la
 * fila se partiera en dos renglones desparejos.
 */
const PAY_KINDS: { value: PayKind; label: string }[] = [
  { value: "variable", label: "Pago variable" },
  { value: "minimo", label: "Pago mínimo" },
  { value: "total", label: "Pago total" },
];

/**
 * Cómo queda la tarjeta si se guarda esto.
 *
 * Sale de la misma función que va a correr el servidor, no de una segunda
 * cuenta: si difirieran, el número que decide el pago sería distinto del que
 * termina guardado. Y el punitorio se nombra cuando aparece, porque un saldo
 * que sube $ 9.000 más de lo esperado sin decir por qué es exactamente la
 * clase de sorpresa que esta app existe para evitar.
 */
function StatementPreview({
  card,
  previousBalance,
  close,
  bankBalance,
}: {
  card: StatementCard;
  /**
   * El mismo saldo anterior con el que se hizo la cuenta. Va aparte de la
   * tarjeta porque no siempre es su saldo base: neto de pagos en un resumen
   * nuevo, y el que guardo el resumen cuando se lo esta corrigiendo.
   */
  previousBalance: number;
  close: ReturnType<typeof closeStatement>;
  /**
   * El saldo con el que el resumen dice que cierra, cuando se subio el PDF.
   *
   * Es el dato del banco y hasta ahora se mostraba arriba, en la ficha de lo
   * que se leyo, sin compararlo nunca con el nuestro. Teniendolo al lado, una
   * diferencia se ve sola; sin comparar, hay que darse cuenta de memoria. Asi
   * se descubrio que el cierre no contaba las cuotas del mes: a ojo, mirando
   * los dos numeros en pantallas distintas.
   */
  bankBalance: number | null;
}) {
  return (
    <div className="mt-5 rounded-surface-lg border border-border bg-surface-sunken px-4 py-3">
      <div className="text-label uppercase text-muted">Cómo queda {card.name}</div>

      <div className="mt-2 space-y-1">
        <PreviewRow label="Saldo anterior" value={formatMoney(previousBalance)} />
        <PreviewRow label="Interés del mes" value={formatMoney(close.interest)} />
        {close.usdCharges > 0 && (
          <PreviewRow label="Consumos en dólares" value={formatMoney(close.usdCharges)} />
        )}
        {close.otherCharges > 0 && (
          <PreviewRow label="Impuestos y otros cargos" value={formatMoney(close.otherCharges)} />
        )}
        {close.credits > 0 && (
          <PreviewRow
            label="Cuotificación (sale del saldo)"
            value={`−${formatMoney(close.credits)}`}
          />
        )}
        {close.lateFee > 0 && (
          <PreviewRow
            label="Punitorio por pagar menos que el mínimo"
            value={formatMoney(close.lateFee)}
            tone="brick"
          />
        )}
      </div>

      <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-border-row pt-2">
        <span className="text-card text-ink">Nuevo saldo</span>
        <span className="text-right">
          <span className="block font-mono text-[15px] font-semibold text-ink">
            {formatMoney(close.newBalance)}
          </span>
          <span
            className="block font-mono text-[11px]"
            style={{ color: close.delta > 0 ? "#823123" : "#175F42" }}
          >
            {close.delta > 0 ? "+" : ""}
            {formatMoney(close.delta)}
          </span>
        </span>
      </div>

      {/*
        El saldo del banco al lado del nuestro, cuando el PDF lo trajo.
        Coincidir no esta garantizado —el banco cobra impuestos que este
        modelo no tiene, y calcula el interes sobre el saldo financiado y no
        sobre el total— asi que la diferencia se nombra en vez de esconderla.
        Es el numero que hay que mirar antes de guardar.
      */}
      {bankBalance != null && bankBalance > 0 && (
        <div className="mt-2 border-t border-border-row pt-2">
          <PreviewRow label="El resumen dice que cierra en" value={formatMoney(bankBalance)} />
          {Math.abs(bankBalance - close.newBalance) >= 1 && (
            <p className="help mt-1.5" style={{ color: "#823123" }}>
              Nuestra cuenta da {formatMoney(Math.abs(bankBalance - close.newBalance))}{" "}
              {close.newBalance < bankBalance ? "menos" : "más"} que el resumen. Revisá los
              consumos y cuánto pagaste antes de guardar: lo que se guarda es nuestra cuenta.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function PreviewRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "brick";
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[11.5px]" style={{ color: tone === "brick" ? "#823123" : "#5C6B65" }}>
        {label}
      </span>
      <span
        className="shrink-0 font-mono text-[13px]"
        style={{ color: tone === "brick" ? "#823123" : "#12211D" }}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * Lo que salió del PDF, incluido lo que NO salió. Los avisos del parser se
 * muestran tal cual: son la diferencia entre "el resumen dice cero" y "no
 * pudimos leerlo", que para un saldo no es lo mismo.
 */
function ParseSummary({ parsed }: { parsed: ParseResult }) {
  const rows = [
    {
      label: "Saldo del resumen",
      value:
        parsed.statementBalance != null ? formatMoney(parsed.statementBalance) : "no se pudo leer",
      missing: parsed.statementBalance == null,
    },
    {
      label: "Consumos del período",
      value: parsed.newCharges != null ? formatMoney(parsed.newCharges) : "no se pudo leer",
      missing: parsed.newCharges == null,
    },
    {
      label: "Pago mínimo",
      value: parsed.minimumPayment != null ? formatMoney(parsed.minimumPayment) : "no se pudo leer",
      missing: parsed.minimumPayment == null,
    },
    {
      label: "Vencimiento",
      value: parsed.dueDate ?? "no se pudo leer",
      missing: !parsed.dueDate,
    },
  ];

  return (
    <div className="mt-3 rounded-surface border border-border bg-surface px-3 py-3">
      <p className="text-[11.5px] font-semibold text-leaf-deep">Leímos {parsed.fileName}</p>

      <dl className="mt-2">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-3 py-1">
            <dt className="text-[11.5px] text-muted">{row.label}</dt>
            <dd
              className="font-mono text-[11.5px]"
              style={{ color: row.missing ? "#A77530" : "#12211D" }}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>

      {parsed.installments && parsed.installments.length > 0 && (
        <p className="mt-2 border-t border-border-row pt-2 text-[11px] text-muted">
          {parsed.installments.length === 1
            ? "Encontramos 1 compra en cuotas"
            : `Encontramos ${parsed.installments.length} compras en cuotas`}{" "}
          por {formatMoney(parsed.installments.reduce((s, i) => s + i.installmentAmount, 0))} este
          mes. Se guardan al confirmar.
        </p>
      )}

      {/*
        Se muestra el total que declara el resumen, no la suma de las líneas
        que pudimos leer: la extracción por coordenadas deja algunas sin
        importe, y el faltante se vería como "gastaste menos en dólares".
      */}
      {parsed.usdBalance != null && parsed.usdBalance > 0 && (
        <p className="mt-2 text-[11px] text-gold-ink">
          El resumen cierra con {formatUsd(parsed.usdBalance)} en dólares. Los pusimos en
          “Consumos en dólares”, acá abajo: falta la cotización a la que los pagaste, porque el
          resumen no la trae. Con ella entran al saldo; sin ella quedan afuera.
        </p>
      )}

      {parsed.warnings && parsed.warnings.length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-border-row pt-2">
          {parsed.warnings.map((warning) => (
            <li key={warning} className="text-[11px] text-gold-ink">
              {warning}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MoneyField({
  id,
  label,
  help,
  value,
  onChange,
}: {
  id: string;
  label: string;
  help: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="mt-5">
      <label htmlFor={id} className="block text-label uppercase text-muted">
        {label}
      </label>
      <div className="mt-2 flex items-center rounded-surface border border-border-input bg-surface px-3">
        <span className="font-mono text-[15px] text-muted" aria-hidden>
          $
        </span>
        <input
          id={id}
          name={id}
          inputMode="numeric"
          autoComplete="off"
          placeholder="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-touch w-full bg-transparent px-2 font-mono text-[15px] text-ink outline-none placeholder:text-muted"
        />
      </div>
      <p className="help mt-1.5">{help}</p>
    </div>
  );
}
