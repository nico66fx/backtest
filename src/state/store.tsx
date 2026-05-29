// Estado global ligero vía Context: dataset cargado, filtros y métricas derivadas.

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { EquityPoint, ParseResult, Trade } from '../types';
import {
  buildEquityCurve,
  computeMetrics,
  inferInitialDeposit,
  type Metrics,
} from '../lib/metrics';

export interface Dataset {
  result: ParseResult;
  initialDeposit: number;
}

interface Filters {
  symbol: string | 'all';
  from: string; // yyyy-mm-dd
  to: string;
}

interface StoreValue {
  dataset: Dataset | null;
  setResult: (r: ParseResult) => void;
  clear: () => void;
  filters: Filters;
  setFilters: (f: Partial<Filters>) => void;
  symbols: string[];
  filteredTrades: Trade[];
  metrics: Metrics | null;
  equity: EquityPoint[];
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [filters, setFiltersState] = useState<Filters>({ symbol: 'all', from: '', to: '' });

  const setResult = (r: ParseResult) => {
    const initialDeposit = inferInitialDeposit(r.trades, r.meta.initialDeposit);
    setDataset({ result: r, initialDeposit });
    setFiltersState({ symbol: 'all', from: '', to: '' });
  };

  const clear = () => {
    setDataset(null);
    setFiltersState({ symbol: 'all', from: '', to: '' });
  };

  const setFilters = (f: Partial<Filters>) => setFiltersState((prev) => ({ ...prev, ...f }));

  const symbols = useMemo(() => {
    if (!dataset) return [];
    return Array.from(new Set(dataset.result.trades.map((t) => t.symbol))).sort();
  }, [dataset]);

  const filteredTrades = useMemo(() => {
    if (!dataset) return [];
    const fromT = filters.from ? new Date(filters.from).getTime() : -Infinity;
    const toT = filters.to ? new Date(filters.to).getTime() + 864e5 : Infinity;
    return dataset.result.trades
      .filter((t) => filters.symbol === 'all' || t.symbol === filters.symbol)
      .filter((t) => {
        const d = (t.closeTime ?? t.openTime)?.getTime();
        if (d == null) return true;
        return d >= fromT && d <= toT;
      })
      .map((t, i) => ({ ...t, index: i }));
  }, [dataset, filters]);

  const metrics = useMemo(() => {
    if (!dataset) return null;
    return computeMetrics(filteredTrades, dataset.initialDeposit);
  }, [dataset, filteredTrades]);

  const equity = useMemo(() => {
    if (!dataset) return [];
    return buildEquityCurve(filteredTrades, dataset.initialDeposit);
  }, [dataset, filteredTrades]);

  const value: StoreValue = {
    dataset,
    setResult,
    clear,
    filters,
    setFilters,
    symbols,
    filteredTrades,
    metrics,
    equity,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore debe usarse dentro de StoreProvider');
  return ctx;
}
