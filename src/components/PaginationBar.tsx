import React from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';

interface PaginationBarProps {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
  label?: string;
}

export const PaginationBar: React.FC<PaginationBarProps> = ({
  currentPage,
  totalPages,
  totalCount,
  pageSize = 20,
  onPageChange,
  isLoading = false,
  label = 'سجل',
}) => {
  if (totalCount === 0 && totalPages <= 1) return null;

  const safeTotalPages = Math.max(1, totalPages);
  const startItem = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(totalCount, currentPage * pageSize);

  const getPageNumbers = (): (number | 'ellipsis')[] => {
    if (safeTotalPages <= 7) {
      return Array.from({ length: safeTotalPages }, (_, i) => i + 1);
    }

    const pages: (number | 'ellipsis')[] = [1];
    if (currentPage > 3) pages.push('ellipsis');

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(safeTotalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (currentPage < safeTotalPages - 2) pages.push('ellipsis');
    pages.push(safeTotalPages);
    return pages;
  };

  return (
    <div
      className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-[#0f172a]/90 border border-slate-800 text-xs"
      dir="rtl"
    >
      <div className="text-slate-400 font-medium">
        عرض{' '}
        <span className="font-mono font-bold text-white">
          {startItem} - {endItem}
        </span>{' '}
        من أصل{' '}
        <span className="font-mono font-bold text-teal-400">{totalCount}</span> {label}
      </div>

      <div className="flex items-center gap-1.5 flex-wrap justify-center">
        <button
          type="button"
          disabled={currentPage <= 1 || isLoading}
          onClick={() => onPageChange(currentPage - 1)}
          className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white font-bold transition flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <ChevronRight className="w-3.5 h-3.5" />
          <span>السابق</span>
        </button>

        {getPageNumbers().map((item, idx) =>
          item === 'ellipsis' ? (
            <span key={`el-${idx}`} className="px-2 text-slate-500 font-mono">
              ...
            </span>
          ) : (
            <button
              key={item}
              type="button"
              disabled={isLoading}
              onClick={() => onPageChange(item)}
              className={`min-w-[32px] h-8 px-2 rounded-xl font-mono font-bold transition cursor-pointer ${
                item === currentPage
                  ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/25'
                  : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              {item}
            </button>
          )
        )}

        <button
          type="button"
          disabled={currentPage >= safeTotalPages || isLoading}
          onClick={() => onPageChange(currentPage + 1)}
          className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white font-bold transition flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <span>التالي</span>
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
