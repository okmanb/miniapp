import DebtForm from "../DebtForm";
import { createDebt } from "../actions";
import { WalletIcon } from "@/lib/icons";
import Link from "next/link";
import type { DebtFormValues, ValidationErrors } from "../validation";

export default function NewDebtPage({
  searchParams,
}: {
  searchParams: { errors?: string; values?: string };
}) {
  let errors: ValidationErrors | undefined;
  let values: DebtFormValues | undefined;

  try {
    if (searchParams.errors) errors = JSON.parse(searchParams.errors);
    if (searchParams.values) values = JSON.parse(searchParams.values);
  } catch {
    // Si vino algo mal formado en la URL, arrancamos con el form vacío.
  }

  return (
    <main style={{ maxWidth: 480, margin: "60px auto", padding: "0 24px" }}>
      <p>
        <Link href="/dashboard">← Volver al dashboard</Link>
      </p>
      <h1 style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <WalletIcon width={26} height={26} />
        Agregar deuda
      </h1>
      <p style={{ fontSize: 14, color: "var(--ink-muted)" }}>
        ¿Es una tarjeta de crédito y tenés el resumen a mano?{" "}
        <Link href="/dashboard/debts/new/upload">Subí el PDF</Link> y te
        completamos esto automáticamente.
      </p>
      <DebtForm errors={errors} values={values} action={createDebt} />
    </main>
  );
}
