import { BottomNav } from "@/components/BottomNav";
import { getDashboard } from "@/lib/data/dashboard";

/**
 * Marco de las pantallas privadas. La barra inferior vive acá y no en cada
 * página, así no se remonta al navegar entre secciones.
 *
 * El contador de alertas sale de la misma lectura que usa el dashboard: está
 * memoizada por request, así que tenerla acá no agrega una consulta.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Si la lectura falla, la barra igual tiene que aparecer: el error se
  // muestra en el contenido, no rompiendo la navegación.
  let alertCount = 0;
  try {
    const data = await getDashboard();
    alertCount = data?.alerts.length ?? 0;
  } catch {
    alertCount = 0;
  }

  return (
    <>
      {children}
      <BottomNav alertCount={alertCount} />
    </>
  );
}
