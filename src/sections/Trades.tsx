import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { SectionTitle } from '../components/Card';
import { Badge } from '../components/Badge';
import { fmtDateTime, fmtMoney, fmtNum } from '../lib/format';
import type { Trade } from '../types';

const PAGE = 50;
type SortKey = keyof Pick<Trade, 'index' | 'closeTime' | 'symbol' | 'profit' | 'lots'>;

export function Trades() {
  const { filteredTrades, dataset } = useStore();
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'index', dir: 1 });
  const currency = dataset?.result.meta.currency ?? 'USD';

  const sorted = useMemo(() => {
    const arr = [...filteredTrades];
    arr.sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av instanceof Date && bv instanceof Date) return (av.getTime() - bv.getTime()) * sort.dir;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * sort.dir;
      return String(av).localeCompare(String(bv)) * sort.dir;
    });
    return arr;
  }, [filteredTrades, sort]);

  const pages = Math.ceil(sorted.length / PAGE);
  const view = sorted.slice(page * PAGE, page * PAGE + PAGE);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: 1 }));

  const Th = ({ k, children, right }: { k?: SortKey; children: React.ReactNode; right?: boolean }) => (
    <th
      onClick={k ? () => toggleSort(k) : undefined}
      className={`sticky top-0 bg-surface-2/95 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400 backdrop-blur ${
        right ? 'text-right' : 'text-left'
      } ${k ? 'cursor-pointer select-none hover:text-white' : ''}`}
    >
      {children}
      {k && sort.key === k && <span className="ml-1 text-brand">{sort.dir === 1 ? '↑' : '↓'}</span>}
    </th>
  );

  return (
    <div className="space-y-4">
      <SectionTitle
        title="Operaciones"
        subtitle={`${sorted.length} operaciones cerradas`}
        right={
          pages > 1 ? (
            <div className="flex items-center gap-2 text-sm">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="rounded-lg border border-white/10 px-2.5 py-1 disabled:opacity-30"
              >
                ←
              </button>
              <span className="tnum text-slate-400">
                {page + 1} / {pages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
                disabled={page >= pages - 1}
                className="rounded-lg border border-white/10 px-2.5 py-1 disabled:opacity-30"
              >
                →
              </button>
            </div>
          ) : undefined
        }
      />

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-surface/50">
        <table className="w-full min-w-[760px] border-collapse">
          <thead>
            <tr>
              <Th k="index">#</Th>
              <Th k="closeTime">Cierre</Th>
              <Th k="symbol">Símbolo</Th>
              <Th>Tipo</Th>
              <Th k="lots" right>
                Lotes
              </Th>
              <Th right>Apertura</Th>
              <Th right>Cierre</Th>
              <Th right>Comis.</Th>
              <Th right>Swap</Th>
              <Th k="profit" right>
                P&L
              </Th>
              <Th right>Balance</Th>
            </tr>
          </thead>
          <tbody>
            {view.map((t) => (
              <tr key={t.index} className="border-t border-white/5 hover:bg-white/5">
                <td className="px-3 py-2 text-sm text-slate-500">{t.index + 1}</td>
                <td className="px-3 py-2 text-sm text-slate-300">{fmtDateTime(t.closeTime)}</td>
                <td className="px-3 py-2 text-sm font-medium text-white">{t.symbol}</td>
                <td className="px-3 py-2">
                  <Badge tone={t.type === 'long' ? 'pos' : 'neg'}>{t.type === 'long' ? 'LONG' : 'SHORT'}</Badge>
                </td>
                <td className="tnum px-3 py-2 text-right text-sm text-slate-300">{fmtNum(t.lots)}</td>
                <td className="tnum px-3 py-2 text-right text-sm text-slate-400">{t.openPrice != null ? fmtNum(t.openPrice, 4) : '—'}</td>
                <td className="tnum px-3 py-2 text-right text-sm text-slate-400">{t.closePrice != null ? fmtNum(t.closePrice, 4) : '—'}</td>
                <td className="tnum px-3 py-2 text-right text-sm text-slate-500">{fmtNum(t.commission)}</td>
                <td className="tnum px-3 py-2 text-right text-sm text-slate-500">{fmtNum(t.swap)}</td>
                <td className={`tnum px-3 py-2 text-right text-sm font-semibold ${t.profit >= 0 ? 'text-pos' : 'text-neg'}`}>
                  {fmtMoney(t.profit, currency)}
                </td>
                <td className="tnum px-3 py-2 text-right text-sm text-slate-300">{fmtNum(t.balanceAfter, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
