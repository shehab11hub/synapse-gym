import React from 'react';

interface PageSkeletonProps {
  variant?: string;
}

export const CardsGridSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse" dir="rtl">
    {Array.from({ length: count }).map((_, idx) => (
      <div
        key={idx}
        className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 shrink-0" />
            <div className="space-y-2">
              <div className="h-4 w-32 bg-slate-800 rounded-lg" />
              <div className="h-3 w-24 bg-slate-800/70 rounded-full" />
            </div>
          </div>
          <div className="h-6 w-24 bg-slate-800 rounded-full" />
        </div>
        <div className="h-10 w-full bg-slate-800/60 rounded-2xl" />
        <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/60 space-y-2">
          <div className="h-3 w-3/4 bg-slate-800 rounded-full" />
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="h-7 bg-slate-800/80 rounded-xl" />
            <div className="h-7 bg-slate-800/80 rounded-xl" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="h-9 bg-slate-800 rounded-xl" />
          <div className="h-9 bg-slate-800 rounded-xl" />
        </div>
      </div>
    ))}
  </div>
);

export const TableRowsSkeleton: React.FC<{ rows?: number; cols?: number }> = ({
  rows = 6,
  cols = 6,
}) => (
  <div className="p-4 space-y-3 animate-pulse" dir="rtl">
    {Array.from({ length: rows }).map((_, rIdx) => (
      <div
        key={rIdx}
        className="grid gap-3 p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800/80"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: cols }).map((__, cIdx) => (
          <div
            key={cIdx}
            className={`h-4 rounded-lg ${
              cIdx === 0 ? 'bg-slate-700/80' : 'bg-slate-800/80'
            }`}
          />
        ))}
      </div>
    ))}
  </div>
);

export const PageSkeleton: React.FC<PageSkeletonProps> = ({ variant = 'default' }) => {
  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-6 animate-pulse" dir="rtl">
      {/* Header Banner Skeleton */}
      <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-800 shrink-0" />
          <div className="space-y-2.5">
            <div className="h-5 w-52 bg-slate-800 rounded-xl" />
            <div className="h-3 w-72 max-w-full bg-slate-800/70 rounded-full" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-10 w-32 bg-slate-800 rounded-2xl" />
          <div className="h-10 w-28 bg-slate-800/80 rounded-2xl hidden sm:block" />
        </div>
      </div>

      {/* KPI Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-5 rounded-3xl bg-slate-900/85 border border-slate-800 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-3 w-24 bg-slate-800 rounded-full" />
              <div className="w-8 h-8 rounded-xl bg-slate-800" />
            </div>
            <div className="h-7 w-28 bg-slate-700/70 rounded-xl" />
            <div className="h-2.5 w-36 bg-slate-800/60 rounded-full" />
          </div>
        ))}
      </div>

      {/* Main Content Skeleton matching target view */}
      {variant === 'members_search' || variant === 'reception' || variant === 'pos' ? (
        <div className="space-y-4">
          <div className="p-4 rounded-3xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row gap-3">
            <div className="h-10 flex-1 bg-slate-800 rounded-2xl" />
            <div className="h-10 w-36 bg-slate-800 rounded-2xl" />
            <div className="h-10 w-36 bg-slate-800 rounded-2xl" />
          </div>
          <CardsGridSkeleton count={6} />
        </div>
      ) : (
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="h-5 w-48 bg-slate-800 rounded-xl" />
            <div className="h-8 w-36 bg-slate-800 rounded-xl" />
          </div>
          <TableRowsSkeleton rows={6} cols={5} />
        </div>
      )}
    </div>
  );
};
