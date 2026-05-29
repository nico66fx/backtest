import { useStore } from '../state/store';
import { Card, SectionTitle } from '../components/Card';
import { StatCard } from '../components/StatCard';
import { Badge } from '../components/Badge';
import { EquityChart, DrawdownChart } from '../components/charts';
import { fmtDate, fmtMoney, fmtNum, fmtPct } from '../lib/format';
import { exportMetricsJson, exportPdf, exportTradesCsv } from '../lib/export';

export function Overview() {
  const { metrics, equity, dataset, filteredTrades } = useStore();
  if (!metrics || !dataset) return null;
  const m = metrics;
  const currency = dataset.result.meta.currency ?? 'USD';
  const meta = dataset.result.meta;

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Resumen del backtest"
        subtitle={`${meta.symbol ?? 'Multi'} · ${meta.period ?? `${fmtDate(m.start)} – ${fmtDate(m.end)}`}`}
        right={
          <div className="flex flex-wrap gap-2 print:hidden">
            <button
              onClick={() => exportTradesCsv(filteredTrades)}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white"
            >
              CSV
            </button>
            <button
              onClick={() => exportMetricsJson(m)}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white"
            >
              JSON
            </button>
            <button
              onClick={exportPdf}
              className="rounded-lg bg-brand/15 px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand/25"
            >
              PDF / Imprimir
            </button>
          </div>
        }
      />

      {/* Métricas estrella */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Beneficio neto"
          value={fmtMoney(m.netProfit, currency)}
          tone={m.netProfit >= 0 ? 'pos' : 'neg'}
          hint={`${fmtPct(m.totalReturnPct)} sobre depósito`}
          big
        />
        <StatCard
          label="Profit Factor"
          value={fmtNum(m.profitFactor)}
          tone={m.profitFactor >= 1.5 ? 'pos' : m.profitFactor >= 1 ? 'brand' : 'neg'}
          hint="Bruto ganado / perdido"
          big
        />
        <StatCard
          label="Win Rate"
          value={fmtPct(m.winRate)}
          tone="brand"
          hint={`${m.wins} G · ${m.losses} P`}
          big
        />
        <StatCard
          label="Max Drawdown"
          value={fmtPct(m.maxDrawdownPct)}
          tone="neg"
          hint={fmtMoney(m.maxDrawdownAbs, currency)}
          big
        />
      </div>

      {/* Curva de equity */}
      <Card delay={80}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-white">Curva de balance</h3>
          <Badge tone={m.netProfit >= 0 ? 'pos' : 'neg'}>
            {fmtMoney(m.initialDeposit, currency)} → {fmtMoney(m.finalBalance, currency)}
          </Badge>
        </div>
        <EquityChart equity={equity} currency={currency} />
      </Card>

      {/* Drawdown */}
      <Card delay={120}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-white">Drawdown (%)</h3>
          <Badge tone="neg">Máx {fmtPct(m.maxDrawdownPct)}</Badge>
        </div>
        <DrawdownChart equity={equity} />
      </Card>

      {/* Secundarias */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Expected Payoff" value={fmtMoney(m.expectedPayoff, currency)} hint="Esperanza / operación" />
        <StatCard label="Recovery Factor" value={fmtNum(m.recoveryFactor)} hint="Beneficio / Max DD" />
        <StatCard label="Sharpe Ratio" value={fmtNum(m.sharpe)} hint="Sobre retornos por op." />
        <StatCard label="Operaciones" value={fmtNum(m.totalTrades, 0)} hint={`${m.longs} L · ${m.shorts} S`} />
      </div>
    </div>
  );
}
