import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type PaginationControlsProps = {
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange?: (pageSize: number) => void;
  itemsPerPageOptions?: number[];
  className?: string;
};

export default function PaginationControls({
  currentPage,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  itemsPerPageOptions = [10, 25, 50, 100],
  className
}: PaginationControlsProps) {
  const safeItemsPerPage = itemsPerPage > 0 ? itemsPerPage : 1;
  const maxPage = Math.max(1, Math.ceil(totalItems / safeItemsPerPage));
  const [pageInput, setPageInput] = useState(String(currentPage));

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  const clampPage = (value: number) => Math.min(maxPage, Math.max(1, value));

  const applyPageInput = (value: string) => {
    if (!value) {
      setPageInput(String(currentPage));
      return;
    }
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      setPageInput(String(currentPage));
      return;
    }
    const next = clampPage(parsed);
    onPageChange(next);
    setPageInput(String(next));
  };

  return (
    <div className={`flex flex-wrap items-center gap-3 mt-6 px-2 ${className || ''}`}>
      {onItemsPerPageChange && (
        <div className="flex items-center gap-2 min-w-[200px] text-sm text-gray-600">
          <span>Righe per pagina</span>
          <select
            value={itemsPerPage}
            onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
            className="bg-white border border-gray-200 rounded-lg px-2 py-1 text-sm"
          >
            {itemsPerPageOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="flex flex-1 min-w-[200px] gap-2">
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1 || maxPage <= 1}
          className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
        >
          Inizio
        </button>
        <button
          onClick={() => onPageChange(clampPage(currentPage - 1))}
          disabled={currentPage === 1 || maxPage <= 1}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
        >
          <ChevronLeft className="w-4 h-4" />
          Precedente
        </button>
      </div>

      <div className="flex flex-1 min-w-[200px] items-center justify-center gap-2 text-sm text-gray-600">
        <span>Pagina</span>
        <input
          type="number"
          min={1}
          max={maxPage}
          value={pageInput}
          onChange={(e) => {
            const value = e.target.value;
            setPageInput(value);
            if (value) {
              const parsed = Number(value);
              if (!Number.isNaN(parsed)) {
                onPageChange(clampPage(parsed));
              }
            }
          }}
          onBlur={() => applyPageInput(pageInput)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              applyPageInput(pageInput);
            }
          }}
          className="w-16 bg-white border border-gray-200 rounded-lg px-2 py-1 text-sm text-center"
        />
        <span>di {maxPage}</span>
        <span className="text-gray-400">({totalItems} totali)</span>
      </div>

      <div className="flex flex-1 min-w-[200px] gap-2">
        <button
          onClick={() => onPageChange(clampPage(currentPage + 1))}
          disabled={currentPage >= maxPage || maxPage <= 1}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
        >
          Successiva
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          onClick={() => onPageChange(maxPage)}
          disabled={currentPage >= maxPage || maxPage <= 1}
          className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
        >
          Fine
        </button>
      </div>
    </div>
  );
}
