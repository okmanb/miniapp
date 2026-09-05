# SCREENS.md — el prototipo mapeado al repo

Abrí `handoff/prototipo.html` y usá la barra superior: cambia el ancho del dispositivo y
permite ver cada pantalla en sus cuatro estados (listo, cargando, vacío, error). Los cuatro
estados son parte del diseño, no un extra.

| # | Pantalla del prototipo | Ruta / archivos del repo |
|---|---|---|
| 00 | Onboarding 1–3 | no existe todavía |
| 01 | Dashboard | `app/dashboard/page.tsx` |
| 02 | Flujo de caja | `app/dashboard/cashflow/page.tsx`, `CashFlowChart.tsx`, `HealthRibbon.tsx`, `MonthTabs.tsx` |
| 03 | Detalle de deuda | `app/dashboard/debts/[id]/` |
| 04 | Editar deuda | `app/dashboard/debts/DebtForm.tsx`, `validation.ts`, `actions.ts` |
| 05 | Agregar gasto | `app/dashboard/expenses/`, `ExpenseTypeToggle.tsx`, `cashflow/expenses/` |
| 06 | Resumen del mes | `lib/statement-parser/`, `app/api/` |
| 07 | Escenarios | `app/dashboard/scenarios/` |
| 08 | Plan destructor | `app/dashboard/payoff-plan/page.tsx` |
| 09 | Cuotas | dentro de `debts/[id]/` |
| 10 | Alertas | `app/dashboard/alerts/` |
| 11 | Préstamos puente | `app/dashboard/bridge-loans/` |
| 12–14 | Ingresar, crear cuenta, recuperar clave | `app/auth-actions.ts`, `middleware.ts` |
| 15 | Historial de pagos | no existe todavía |
| 16 | Ajustes | no existe todavía |

Orden sugerido: 01, 02, 03 y 05 primero — son las que concentran el sistema visual y las
reglas de gastos. El resto hereda casi todo de esas cuatro.

Ingresos: el sueldo puede venir en dos partes con montos que cambian de un mes a otro, y hay
ingresos que entran una vez al año (bono, aguinaldo en junio y diciembre). El prototipo ya
distingue mensual, aguinaldo y bono con mes elegible.
