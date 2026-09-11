"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "./Toast";

/**
 * El aviso de los gastos que archivó el resumen, del otro lado del redirect.
 *
 * Cargar un resumen archiva los gastos que ya venían adentro (Regla 3) y
 * después redirige al detalle de la deuda. El toast no puede dispararse antes
 * de irse —el componente se desmonta— así que el número cruza por la URL y se
 * consume acá.
 *
 * Se limpia la query apenas se muestra: si quedara, recargar la página o
 * volver con el botón de atrás repetiría un aviso sobre algo que ya pasó.
 */
export function ArchivedExpensesToast() {
  const params = useSearchParams();
  const router = useRouter();
  const showToast = useToast((s) => s.show);
  // En desarrollo el efecto corre dos veces; sin esto el toast se dispara dos
  // veces y el segundo reinicia el reloj del primero.
  const shown = useRef(false);

  const archived = Number(params.get("archivados") ?? 0);

  useEffect(() => {
    if (shown.current || !Number.isInteger(archived) || archived <= 0) return;
    shown.current = true;

    showToast(
      archived === 1 ? "Quitamos 1 gasto duplicado" : `Quitamos ${archived} gastos duplicados`
    );

    router.replace(window.location.pathname, { scroll: false });
  }, [archived, router, showToast]);

  return null;
}
