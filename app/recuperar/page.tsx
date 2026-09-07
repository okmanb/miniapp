import { AuthShell } from "@/components/AuthShell";
import { RecoveryFlow } from "@/components/RecoveryFlow";

export const dynamic = "force-dynamic";

/**
 * Recuperar clave (pantalla 14).
 *
 * Un código de seis dígitos en vez de un link: el mail se lee en el teléfono y
 * la clave se cambia en la computadora, y un link solo sirve donde se abrió.
 *
 * Ojo: esto depende de que la plantilla "Reset password" del proyecto de
 * Supabase incluya {{ .Token }}. Con la plantilla por defecto llega el link de
 * siempre y la pantalla espera un código que nunca aparece.
 */
export default function RecoverPage() {
  return (
    <AuthShell title="Recuperar clave" note="">
      <RecoveryFlow />
    </AuthShell>
  );
}
