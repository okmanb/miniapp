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
import { formatIsoDate } from "@/lib/calc/dates";
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
  /** Los pagos que declara el resumen, cuando hay que cargarlos a mano. */
  const [pagosDelBanco, setPagosDelBanco] = useState("");
  /**
   * Editar a mano los numeros que trajo el PDF.
   *
   * Apagado por defecto: lo que dice el resumen es del banco y no hay nada que
   * decidir. Pero el lector esta atado a la maquetacion de cada banco y se
   * rompe cuando la cambian, asi que tiene que haber una salida — una que se
   * elija a proposito y no un campo abierto invitando a tocar.
   */
  const [corrigiendo, setCorrigiendo] = useState(false);
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
  /**
   * El pago que declara el PDF, si lo declara.
   *
   * No es lo mismo que lo que está escrito en "cuánto pagaste": el campo se
   * puede editar, y los atajos de tipo de pago lo reescriben. Tenerlos
   * separados es lo que permite avisar cuando dejaron de coincidir.
   */
  const pagoDeclarado =
    parsed?.ok && parsed.paidInPeriod != null && parsed.paidInPeriod > 0
      ? Math.round(parsed.paidInPeriod)
      : null;

  /**
   * Si los numeros del resumen se muestran como lo que son --datos del banco--
   * o como campos.
   *
   * Con el PDF leido son lectura: el minimo lo fija el banco, los consumos los
   * cargo el banco, el total en dolares lo dice el banco. Preguntarlos, o
   * dejarlos editables al lado de las cosas que si hay que decidir, hacia
   * parecer que habia algo que elegir en cada uno.
   */
  const soloLectura = parsed?.ok === true && !corrigiendo;

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
    /*
     * Lo que el resumen dice que se pago en el periodo NO se escribe en ningun
     * campo: se muestra tal cual y viaja en un hidden. Antes prellenaba
     * "cuanto pagaste", y ahi empezaba la confusion — ese pago es del mes
     * pasado y la pregunta parecia ser por este.
     */
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
      periodPayments: pagoDeclarado ?? parseMoney(pagosDelBanco),
      amountPaid: parseMoney(paid),
      usdCharges: usdInPesos,
      declaredInterest: interest ? parseMoney(interest) : null,
      otherCharges: parseMoney(otherCharges),
      credits: parseMoney(credits),
    });
  }, [
    card,
    previousBalance,
    newCharges,
    minimum,
    paid,
    pagoDeclarado,
    pagosDelBanco,
    usdInPesos,
    interest,
    otherCharges,
    credits,
  ]);

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
          normal no hay nada que escribir.

          Con el PDF leído ni siquiera se muestran acá: el nombre encabeza la
          ficha de abajo, el saldo anterior es su primer renglón, y la tasa y
          el día de vencimiento entran en su bajada. Dos fichas para una
          tarjeta y su resumen eran dos lecturas del mismo papel.
        */}
        {creatingCard && soloLectura && (
          <>
            <input type="hidden" name="new_card_name" value={cardName} />
            <input type="hidden" name="new_card_previous_balance" value={cardPrevious} />
            <input type="hidden" name="new_card_annual_rate" value={cardRate} />
            <input type="hidden" name="new_card_due_day" value={cardDueDay} />
          </>
        )}

        {creatingCard && !soloLectura && (
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

        {/*
          Con el PDF leído, los números del resumen no son campos: viajan acá y
          se muestran una sola vez, abajo, adentro de la cuenta que arman. Una
          ficha con la lista y después otra con la misma lista sumada eran dos
          pantallas para lo mismo.
        */}
        {soloLectura && (
          <>
            <input type="hidden" name="new_charges" value={newCharges} />
            <input type="hidden" name="minimum_payment" value={minimum} />
            <input type="hidden" name="usd_balance" value={usdBalance} />
            {pagoDeclarado != null && (
              <input type="hidden" name="period_payments" value={pagoDeclarado} />
            )}
          </>
        )}

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

        {!soloLectura && (
          <>
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
          </>
        )}

        {!soloLectura && (
          <>
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

          <CotizacionDelDolar
            value={usdRate}
            onChange={(v) => {
              setUsdRate(v);
              // Escrita a mano deja de ser la que trajimos: la nota mentiría.
              setRateNote(null);
            }}
            onHoy={pickTodaysRate}
            busy={rateBusy}
            note={rateNote}
            enPesos={usdInPesos}
            usd={parseArgNumber(usdBalance) ?? 0}
          />
        </details>
          </>
        )}

        {!soloLectura && (
          <>
        <MoneyField
          id="minimum_payment"
          label="Pago mínimo del resumen"
          help="El que exige el banco. Es el que usamos para avisarte si el saldo va a crecer."
          value={minimum}
          onChange={setMinimum}
        />
        {/*
          El pago que el banco ya tomó: dato, no pregunta.

          Es la línea "SU PAGO" del PDF y se pagó el mes pasado, contra el
          resumen anterior. El banco ya lo restó para llegar a su saldo de
          cierre, así que acá no hay nada que decidir — se muestra para que la
          cuenta se pueda seguir, igual que el interés o los impuestos.

          Cuando el PDF no lo trae (carga a mano) sí se pide: sin ese número el
          cierre da de más por el monto exacto de lo que se pagó.
        */}
        {pagoDeclarado != null ? (
          <div className="mt-5 rounded-surface border border-border bg-surface-sunken px-4 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-label uppercase text-muted">Pagos que ya tomó el banco</span>
              <span className="num text-[15px] font-semibold text-ink">
                −{formatMoney(pagoDeclarado)}
              </span>
            </div>
            <p className="help mt-1.5">
              Lo trae el resumen y ya está descontado del saldo con el que cierra. Se pagó
              durante el período que cerró, así que no es el pago de este resumen.
            </p>
            <input type="hidden" name="period_payments" value={pagoDeclarado} />
          </div>
        ) : (
          <MoneyField
            id="period_payments"
            label="Pagos que ya tomó el banco"
            help="La línea «SU PAGO» del resumen, que el banco ya descontó del saldo de cierre. Dejalo en cero si el resumen no trae ninguno."
            value={pagosDelBanco}
            onChange={setPagosDelBanco}
          />
        )}

          </>
        )}

        {/*
          Con el PDF leido, de los dolares falta una sola cosa: a cuanto se
          pagaron. El total lo dice el resumen --esta arriba, en la ficha-- y
          la cotizacion no la trae ningun banco: la fija el dia del debito.

          Sin ella los dolares quedan afuera del saldo, asi que el campo no se
          esconde adentro de un desplegable como cuando hay que cargar todo a
          mano: es una de las dos cosas que de verdad hay que completar.
        */}
        {soloLectura && (parseArgNumber(usdBalance) ?? 0) > 0 && (
          <div className="mt-5">
            <CotizacionDelDolar
              value={usdRate}
              onChange={(v) => {
                setUsdRate(v);
                setRateNote(null);
              }}
              onHoy={pickTodaysRate}
              busy={rateBusy}
              note={rateNote}
              enPesos={usdInPesos}
              usd={parseArgNumber(usdBalance) ?? 0}
            />
          </div>
        )}

        {/*
          Y este es el otro pago: el de ESTE resumen, que vence el mes que
          viene. Cero es la respuesta normal al cargarlo.

          Antes los dos compartían un solo campo llamado "Cuánto pagaste", y
          preguntaba por algo que todavía no había pasado: lo que el PDF traía
          era el pago del mes anterior. Quien leía la pregunta y respondía con
          la verdad —"todavía no lo pagué", cero— dejaba la tarjeta $ 1.798.840
          por encima de lo que decía el banco.
        */}
        <MoneyField
          id="amount_paid"
          label="Registrar un pago de este resumen"
          help="Dejalo en cero si todavía no lo pagaste: lo vas a poder registrar cuando pagues. Si ya lo pagaste, poné cuánto y queda con fecha de hoy."
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
            tarjetaNueva={
              creatingCard
                ? { anual: cardRate, mensual: cardMonthlyRate, dia: cardDueDay }
                : null
            }
            newCharges={parseMoney(newCharges)}
            minimumPayment={parseMoney(minimum)}
            bankBalance={parsed?.ok ? (parsed.statementBalance ?? null) : null}
            dueDate={parsed?.ok ? (parsed.dueDate ?? null) : null}
            installments={parsed?.ok ? (parsed.installments ?? null) : null}
            onCorregir={soloLectura ? () => setCorrigiendo(true) : null}
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
          className="mt-6 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-pill bg-teal px-[14px] py-[11px] text-card text-white transition-colors duration-150 ease-sd hover:bg-teal-hover disabled:opacity-70"
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
  tarjetaNueva,
  newCharges,
  minimumPayment,
  bankBalance,
  dueDate,
  installments,
  onCorregir,
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
  /**
   * Cuando la tarjeta se está creando con este resumen, lo suyo que la cuenta
   * no dice: la tasa y el día de vencimiento. El nombre ya encabeza la ficha y
   * el saldo anterior es su primer renglón.
   */
  tarjetaNueva: { anual: string; mensual: number | null; dia: string } | null;
  /** Los consumos del mes, que son parte de la cuenta y faltaban. */
  newCharges: number;
  /** El mínimo que exige el banco: no entra en la cuenta, pero es del resumen. */
  minimumPayment: number;
  dueDate: string | null;
  installments: { installmentAmount: number }[] | null;
  /** Con PDF, la salida a corregir lo leído. Sin PDF no hay nada que corregir. */
  onCorregir: (() => void) | null;
}) {
  const cuotas = installments ?? [];
  const cuotasTotal = cuotas.reduce((suma, cuota) => suma + cuota.installmentAmount, 0);
  const diferencia = bankBalance != null ? bankBalance - close.grossBalance : 0;
  return (
    <div className="mt-5 rounded-surface-lg border border-border bg-surface-sunken px-4 py-3">
      {/*
        Una sola ficha con la cuenta entera.
        
        Antes eran cuatro cajas que decían casi lo mismo: la de "leímos el
        PDF", la de "lo que dice el resumen", la de la tarjeta nueva y esta. Los
        mismos seis números escritos tres veces no se leen tres veces: se
        saltean. Acá aparecen una vez, en el orden en que el banco los suma.
      */}
      <div className="text-label uppercase text-muted">Cómo queda {card.name}</div>

      {/*
        La tarjeta se crea con este resumen, así que lo que la define va acá y
        no en una ficha aparte: la tasa con la que se va a calcular todos los
        meses y el día que vence.
      */}
      {tarjetaNueva && (
        <p className="help mt-1">
          Se crea con este resumen
          {tarjetaNueva.mensual != null
            ? `, calculando con el ${formatArgNumber(tarjetaNueva.mensual)}% mensual que él declara`
            : tarjetaNueva.anual
              ? `, al ${tarjetaNueva.anual}% anual`
              : ""}
          {/* El día solo si el pie no muestra ya la fecha de este vencimiento:
              "vence el día 7" arriba y "vence el 7 de septiembre" abajo son el
              mismo dato dicho dos veces. */}
          {tarjetaNueva.dia && !dueDate ? `, y vence el día ${tarjetaNueva.dia}` : ""}.
        </p>
      )}

      <div className="mt-2 space-y-1">
        <PreviewRow label="Saldo anterior" value={formatMoney(previousBalance)} />
        {/* El pago del banco va arriba, donde el banco lo pone: se resta del
            saldo anterior antes de que empiecen a sumar los cargos. */}
        {close.periodPayments > 0 && (
          <PreviewRow
            label="Pagos que ya tomó el banco"
            value={`−${formatMoney(close.periodPayments)}`}
          />
        )}
        {newCharges > 0 && (
          <PreviewRow label="Consumos del mes" value={formatMoney(newCharges)} />
        )}
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

      {/*
        El cierre primero y el pago tuyo después, en ese orden, porque ese es
        el orden de los hechos: el resumen cierra en un número que el banco ya
        decidió, y recién después la persona paga algo contra él.
      */}
      <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-border-row pt-2">
        <span className="text-card text-ink">Cierra en</span>
        <span className="text-right">
          <span className="block font-mono text-[15px] font-semibold text-ink">
            {formatMoney(close.grossBalance)}
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

      {close.grossBalance !== close.newBalance && (
        <div className="mt-2 space-y-1 border-t border-border-row pt-2">
          <PreviewRow
            label="Tu pago de este resumen"
            value={`−${formatMoney(close.grossBalance - close.newBalance)}`}
          />
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-card text-ink">Te queda debiendo</span>
            <span className="num text-[15px] font-semibold text-ink">
              {formatMoney(close.newBalance)}
            </span>
          </div>
        </div>
      )}

      {/*
        El saldo del banco al lado del nuestro, cuando el PDF lo trajo.
        Coincidir no está garantizado —el banco cobra impuestos que este modelo
        no tiene, y calcula el interés sobre el saldo financiado y no sobre el
        total— así que la diferencia se nombra en vez de esconderla.

        Pero se nombra en el tono que corresponde. Estaba en rojo y a tres
        renglones, y eso hacía leer un error donde había una diferencia
        esperable: $ 47.000 sobre ocho millones es el 0,6%. El rojo queda para
        cuando la diferencia es grande de verdad; por debajo del 1% es un
        renglón más, en gris.
      */}
      {bankBalance != null && bankBalance > 0 && (
        <div className="mt-2 border-t border-border-row pt-2">
          <PreviewRow label="El resumen dice que cierra en" value={formatMoney(bankBalance)} />
          {Math.abs(diferencia) >= 1 && (
            <p
              className="help mt-1.5"
              style={{ color: Math.abs(diferencia) > bankBalance * 0.01 ? "#823123" : undefined }}
            >
              {Math.abs(diferencia) > bankBalance * 0.01
                ? `Son ${formatMoney(Math.abs(diferencia))} de diferencia: revisá los consumos y los pagos antes de guardar.`
                : `Nuestra cuenta da ${formatMoney(Math.abs(diferencia))} ${
                    diferencia > 0 ? "menos" : "más"
                  } — el banco cobra cargos que no publica renglón por renglón.`}
            </p>
          )}
        </div>
      )}

      {/*
        El pie: lo que el resumen dice y la cuenta no usa. El mínimo no entra
        en el cierre —es lo que el banco exige, no lo que cobra— y las cuotas
        ya vienen adentro de los consumos: nombrarlas es para que se vea que se
        guardan, no para sumarlas otra vez.
      */}
      {(minimumPayment > 0 || dueDate || cuotas.length > 0) && (
        <div className="mt-2 space-y-1 border-t border-border-row pt-2">
          {minimumPayment > 0 && (
            <PreviewRow label="Pago mínimo del resumen" value={formatMoney(minimumPayment)} />
          )}
          {/* En castellano y no en ISO: "2026-10-07" es el formato del PDF, no
              el de nadie que lo lea. */}
          {dueDate && <PreviewRow label="Vence el" value={formatIsoDate(dueDate)} />}
          {cuotas.length > 0 && (
            <PreviewRow
              label={`${cuotas.length} ${cuotas.length === 1 ? "compra" : "compras"} en cuotas`}
              value={formatMoney(cuotasTotal)}
            />
          )}
        </div>
      )}

      {onCorregir && (
        <button
          type="button"
          onClick={onCorregir}
          className="mt-3 inline-flex min-h-touch items-center text-[12px] text-pine underline underline-offset-2 hover:text-leaf"
        >
          Alguno no coincide con mi resumen
        </button>
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
 * Que el PDF se leyó, y lo que no se pudo leer de él.
 *
 * Antes era una tabla con el saldo, los consumos, el mínimo y el vencimiento,
 * más un párrafo sobre los dólares y otros dos comparando lo declarado contra
 * lo que se pudo leer línea por línea. Todo eso ya está abajo, en la cuenta
 * del resumen, y algunos de esos números aparecían tres veces en la misma
 * pantalla: escritos tres veces no se leen tres veces, se saltean.
 *
 * Lo que queda es lo único que esta caja puede decir y la de abajo no: que el
 * archivo entró, y qué no pudimos sacarle. Los avisos que sí importan —"no
 * encontramos el pago mínimo, completalo a mano"— siguen acá. Las diferencias
 * entre lo declarado y lo leído línea por línea no: el declarado gana siempre,
 * así que no había nada que hacer con esa información.
 */
function ParseSummary({ parsed }: { parsed: ParseResult }) {
  const faltan = [
    parsed.statementBalance == null && "el saldo de cierre",
    parsed.newCharges == null && "los consumos",
    parsed.minimumPayment == null && "el pago mínimo",
    !parsed.dueDate && "el vencimiento",
  ].filter((x): x is string => typeof x === "string");

  return (
    <div className="mt-3 rounded-surface border border-border bg-surface px-3 py-3">
      <p className="text-[11.5px] font-semibold text-leaf-deep">Leímos {parsed.fileName}</p>

      {faltan.length > 0 ? (
        <p className="mt-1 text-[11px] text-gold-ink">
          No pudimos leer {faltan.join(", ")}. Completalo abajo antes de guardar.
        </p>
      ) : (
        <p className="help mt-1">Los números están abajo, en la cuenta del resumen.</p>
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

/**
 * Un renglón de "lo que dice el resumen": etiqueta a la izquierda, cifra a la
 * derecha, sin caja propia.
 *
 * Deliberadamente igual que los renglones del preview: son la misma clase de
 * cosa —números que ya están decididos— y verlos iguales ahorra tener que
 * darse cuenta de eso.
 */
/**
 * La cotización del dólar: lo único de los dólares que el resumen no trae.
 *
 * Los consumos en dólares se pagan a la cotización del cierre, y el PDF la
 * omite. Convertirlos con un número inventado por nosotros sería peor que no
 * sumarlos, así que se pide — y el botón trae la del día para no obligar a
 * buscarla.
 *
 * Vive en su propio componente porque aparece en dos lugares: adentro del
 * bloque de dólares cuando se carga a mano, y suelto debajo de la ficha del
 * resumen cuando el PDF ya trajo todo lo demás.
 */
function CotizacionDelDolar({
  value,
  onChange,
  onHoy,
  busy,
  note,
  enPesos,
  usd,
}: {
  value: string;
  onChange: (next: string) => void;
  onHoy: () => void;
  busy: boolean;
  note: string | null;
  enPesos: number;
  usd: number;
}) {
  return (
    <>
      <MoneyField
        id="usd_rate"
        label="Cotización del dólar"
        help="A cuánto se pagó cada dólar. El resumen no la trae — mirá el débito de tu cuenta, o traé la de hoy y corregila si hace falta."
        value={value}
        onChange={onChange}
      />

      <button
        type="button"
        onClick={onHoy}
        disabled={busy}
        className="mt-2 inline-flex min-h-[51px] items-center gap-2 rounded-pill border border-border-input bg-surface px-3 text-[12px] font-semibold text-pine transition-colors duration-150 ease-sd hover:border-pine disabled:opacity-60"
      >
        {busy && <Spinner className="text-teal" />}
        Usar la cotización de hoy
      </button>

      {note && <p className="help mt-1.5">{note}</p>}

      {enPesos > 0 && (
        <p className="mt-3 text-[12px] text-leaf-deep">
          Entran <span className="font-mono font-semibold">{formatMoney(enPesos)}</span> al saldo:{" "}
          {formatUsd(usd)} × {formatMoney(enPesos / usd)}.
        </p>
      )}
    </>
  );
}

function DatoDelResumen({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[12px] text-muted">{label}</span>
      <span className="num text-[12.5px] text-ink">{value}</span>
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
