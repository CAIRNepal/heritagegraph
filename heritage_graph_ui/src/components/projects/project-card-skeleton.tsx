import { glassCard } from "@/lib/design";

export function ProjectCardSkeleton() {
  return (
    <div className={`${glassCard} p-5 animate-pulse space-y-3`}>
      <div className="flex justify-between gap-3">
        <div className="h-4 flex-1 max-w-[66%] bg-muted rounded" />
        <div className="h-5 w-16 bg-muted rounded-full shrink-0" />
      </div>
      <div className="h-3 w-full bg-muted/70 rounded" />
      <div className="h-3 w-4/5 bg-muted/70 rounded" />
      <div className="flex gap-4">
        <div className="h-3 w-16 bg-muted/70 rounded" />
        <div className="h-3 w-16 bg-muted/70 rounded" />
      </div>
    </div>
  );
}
