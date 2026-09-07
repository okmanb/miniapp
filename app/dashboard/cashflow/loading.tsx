import { Screen, Skeleton } from "@/components/ui";

export default function CashflowLoading() {
  return (
    <Screen>
      <Skeleton className="h-4 w-36" />
      <Skeleton className="mt-3 h-6 w-64" />
      <Skeleton className="mt-3 h-4 w-32" />

      <Skeleton className="mt-4 h-[46px] w-full rounded-pill" />
      <Skeleton className="mt-4 h-[126px] w-full rounded-surface-lg" />

      <Skeleton className="mt-6 h-5 w-56" />

      {/* La tira de meses: seis bloques del mismo tamaño que los reales. */}
      <div className="mt-3 flex gap-2 overflow-hidden">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[74px] w-[128px] shrink-0 rounded-surface-lg" />
        ))}
      </div>

      <Skeleton className="mt-3 h-[74px] w-full rounded-surface-lg" />
      <Skeleton className="mt-3 h-[220px] w-full rounded-surface-lg" />

      <span className="sr-only" role="status">
        Calculando la proyección
      </span>
    </Screen>
  );
}
