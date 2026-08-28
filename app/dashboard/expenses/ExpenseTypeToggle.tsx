"use client";

import { useState, type ReactNode } from "react";

/**
 * "+ Agregar gasto" es un solo botón en el dashboard para dos cosas
 * distintas que antes vivían en pantallas separadas y sin relación
 * visible entre sí: un gasto fijo que se repite (colegio, alquiler)
 * y un gasto suelto de una sola vez a una tarjeta (nafta, súper).
 * Este toggle solo decide cuál de los dos formularios (ya armados
 * del lado del servidor) mostrar — no duplica la lógica de ninguno.
 */
export default function ExpenseTypeToggle({
  fixedForm,
  oneOffForm,
}: {
  fixedForm: ReactNode;
  oneOffForm: ReactNode;
}) {
  const [type, setType] = useState<"fijo" | "unico">("fijo");

  return (
    <div>
      <div className="strategy-toggle" style={{ marginBottom: 20 }}>
        <input type="radio" id="expense-type-fijo" name="expense_type_ui" checked={type === "fijo"} onChange={() => setType("fijo")} />
        <label htmlFor="expense-type-fijo">Gasto fijo</label>

        <input type="radio" id="expense-type-unico" name="expense_type_ui" checked={type === "unico"} onChange={() => setType("unico")} />
        <label htmlFor="expense-type-unico">Único a una tarjeta</label>
      </div>
      {type === "fijo" ? fixedForm : oneOffForm}
    </div>
  );
}
