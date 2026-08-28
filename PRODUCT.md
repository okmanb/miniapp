# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: a person in Argentina juggling several active debts across multiple
entities (banks, MercadoPago, informal debts with family) who is in real
financial distress. This product's spec was written directly from a 4+ hour
session where the user manually reconstructed their own situation in Excel —
8 active debts across 4 entities — so the primary user's job is not
hypothetical: it is this exact user, today.

Secondary (confirmed, not yet built for): other people in a similar
financial-distress situation, if the product is offered beyond personal use.
The repo ("Mini App Factory") already ships shared auth (Supabase) and
subscription billing (Stripe + MercadoPago) as boilerplate infrastructure,
unactivated for this specific app — this is evidence of intent, not a
committed multi-tenant product yet.

## Product Purpose

Most people in financial trouble don't have a "can't do math" problem — they
have a "can't keep state updated" problem. Every time a new fact appears (a
bank statement, a message, a decision), everything downstream — cash flow,
alerts, projections — has to recalculate correctly, and by hand that breaks.
The product is not a calculator; it's a state that stays consistent
automatically as real life changes, with explicit traceability of what's
confirmed data versus what's estimated.

## Positioning

Not a generic budget app. It encodes integrity rules the user discovered by
actually doing this by hand and getting them wrong — rules a generic
budgeting tool has no reason to know exist:

- Never double-count the current month between "real balance already
  reflects this" and "projected result for the same period."
- Never count the same payment twice across two rows (e.g. a variable
  payment and a "new charges to finance" row for the same card).
- An adjustment that changes going forward applies from its effective month
  on — it never rewrites history.
- A value the user confirms becomes hard data immediately, even if the app
  had it marked as an estimate a moment ago.

It also models Argentine debt reality specifically and in depth: TNA/TEA/CFT
rate types, the real bank minimum-payment formula, Plan V installment
purchases as a distinct financial product, revolving cards paid "whatever's
left" during mora, and bridge loans (sometimes chained: one taken to repay
the last one).

## Operating Context

The user periodically uploads bank statement PDFs (BBVA and Banco Patagonia
formats are parsed automatically; other banks fall back to manual entry with
generic pattern-matching help). They load and adjust debts, split income
(sueldo/adelanto, amounts that can change month to month without changing
the total), and fixed expenses (school, groceries, a payment to an adult
child — some of which move from one card to another over time, or arrive as
a lump arrears split across a few months). They review a projected cash
flow, several months out, anchored to a real account balance they enter by
hand. They compare a base plan against a contingency plan (e.g. "Visa paused
at $0, two bridge loans") without either overwriting the other. They watch
for automatically detected alerts (a card's payment isn't covering its own
interest, a due date is imminent, one debt's rate is a outlier) and, on a
card that's become the only payment method still active, categorize its
individual charges as fixed/necessary vs. discretionary to see how much is
genuinely cuttable.

## Capabilities and Constraints

- Stack: Next.js 14 (App Router) + Supabase (Postgres with RLS), already
  built — this round is a visual redesign of an existing, working product,
  not a greenfield build.
- Currency: ARS. Amounts run large (millions of pesos) and rates run high
  (TNA commonly 60–140%) — this is normal for this product's numbers, not a
  data error to soften visually.
- Debt types: tarjeta (revolving), préstamo personal, Plan V / cuotas,
  hipoteca, prendario, informal. Payment behavior per month is one of three
  kinds: cuota fija (known in advance), pago variable (user enters the real
  amount each month), or mínimo estimado (bank formula + a margin the user
  chooses).
- PDF parsing is deliberately narrow and fragile: hand-written regex per
  bank format (BBVA, Banco Patagonia), not AI-based — if a bank changes its
  PDF layout, the parser breaks loudly rather than guessing.
- Alerts are computed only from data the app actually has; it does not
  fabricate a plausible-looking alert from missing data.
- Auth/billing (Stripe, MercadoPago) exist in the shared boilerplate but are
  not wired into this specific app yet — treat as available infrastructure,
  not a confirmed pricing/plan model to design around yet.

## Brand Commitments

None confirmed yet. "Mini App Factory" is the shared boilerplate repo's
name, not a chosen brand for this specific debt/cash-flow product — naming
is open.

## Evidence on Hand

- `01-SPEC.md` at the project root: a full product spec written directly
  from the real reconstruction session (entities, integrity rules, alert
  types, screen-by-screen behavior). Treat it as authoritative product
  truth, not aspirational copy.
- The existing "resumen bancario" visual system in `app/globals.css` (cream
  paper background, serif headers, monospace amounts, muted green/red
  "stamp" colors) is the incumbent look. For this redesign round it is
  evidence and anti-reference, not a constraint to preserve — see the
  user's direction decision below.
- `03-Dashboard.tsx` at the project root is an earlier, never-integrated
  mockup (different navy/mint palette, lucide-react icons not installed) —
  useful only as one discarded exploration, not as a second incumbent
  system to reconcile with the shipped one.
- No real user testimonials, pricing, or case studies exist; none should be
  fabricated.

## Product Principles

1. Never let two numbers silently disagree about the same fact — the
   integrity rules the user paid for in wasted hours become guarantees the
   software enforces automatically.
2. Confirmed data and estimates are never visually interchangeable — a
   guess must always look like a guess.
3. Show the real number even when it's bad. A negative month, a debt that's
   growing, a plan that doesn't close the gap — the design must not soften
   or hide what the numbers actually say.
4. Forward-only corrections — an update changes the future, never quietly
   rewrites the past.
5. Built for Argentine financial reality specifically, not localized from a
   generic international budgeting product.

## Design Direction (from this session)

The incumbent "resumen bancario" look was confirmed earlier by the user as
good and worth keeping — but for this specific redesign round, asked
directly, the user chose to let the direction go bolder rather than only
polish that existing world. Treat the incumbent CSS as anti-reference per
the redesign rule in the skill (keep product truth and function; the old
look does not bind the new one).

## Design Direction (superseding, this session)

The "La Cartelera" dark pizarrón world (built this same session, previously
documented above and in DESIGN.md) was itself superseded before its rollout
finished. The user supplied a concrete reference — a Google Stitch export
("Horizon — Build Limitless Apps," a generic light-glassmorphism AI-app-
builder marketing template) at `design_horizon_saas_template/code.html` —
and asked to replace the entire app's visual system with it. A structured
direction round was run per the design skill: seven candidates grounded in
the audience's actual world were evaluated (libreta de fiado, casa de
cambio, BCRA risk-rating semaphore, AFIP form, resumen bancario, ticket de
supermercado, plus Horizon itself as the pinned literal reading), the dice
assigned "semáforo de riesgo BCRA" as the strongest audience-grounded
direction — but shown both the grounded winner and the pinned reference
side by side, the user explicitly chose Horizon, the standing/canon option,
played straight rather than the grounded alternative.

**Standing brand commitment:** the product's visual identity is the Horizon
world — light ground, frosted-glass surfaces, Plus Jakarta Sans, Material
Symbols icons, pill-radius components, Material-3-flavored token palette
(primary coral `#FF5E3A`, secondary olive `#556500`, tertiary blue
`#326578`, error red `#ba1a1a`) — translated from Horizon's Persuade-mode
marketing-page grammar into this product's Operate-mode surfaces (dense
tables, forms, status groupings), never copied as literal marketing-page
sections. Quality bar for craft/polish: **Stripe Dashboard** (serious
fintech surface, legible data, restrained motion) and **Vercel / v0**
(the AI-builder register closest to Horizon itself — thin borders, subtle
gradients, dark-mode-first discipline carried into a polished light mode).

## Design Direction (superseding again, this session)

Horizon was itself superseded before the rollout finished. Working session
by session, composing each new screen from whichever reference image the
user had just shown (a crypto exchange asset list, an EcoSync insight card)
while keeping Horizon's token language underneath started to visibly read
as a patchwork — the user named this directly ("es una mezcla de horizon
mas otros estilos") and asked whether the design skill had something that
was 100% one coherent style. In parallel the user supplied a second Stitch
export, `stitch_debt_freedom_flow/` — five fully-specified named directions
("Lumina Finance", "Lumina Light", "Lumina High-Impact", "Vivid Velocity",
"Lumina Balanced Impact"), each with real screens for a debt-freedom app
specifically (dashboard, debt list, an AI coach, a "progress" screen), not
a generic SaaS landing page. All five shared one flaw evaluated openly with
the user: they gamify debt payoff — payment "streaks" with fire icons and
a "HOT" badge, a literal glowing 3D tree that grows as a reward, unlockable
achievement badges ("Consistency King", "Debt Destroyer"), a casually-voiced
AI chat coach ("Lumi"). That directly contradicts this product's own
Product Principle #3 (never soften a bad number) for a user in real
financial distress — a broken payment "streak" is not a motivational
mechanic here, it is the normal, honest state of someone's finances some
months, and treating it as a failure to be shamed out of is the wrong
register entirely.

**Standing brand commitment (current):** the product's visual identity is
**Lumina Balanced Impact**, adopted in full — deep institutional teal
primary (`#006b58`), slate-indigo secondary (`#565e74`), teal tertiary
(`#006b5f`), the same error red (`#ba1a1a`) carried over from Horizon,
Geist for display/UI text, **JetBrains Mono specifically for numeric data**
(every currency amount, rate, and date — a deliberate, documented exception
to the "no dedicated mono face" instinct, not a patch), Material Symbols
icons, glass panels, and `rounded-xl` (12px) cards. The gamification layer
(streaks, achievement badges, the growing-tree metaphor, the "Lumi" chat
persona) is explicitly excluded — the "Consistency" slot on the dashboard
is replaced with an honest status summary (mora count, upcoming due dates)
in the same visual language, carried over conceptually from the discarded
Horizon build rather than wasted. Quality bar for craft/polish stays
**Stripe Dashboard** and **Vercel / v0** — unchanged from the prior
commitment, still the right reference for a serious fintech Operate
surface. This is the third and intended-to-be-final direction change this
session; a future session should build strictly within this system rather
than reopening the choice, unless the user raises it again explicitly.

## Session handoff (read this first in a new session)

This is the handoff from the SECOND long session (the one after the one
described in git history / prior handoff, now overwritten here since it's
stale) — ended by explicit request to prepare a clean handoff because the
session was running out of tokens. Read this before doing anything else.

### First priority: verify the unverified change — DONE (next session, 2026-08-28)

The "salud de deuda" header on `app/dashboard/debts/[id]/schedule/page.tsx`
was verified visually in the browser against a real card (Mastercard Banco
Patagonia ...4139): hero-gradient dark panel, TNA/vencimiento/mínimo, the
"pagaste menos del total" warning, the min-vs-double payoff comparison, and
"Actividad reciente" all render correctly and match the Lumina Balanced
Impact system (JetBrains Mono numerals, teal palette, pill badge). The
"gráfico de evolución de saldo" mentioned below does NOT render for this
card — that's correct, not a bug: it's gated on `balanceHistory.length > 1`
and this card only has one saved statement period so far. Screenshot taken
and confirmed with the user's own live login session (no cookie issue this
time).

### What this session built, roughly in order

1. Fixed a real bug: the "Cuotas" progress shown in the debt schedule table
   was `installments_paid` (paid count) displayed under an "N/M" format that
   actually meant "current installment" elsewhere in the app — two screens
   disagreeing about the same fact. Fixed to show `paid + 1`.
2. Combined a card's own balance with its Plan V/Cuotificación children's
   balances into one headline number on the dashboard (`cardBalance`), with
   the breakdown as a secondary line — previously showed only the card's own
   balance with children easy to miss.
3. **Parser fixes in `lib/statement-parser/{bbva,patagonia}.ts`**: BBVA
   didn't recognize `CUOTIFICACION` (Mastercard's equivalent of `VISA PLAN
   V`) or `C.NN/MM` fixed-installment purchases — both were silently swept
   into generic consumption totals. Patagonia had the same gap for `Cuota
   NN/MM`. Also fixed `annual_interest_rate: 0` (a real "no interest" rate)
   being treated as falsy/"unknown" instead of a real value — this broke
   `calculateFixedInstallment` for 0%-interest purchases. Also fixed BBVA's
   "Tasas" punitive-rate line: the real PDF layout puts the label and the
   values on separate lines (pdfjs Y-coordinate grouping), not the same
   line the original regex assumed.
4. **Renamed "Plan V" to something generic** across the app
   (`Refinanciación / cuotas`) since the same debt_type now covers
   BBVA/Mastercard `CUOTIFICACION` and interest-free installment purchases
   too, not just Visa's Plan V. New debts created from a statement are now
   named `Refinanciación (cupón X)` when they carry a real rate, or `Cuota —
   {merchant} (cupón X)` when they don't (merchant description now
   captured and threaded through, `ParsedPlanVEntry.description`).
5. **`DeleteDebtButton.tsx`**: deleting a card now cascades to its Plan V/
   Cuotificación children (confirmed explicit user decision — they're not
   independent without their parent) with an in-app confirmation (NOT
   `window.confirm` — it silently no-ops in this environment and possibly
   others; a React-state two-step confirm replaced it).
6. **`pending_statement_imports` migration (006, already run)**: the PDF
   review flow used to put the entire parsed statement JSON in the URL
   query string (`?data=...`); with a real multi-line statement plus
   Supabase auth cookies this exceeded the server's header size limit and
   silently 431'd — "Crear tarjeta y guardar resumen" looked like it did
   nothing. Now the parsed JSON is stored server-side and only a short
   `?importId=` travels in the URL.
7. **Cashflow page (`app/dashboard/cashflow/page.tsx`) — substantial
   rework**, all verified against the real account:
   - Debts grouped by parent card instead of listed flat.
   - Per-child installment progress now actually advances per projected
     month tab (was frozen at today's value in every tab).
   - `lib/debt-engine/schedule.ts`: fixed a real bug where a fixed-
     installment debt that would finish paying off WITHIN the 6-month
     projection window kept charging the same installment forever instead
     of stopping (`remainingAnalyticInstallments` countdown added).
   - Added a real "add a one-off charge to a card" feature
     (`addCardCharge`/`addOneOffCardCharge` in `charges/actions.ts`, form on
     `charges/page.tsx`, and a generic dashboard-level entry point at
     `app/dashboard/expenses/new` with a fijo/único toggle
     (`ExpenseTypeToggle.tsx`) — reachable from a new "+ Agregar gasto"
     button next to "+ Agregar deuda" on the dashboard, and from "Con qué
     te enfrentás". This is real, confirmed data, not an estimate.
   - `estimatedNewSpendPerMonth` wired into `schedule.ts` so that ad-hoc
     charges and interest actually grow the projected balance (previously
     silently assumed $0 new spending forever after the first statement).
   - **Design decision, confirmed explicitly by the user**: this section's
     framing is "a mes vencido" / "prepárate para lo que viene" — the
     current calendar-month tab represents what you already resolved (the
     last closed statement); anything not yet resolved for a card (both
     the unpaid carry-forward from that statement AND any loose new
     charges) lands together, once, in the NEXT month's tab — never
     repeated in later months. This is implemented but is a **partial**
     version of "correr todo un mes" — only these two specific line items
     shift; the card's own headline "amount to pay" figure still anchors
     to the literal calendar month. If asked to make the whole page's month
     labels shift consistently, that's a separate, larger task (touches
     `HealthRibbon`, the main chart, `personal-cashflow.ts`) — don't assume
     it's already done.
   - `saveCardStatement` (`schedule/actions.ts`) now auto-advances every
     active Plan V/Cuotificación child's `installments_paid` and balance by
     one installment when a genuinely NEW statement period is saved (was
     completely static before — loading real monthly statements never
     touched the children at all). Idempotent per period (re-saving the
     same month doesn't double-advance).
   - "Cronograma de pagos" table now shows Total (from the real statement)
     next to Pagado, not just Pagado alone.
8. **New tokens in `globals.css`**: `--tertiary-container-pale` (pale mint
   for a chip background behind `--tertiary`-colored text — same reasoning
   as the existing `--primary-container-pale`).

### Standing color rule reinforced this session
`--tertiary` (teal claro) is used consistently now for "this is feeding a
projection/estimate, not a closed fact" — pending charges, carried-forward
balances, the confirmation-badge styling. Keep using it that way, don't
introduce a second color for the same meaning.

### Known environment quirks this session hit repeatedly (not project bugs)
- The `Bash` tool is broken by a misconfigured hook
  (`ask-rewrite.py`, corrupted path) — use the `PowerShell` tool for
  anything shell-related instead.
- The Next.js dev server needs manual restarts often (a background `npm run
  dev` job can silently die, or a stale process squats port 3000 and serves
  404s, OR — new this session — after editing a file the dev server can
  throw a phantom "Unexpected token `main`. Expected jsx identifier" error
  pointing at a totally unrelated, valid line (the page's own `<main>` tag)
  — this looked like a real syntax error twice this session but was stale
  webpack/SWC cache both times; `npx tsc --noEmit -p .` is the reliable way
  to check if an edit is actually broken before assuming so and before
  restarting. To restart cleanly: find the PID on port 3000
  (`Get-NetTCPConnection -LocalPort 3000 -State Listen`), `Stop-Process`
  it, then start a fresh `npm run dev` via `Start-Process -FilePath
  cmd.exe -ArgumentList "/c cd /d C:\mini-app-factory && npm run dev >
  dev-server.log 2>&1" -WindowStyle Hidden` (don't use a bare `$pid`
  variable name in PowerShell — it's reserved/read-only, use something
  else like `$listenPid`).
- Next.js dev mode occasionally 404s a route on the very first request
  after a burst of file edits, then serves it correctly on an immediate
  retry — retry once before treating a 404 as real.
- The Browser pane intermittently reports "the pane is not displayed" for
  `computer` screenshot calls even though navigation and `get_page_text`
  work fine — fall back to `get_page_text` when that happens. **New this
  session and more serious**: the Browser pane can lose its auth cookie
  entirely and land on `/login` with no way to recover without the user's
  actual password (never enter/ask for it) — if this happens, tell the
  user directly and ask them to re-verify or hand you a fresh session
  rather than guessing the app works.
- Calling `.click()` via `javascript_tool` and reading `section.innerText`
  for the result in the same (or an immediately following) script call is
  unreliable — React's state update from the click hasn't necessarily
  flushed to the DOM yet, so the read can return stale content even though
  the click "worked" a moment later. Use the real `computer` `left_click`
  tool (a genuine round-trip) instead of scripted `.click()` when a test
  depends on reading the result of a state change, especially for
  `MonthTabs`-style client components.
- This app has real, live user data in Supabase (the actual person this
  product is being built for). Never test destructive or data-creating
  flows against their real debts/cards — create a disposable row via the
  `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` (a plain Node script,
  `@supabase/supabase-js`, works fine from PowerShell — write it into
  `C:\mini-app-factory\scratch-*.mjs`, run it, then delete both the script
  and the row when done). This was done successfully many times this
  session and is the safe pattern to keep using.
