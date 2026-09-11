"use client";

import { useToast } from "@/components/Toast";

/**
 * El toast, mirable sin sesión.
 *
 * Vive solo porque si no, la única forma de verlo sería iniciar sesión,
 * posponer una alerta de verdad y llegar a tiempo antes de que se vaya a los
 * 2,4 segundos. Esa es exactamente la razón por la que cuatro pantallas
 * pasaron meses sin que nadie las comparara contra el prototipo.
 */
export function ToastDemo() {
  const showToast = useToast((s) => s.show);

  const ejemplos = [
    "Pospuesta hasta mañana",
    "Pospuesta hasta un día antes del vencimiento",
    "Quitamos 3 gastos duplicados",
  ];

  return (
    <div className="flex flex-wrap gap-2 px-[18px]">
      {ejemplos.map((mensaje) => (
        <button
          key={mensaje}
          type="button"
          onClick={() => showToast(mensaje)}
          className="min-h-touch rounded-pill border border-border bg-surface px-3 text-[12px] font-semibold text-pine"
        >
          {mensaje}
        </button>
      ))}
    </div>
  );
}
