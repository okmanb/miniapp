import { Card, Screen, Skeleton } from "@/components/ui";

/**
 * Estado de carga del dashboard. El esqueleto tiene la forma de lo que viene
 * —hero, escenario, lista de deudas— para que la pantalla no salte al llegar
 * el dato. El verde no se usa acá: verde significa progreso, y esto es carga
 * neutra.
 */
export default function DashboardLoading() {
  return (
    <Screen>
      <header className="mb-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-2 h-3 w-32" />
      </header>

      <Skeleton className="h-[201px] w-full rounded-[16px]" />
      <Skeleton className="mt-3 h-[46px] w-full rounded-surface" />

      <Skeleton className="mb-2 mt-5 h-3 w-24" />

      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <Card key={i} animate={false} className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="w-full">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="mt-2 h-3 w-1/3" />
              </div>
              <Skeleton className="h-4 w-24 shrink-0" />
            </div>
          </Card>
        ))}
      </div>

      <span className="sr-only" role="status">
        Cargando tus deudas
      </span>
    </Screen>
  );
}
