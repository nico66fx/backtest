import { useStore } from '../state/store';

/** Filtros en vivo: símbolo y rango de fechas. Recalcula todo el dashboard. */
export function FilterBar() {
  const { filters, setFilters, symbols, filteredTrades, dataset } = useStore();
  if (!dataset) return null;

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-white/10 bg-surface/40 p-4 backdrop-blur">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium uppercase tracking-wider text-slate-400">Símbolo</label>
        <select
          value={filters.symbol}
          onChange={(e) => setFilters({ symbol: e.target.value })}
          className="rounded-lg border border-white/10 bg-surface-2 px-3 py-1.5 text-sm text-white focus:border-brand focus:outline-none"
        >
          <option value="all">Todos ({symbols.length})</option>
          {symbols.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium uppercase tracking-wider text-slate-400">Desde</label>
        <input
          type="date"
          value={filters.from}
          onChange={(e) => setFilters({ from: e.target.value })}
          className="rounded-lg border border-white/10 bg-surface-2 px-3 py-1.5 text-sm text-white focus:border-brand focus:outline-none"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium uppercase tracking-wider text-slate-400">Hasta</label>
        <input
          type="date"
          value={filters.to}
          onChange={(e) => setFilters({ to: e.target.value })}
          className="rounded-lg border border-white/10 bg-surface-2 px-3 py-1.5 text-sm text-white focus:border-brand focus:outline-none"
        />
      </div>
      {(filters.symbol !== 'all' || filters.from || filters.to) && (
        <button
          onClick={() => setFilters({ symbol: 'all', from: '', to: '' })}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white"
        >
          Limpiar
        </button>
      )}
      <div className="ml-auto self-center text-sm text-slate-400">
        <span className="tnum font-bold text-white">{filteredTrades.length}</span> operaciones
      </div>
    </div>
  );
}
