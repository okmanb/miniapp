"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { importOnboardingDraft } from "@/app/dashboard/import-draft-actions";
import { clearDraft, readDraft } from "@/lib/onboarding/draft";

/**
 * Sube el borrador del onboarding la primera vez que se entra al tablero con
 * sesión.
 *
 * Vive en el layout del tablero y no en la pantalla de registro porque el
 * registro por mail termina en otra pestaña: la persona confirma desde el
 * mail y vuelve a la app por el callback. El único punto por el que pasa
 * seguro, con sesión y con el localStorage a mano, es este.
 *
 * El borrador se borra recién cuando el servidor confirma. Si la importación
 * falla, queda para el próximo intento en vez de perderse en silencio.
 */
export function DraftImporter() {
  const router = useRouter();
  const attempted = useRef(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (attempted.current) return;
    const draft = readDraft();
    if (!draft) return;

    attempted.current = true;

    importOnboardingDraft(draft).then((result) => {
      if (!result.ok) {
        setFailed(true);
        return;
      }
      // imported:false significa que la cuenta ya tenía datos. El borrador ya
      // no sirve para nada, así que se limpia igual.
      clearDraft();
      if (result.imported) router.refresh();
    });
  }, [router]);

  if (!failed) return null;

  return (
    <div className="mx-auto w-full max-w-[430px] px-[18px] pt-4">
      <p
        role="alert"
        className="rounded-surface border border-gold-border bg-[#FCF4E7] px-3 py-2 text-[11.5px] text-gold-ink"
      >
        No pudimos traer lo que cargaste antes de crear la cuenta. Sigue guardado en este
        navegador: si recargás la página lo intentamos de nuevo.
      </p>
    </div>
  );
}
