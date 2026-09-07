import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";

export const dynamic = "force-dynamic";

/**
 * Pantalla 00. La raíz ES el onboarding, no una presentación del producto:
 * el prototipo abre pidiendo la primera deuda, sin cuenta y sin explicar de
 * qué se trata la app. Alguien que llega acá ya sabe que debe plata.
 */
export default async function HomePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  // Quien ya tiene sesión no vuelve a pasar por el alta guiada.
  if (data.user) redirect("/dashboard");

  return <OnboardingFlow />;
}
