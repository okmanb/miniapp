"use client";

import { useState } from "react";

/**
 * Borrar una tarjeta se lleva puestas sus cuotas/refinanciaciones
 * hijas (ver deleteDebt en debts/actions.ts) — es intencional, no un
 * efecto secundario: si esas cuotas dejan de existir como producto
 * financiero al borrar la tarjeta que las originó, no tiene sentido
 * dejarlas colgando solas en el dashboard. Este aviso existe para
 * que el usuario pueda cancelar si no se había dado cuenta de que
 * también las iba a perder.
 *
 * Confirmación in-app (no `window.confirm`) a propósito: el diálogo
 * nativo del navegador queda suprimido en algunos entornos sin
 * ningún aviso — el clic no hacía nada ni pedía confirmar ni
 * borraba. Un estado de React no depende de eso.
 */
export default function DeleteDebtButton({ childCount }: { childCount: number }) {
  const [confirming, setConfirming] = useState(false);

  if (childCount > 0 && confirming) {
    const plural = childCount > 1;
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: "var(--on-surface-variant)" }}>
          Se van a borrar también {childCount} cuota{plural ? "s" : ""}/refinanciación{plural ? "es" : ""} vinculada{plural ? "s" : ""}.
        </span>
        <button
          type="submit"
          style={{
            color: "var(--on-error-container)",
            background: "var(--error-container)",
            border: "none",
            borderRadius: "var(--radius-full)",
            cursor: "pointer",
            padding: "5px 12px",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          Borrar todo
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          style={{ color: "var(--on-surface-variant)", background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 13 }}
        >
          Cancelar
        </button>
      </span>
    );
  }

  return (
    <button
      type={childCount > 0 ? "button" : "submit"}
      onClick={childCount > 0 ? () => setConfirming(true) : undefined}
      style={{ color: "var(--error)", background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 13 }}
    >
      Borrar
    </button>
  );
}
