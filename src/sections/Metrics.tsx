import { useState } from 'react';
import { useStore } from '../state/store';
import { Card, SectionTitle } from '../components/Card';
import {
  PnLBars,
  DistributionChart,
  MonthlyChart,
  BreakdownChart,
  type GroupMode,
} from '../components/charts';
import { fmtDuration, fmtMoney, fmtNum, fmtPct } from '../lib/format';

function Row({ label, value, tone }: { label: string; value: string; tone?: 'pos' | 'neg' | 'brand' }) {
  const c = tone === 'pos' ? 'text-pos' : tone === 'neg' ? 'text-neg' : tone === 'brand' ? 'text-brand' : 'text-white';
  return (
    <div className="flex items-center justify-between border-b border-white/5 py-2 last:border-0">
      <span className="text-sm text-slate-400">{label}</span>
      <span className={`tnum text-sm font-semibold ${c}`}>{value}</span>
    </div>
  );
}

const GROUP_LABELS: Record<GroupMode, string> = {
  symbol: 'Por símbolo',
  hour: 'Por hora del día',
  weekday: 'Por día de la semana',
};

export function MetricsSection() {
  const { metrics, dataset, filteredTrades } = useStore();
  const [group, setGroup] = useState<GroupMode>('symbol');
  if (!metrics || !dataset) return null;
  const m = metrics;
  const currency = dataset.result.meta.currency ?? 'USD';

  return (
    <div className="space-y-6">
      <SectionTitle title="Métricas completas" subtitle="Todas las estadísticas, recalculadas en vivo según los filtros." />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <h3 className="mb-2 font-semibold text-brand">Rentabilidad</h3>
          <Row label="Beneficio neto" value={fmtMoney(m.netProfit, currency)} tone={m.netProfit >= 0 ? 'pos' : 'neg'} />
          <Row label="Beneficio bruto" value={fmtMoney(m.grossProfit, currency)} tone="pos" />
          <Row label="Pérdida bruta" value={fmtMoney(-m.grossLoss, currency)} tone="neg" />
          <Row label="Profit Factor" value={fmtNum(m.profitFactor)} />
          <Row label="Expected Payoff" value={fmtMoney(m.expectedPayoff, currency)} />
          <Row label="Recovery Factor" value={fmtNum(m.recoveryFactor)} />
          <Row label="Retorno total" value={fmtPct(m.totalReturnPct)} />
          <Row label="CAGR aprox." value={fmtPct(m.cagrPct)} />
          <Row label="Sharpe Ratio" value={fmtNum(m.sharpe)} />
          <Row label="Sortino Ratio" value={fmtNum(m.sortino)} />
        </Card>

        <Card delay={60}>
          <h3 className="mb-2 font-semibold text-brand">Operaciones</h3>
          <Row label="Total" value={fmtNum(m.totalTrades, 0)} />
          <Row label="Longs / Shorts" value={`${m.longs} / ${m.shorts}`} />
          <Row label="Win rate longs" value={fmtPct(m.longWinRate)} />
          <Row label="Win rate shorts" value={fmtPct(m.shortWinRate)} />
          <Row label="Win rate global" value={fmtPct(m.winRate)} tone="brand" />
          <Row label="Ganadoras / Perdedoras" value={`${m.wins} / ${m.losses}`} />
          <Row label="Mejor operación" value={fmtMoney(m.bestTrade, currency)} tone="pos" />
          <Row label="Peor operación" value={fmtMoney(m.worstTrade, currency)} tone="neg" />
          <Row label="Media ganancia" value={fmtMoney(m.avgWin, currency)} tone="pos" />
          <Row label="Media pérdida" value={fmtMoney(m.avgLoss, currency)} tone="neg" />
          <Row label="Ratio win/loss" value={fmtNum(m.winLossRatio)} />
          <Row label="Duración media" value={fmtDuration(m.avgDurationMs)} />
        </Card>

        <Card delay={120}>
          <h3 className="mb-2 font-semibold text-brand">Riesgo / Drawdown</h3>
          <Row label="Max DD absoluto" value={fmtMoney(m.maxDrawdownAbs, currency)} tone="neg" />
          <Row label="Max DD relativo" value={fmtPct(m.maxDrawdownPct)} tone="neg" />
          <Row label="DD actual" value={fmtMoney(m.currentDrawdownAbs, currency)} />
          <Row label="DD más largo" value={fmtDuration(m.longestDdDurationMs)} />
          <Row label="Desv. típica retornos" value={fmtMoney(m.stdDevReturns, currency)} />
          <div className="mt-4 border-t border-white/10 pt-3">
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Rachas máximas</h4>
            <Row
              label={`${m.maxWinStreak.count} ganadoras seguidas`}
              value={fmtMoney(m.maxWinStreak.amount, currency)}
              tone="pos"
            />
            <Row
              label={`${m.maxLossStreak.count} perdedoras seguidas`}
              value={fmtMoney(m.maxLossStreak.amount, currency)}
              tone="neg"
            />
          </div>
        </Card>
      </div>

      {/* Métricas reportadas por el propio archivo (validación) */}
      {dataset.result.meta.reported && Object.keys(dataset.result.meta.reported).length > 0 && (
        <Card>
          <h3 className="mb-2 text-sm font-semibold text-slate-300">Valores reportados en el archivo original</h3>
          <div className="flex flex-wrap gap-4">
            {Object.entries(dataset.result.meta.reported).map(([k, v]) => (
              <div key={k} className="text-sm">
                <span className="text-slate-500">{k}: </span>
                <span className="tnum font-semibold text-white">{v}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card delay={60}>
        <h3 className="mb-3 font-semibold text-white">P&L por operación</h3>
        <PnLBars trades={filteredTrades} currency={currency} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="mb-3 font-semibold text-white">Distribución de resultados</h3>
          <DistributionChart trades={filteredTrades} />
        </Card>
        <Card delay={60}>
          <h3 className="mb-3 font-semibold text-white">P&L mensual</h3>
          <MonthlyChart trades={filteredTrades} currency={currency} />
        </Card>
      </div>

      <Card delay={60}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-white">Rendimiento {GROUP_LABELS[group].toLowerCase()}</h3>
          <div className="flex gap-1 rounded-lg bg-surface-2 p-1">
            {(Object.keys(GROUP_LABELS) as GroupMode[]).map((g) => (
              <button
                key={g}
                onClick={() => setGroup(g)}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                  group === g ? 'bg-brand/15 text-brand' : 'text-slate-400 hover:text-white'
                }`}
              >
                {GROUP_LABELS[g]}
              </button>
            ))}
          </div>
        </div>
        <BreakdownChart trades={filteredTrades} mode={group} currency={currency} />
      </Card>
    </div>
  );
}
