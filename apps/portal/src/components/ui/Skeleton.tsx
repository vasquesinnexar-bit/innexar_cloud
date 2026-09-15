"use client";

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`animate-pulse rounded-xl bg-white/5 border border-white/5 ${className}`}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="card-base rounded-2xl p-5 space-y-3" aria-hidden>
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

export function SkeletonTable({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
