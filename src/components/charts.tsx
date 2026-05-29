// Componentes de gráficos basados en Recharts, con estética dark fintech.

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { EquityPoint, Trade } from '../types';
import { fmtMoney, fmtNum } from '../lib/format';
import { breakdownBy, monthlyPnl, profitHistogram, WEEKDAYS, type Breakdown } from '../lib/metrics';

const BRAND = '#3b82f6';
const BRAND_LIGHT = '#60a5fa';
const ACCENT = '#22d3ee';
const POS = '#34d399';
const NEG = '#f87171';
const GRID = 'rgba(148,163,184,0.12)';
const AXIS = 'rgba(148,163,184,0.6)';

const axisProps = {
  stroke: AXIS,
  tick: { fill: AXIS, fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: GRID },
};

function ChartFrame({ children, height = 280 }: { children: React.ReactElement; height?: number }) {
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

const tooltipStyle = {
  contentStyle: {
    background: 'rgba(15,23,41,0.96)',
    border: '1px solid rgba(148,163,184,0.2)',
    borderRadius: 12,
    color: '#e2e8f0',
    fontSize: 12,
  },
  labelStyle: { color: '#94a3b8' },
};

/** Curva de equity/balance: línea + área con gradiente dorado. */
export function EquityChart({ equity, currency }: { equity: EquityPoint[]; currency: string }) {
  const data = equity.map((p) => ({ x: p.index, balance: Math.round(p.balance) }));
  return (
    <ChartFrame>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={BRAND_LIGHT} stopOpacity={0.5} />
            <stop offset="100%" stopColor={BRAND} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="equityStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={BRAND} />
            <stop offset="100%" stopColor={ACCENT} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="x" {...axisProps} />
        <YAxis {...axisProps} width={64} tickFormatter={(v) => fmtNum(v, 0)} domain={['auto', 'auto']} />
        <Tooltip
          {...tooltipStyle}
          formatter={(v: number) => [fmtMoney(v, currency), 'Balance']}
          labelFormatter={(l) => `Operación #${l}`}
        />
        <Area
          type="monotone"
          dataKey="balance"
          stroke="url(#equityStroke)"
          strokeWidth={2.5}
          fill="url(#equityGrad)"
          animationDuration={700}
        />
      </AreaChart>
    </ChartFrame>
  );
}

/** Curva de drawdown: área roja bajo cero. */
export function DrawdownChart({ equity }: { equity: EquityPoint[] }) {
  const data = equity.map((p) => ({ x: p.index, dd: -p.ddPct }));
  return (
    <ChartFrame height={200}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={NEG} stopOpacity={0.05} />
            <stop offset="100%" stopColor={NEG} stopOpacity={0.5} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="x" {...axisProps} />
        <YAxis {...axisProps} width={48} tickFormatter={(v) => `${fmtNum(Math.abs(v), 0)}%`} />
        <Tooltip
          {...tooltipStyle}
          formatter={(v: number) => [`${fmtNum(Math.abs(v), 2)}%`, 'Drawdown']}
          labelFormatter={(l) => `Operación #${l}`}
        />
        <Area type="monotone" dataKey="dd" stroke={NEG} strokeWidth={1.5} fill="url(#ddGrad)" animationDuration={700} />
      </AreaChart>
    </ChartFrame>
  );
}

/** P&L por operación: barras verde/rojo. */
export function PnLBars({ trades, currency }: { trades: Trade[]; currency: string }) {
  const data = trades.map((t) => ({ x: t.index + 1, profit: Math.round(t.profit * 100) / 100 }));
  return (
    <ChartFrame>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="x" {...axisProps} />
        <YAxis {...axisProps} width={64} tickFormatter={(v) => fmtNum(v, 0)} />
        <ReferenceLine y={0} stroke={AXIS} />
        <Tooltip
          {...tooltipStyle}
          formatter={(v: number) => [fmtMoney(v, currency), 'P&L']}
          labelFormatter={(l) => `Operación #${l}`}
        />
        <Bar dataKey="profit" animationDuration={600} radius={[2, 2, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.profit >= 0 ? POS : NEG} />
          ))}
        </Bar>
      </BarChart>
    </ChartFrame>
  );
}

/** Histograma de distribución de resultados por operación. */
export function DistributionChart({ trades }: { trades: Trade[] }) {
  const data = profitHistogram(trades, 24);
  return (
    <ChartFrame height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="range" {...axisProps} interval={3} angle={0} />
        <YAxis {...axisProps} width={40} />
        <Tooltip
          {...tooltipStyle}
          formatter={(v: number) => [v, 'Operaciones']}
          labelFormatter={(l) => `Rango ${l}`}
        />
        <Bar dataKey="count" animationDuration={600} radius={[3, 3, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.mid >= 0 ? POS : NEG} />
          ))}
        </Bar>
      </BarChart>
    </ChartFrame>
  );
}

/** P&L mensual: barras verde/rojo por mes. */
export function MonthlyChart({ trades, currency }: { trades: Trade[]; currency: string }) {
  const data = monthlyPnl(trades).map((m) => ({ ...m, profit: Math.round(m.profit) }));
  if (!data.length) return <Empty />;
  return (
    <ChartFrame height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="month" {...axisProps} interval={Math.max(0, Math.floor(data.length / 12))} />
        <YAxis {...axisProps} width={64} tickFormatter={(v) => fmtNum(v, 0)} />
        <ReferenceLine y={0} stroke={AXIS} />
        <Tooltip {...tooltipStyle} formatter={(v: number) => [fmtMoney(v, currency), 'P&L mensual']} />
        <Bar dataKey="profit" animationDuration={600} radius={[3, 3, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.profit >= 0 ? POS : NEG} />
          ))}
        </Bar>
      </BarChart>
    </ChartFrame>
  );
}

export type GroupMode = 'symbol' | 'hour' | 'weekday';

/** Win rate y profit por símbolo / hora / día de la semana. */
export function BreakdownChart({
  trades,
  mode,
  currency,
}: {
  trades: Trade[];
  mode: GroupMode;
  currency: string;
}) {
  let groups: Breakdown[];
  if (mode === 'symbol') {
    groups = breakdownBy(trades, (t) => t.symbol).sort((a, b) => b.profit - a.profit);
  } else if (mode === 'hour') {
    groups = breakdownBy(trades, (t) => {
      const d = t.closeTime ?? t.openTime;
      return d ? String(d.getHours()).padStart(2, '0') : null;
    }).sort((a, b) => a.key.localeCompare(b.key));
  } else {
    groups = breakdownBy(trades, (t) => {
      const d = t.closeTime ?? t.openTime;
      return d ? WEEKDAYS[d.getDay()] : null;
    });
    const order = WEEKDAYS;
    groups.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  }
  const data = groups.map((g) => ({ ...g, profit: Math.round(g.profit), winRate: Math.round(g.winRate) }));
  if (!data.length) return <Empty />;
  return (
    <ChartFrame height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="key" {...axisProps} />
        <YAxis {...axisProps} width={64} tickFormatter={(v) => fmtNum(v, 0)} />
        <ReferenceLine y={0} stroke={AXIS} />
        <Tooltip
          {...tooltipStyle}
          formatter={(v: number, name: string) =>
            name === 'profit' ? [fmtMoney(v, currency), 'P&L'] : [v, name]
          }
          labelFormatter={(l) => `${l}`}
          content={undefined}
        />
        <Bar dataKey="profit" name="profit" animationDuration={600} radius={[3, 3, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.profit >= 0 ? POS : NEG} />
          ))}
        </Bar>
      </BarChart>
    </ChartFrame>
  );
}

/** Curva de equity de una ventana del simulador (best/worst). */
export function WindowCurve({
  curve,
  color,
}: {
  curve: { i: number; equity: number }[];
  color: string;
}) {
  if (!curve.length) return <Empty label="Sin datos de ventana" />;
  return (
    <ChartFrame height={200}>
      <LineChart data={curve} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="i" {...axisProps} />
        <YAxis {...axisProps} width={64} tickFormatter={(v) => fmtNum(v, 0)} domain={['auto', 'auto']} />
        <Tooltip {...tooltipStyle} formatter={(v: number) => [fmtNum(v, 0), 'Equity']} />
        <Line type="monotone" dataKey="equity" stroke={color} strokeWidth={2} dot={false} animationDuration={600} />
      </LineChart>
    </ChartFrame>
  );
}

function Empty({ label = 'Sin datos suficientes' }: { label?: string }) {
  return (
    <div className="flex h-[200px] items-center justify-center text-sm text-slate-500">{label}</div>
  );
}
