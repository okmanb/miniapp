"use client";

import { useState, type ReactNode } from "react";

function formatMonthShort(monthStr: string) {
  const [, month] = monthStr.split("-");
  const names = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return names[Number(month) - 1];
}

/**
 * En vez de una tabla ancha con un mes por columna (necesitaba scroll
 * horizontal y perdía la primera columna de vista), una tira de tabs
 * en píldora — un mes por tab — con el contenido de ese mes debajo
 * como lista vertical.
 *
 * `children` es un array de nodos ya renderizados (uno por mes, mismo
 * orden que `months`) en vez de una render-prop: este es un Client
 * Component montado desde un Server Component, y una función no es
 * serializable a través de ese límite — el padre arma el JSX de cada
 * mes de antemano y este componente solo decide cuál mostrar.
 */
export default function MonthTabs({
  months,
  bonusMonths,
  children,
}: {
  months: string[];
  bonusMonths?: string[];
  children: ReactNode[];
}) {
  const [active, setActive] = useState(0);
  const bonusSet = new Set(bonusMonths ?? []);

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 4,
          overflowX: "auto",
          padding: 4,
          background: "var(--surface-container-low)",
          borderRadius: 999,
          width: "fit-content",
          maxWidth: "100%",
        }}
      >
        {months.map((m, i) => (
          <button
            key={m}
            type="button"
            onClick={() => setActive(i)}
            style={{
              padding: "8px 16px",
              borderRadius: 999,
              border: "none",
              background: active === i ? "var(--primary)" : "transparent",
              color: active === i ? "var(--on-primary)" : "var(--on-surface-variant)",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              textTransform: "capitalize",
              flexShrink: 0,
            }}
          >
            {formatMonthShort(m)}
            {bonusSet.has(m) ? " •" : ""}
          </button>
        ))}
      </div>
      <div style={{ marginTop: 16 }}>{children[active]}</div>
    </div>
  );
}
