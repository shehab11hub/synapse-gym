import React from 'react';
import { Loader2 } from 'lucide-react';

interface PageSkeletonProps {
  title?: string;
}

export const PageSkeleton: React.FC<PageSkeletonProps> = ({ title = 'جاري سحب البيانات من قاعدة البيانات...' }) => {
  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-6 animate-pulse" dir="rtl">
      {/* Top Loading Banner */}
      <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
          <div className="space-y-1.5">
            <div className="text-sm font-black text-teal-300">{title}</div>
            <div className="h-2.5 w-48 bg-slate-800 rounded-full" />
          </div>
        </div>
        <div className="h-9 w-28 bg-slate-800 rounded-xl hidden sm:block" />
      </div>

      {/* KPI Skeletons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3">
            <div className="h-3 w-24 bg-slate-800 rounded-full" />
            <div className="h-7 w-32 bg-slate-800 rounded-xl" />
            <div className="h-2.5 w-20 bg-slate-800/70 rounded-full" />
          </div>
        ))}
      </div>

      {/* Table / Cards Skeleton */}
      <div className="p-6 rounded-3xl bg-slate-900/70 border border-slate-800 space-y-4">
        <div className="h-5 w-44 bg-slate-800 rounded-lg" />
        {[1, 2, 3, 4, 5].map((r) => (
          <div key={r} className="h-14 w-full bg-slate-800/60 rounded-2xl" />
        ))}
      </div>
    </div>
  );
};
