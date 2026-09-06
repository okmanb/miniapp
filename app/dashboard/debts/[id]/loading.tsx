import { Card, Screen, Skeleton } from "@/components/ui";

export default function DebtDetailLoading() {
  return (
    <Screen>
      <Skeleton className="h-4 w-36" />
      <Skeleton className="mt-3 h-6 w-64" />
      <Skeleton className="mt-2 h-3 w-32" />

      <Card animate={false} className="mt-4 px-4 py-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-2 h-8 w-48" />
        <div className="mt-4 space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex justify-between gap-3">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      </Card>

      <Skeleton className="mt-6 h-5 w-44" />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Skeleton className="h-[128px] rounded-surface-lg" />
        <Skeleton className="h-[128px] rounded-surface-lg" />
      </div>

      <span className="sr-only" role="status">
        Cargando la deuda
      </span>
    </Screen>
  );
}
