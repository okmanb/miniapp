import Link from "next/link";
import { DebtForm } from "@/components/DebtForm";
import { Screen } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function NewDebtPage() {
  return (
    <Screen>
      <Link
        href="/dashboard"
        className="inline-flex min-h-touch items-center gap-1.5 text-[12px] text-muted hover:text-leaf"
      >
        <span aria-hidden>←</span> Volver
      </Link>

      <h1 className="mt-2 text-screen text-ink">Agregar deuda</h1>
      <p className="help mt-1">
        Con el nombre y el saldo alcanza para empezar. Lo demás lo podés completar después, o
        dejar que lo traiga un resumen.
      </p>

      <DebtForm />
    </Screen>
  );
}
