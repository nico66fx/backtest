// Motor de métricas: calcula todas las estadísticas del backtest a partir de
// la lista normalizada de operaciones.

import type { EquityPoint, Trade } from '../types';

export interface Streak {
  count: number;
  amount: number;
}

export interface Breakdown {
  key: string;
  trades: number;
  profit: number;
  winRate: number;
}

export interface Metrics {
  // Rentabilidad
  netProfit: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number;
  expectedPayoff: number;
  recoveryFactor: number;
  totalReturnPct: number;
  cagrPct: number;
  sharpe: number;
  sortino: number;
  // Operaciones
  totalTrades: number;
  longs: number;
  shorts: number;
  longWinRate: number;
  shortWinRate: number;
  winRate: number;
  wins: number;
  losses: number;
  bestTrade: number;
  worstTrade: number;
  avgWin: number;
  avgLoss: number;
  winLossRatio: number;
  maxWinStreak: Streak;
  maxLossStreak: Streak;
  avgDurationMs: number;
  // Riesgo / drawdown
  maxDrawdownAbs: number;
  maxDrawdownPct: number;
  currentDrawdownAbs: number;
  longestDdDurationMs: number;
  stdDevReturns: number;
  // Periodo
  initialDeposit: number;
  finalBalance: number;
  start: Date | null;
  end: Date | null;
}

/** Construye la curva de equity/balance acumulada con drawdown en cada punto. */
export function buildEquityCurve(trades: Trade[], initialDeposit: number): EquityPoint[] {
  const points: EquityPoint[] = [];
  let balance = initialDeposit;
  let peak = initialDeposit;
  // Punto inicial (depósito).
  points.push({ index: 0, time: trades[0]?.openTime ?? null, balance, ddAbs: 0, ddPct: 0 });
  trades.forEach((t, i) => {
    balance = Number.isFinite(t.balanceAfter) && t.balanceAfter !== 0 ? t.balanceAfter : balance + t.profit;
    if (balance > peak) peak = balance;
    const ddAbs = Math.max(0, peak - balance);
    const ddPct = peak > 0 ? (ddAbs / peak) * 100 : 0;
    points.push({ index: i + 1, time: t.closeTime ?? t.openTime, balance, ddAbs, ddPct });
  });
  return points;
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function stdDev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const variance = xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(variance);
}

/** Estima el depósito inicial cuando el reporte no lo aporta. */
export function inferInitialDeposit(trades: Trade[], reported?: number): number {
  if (reported && reported > 0) return reported;
  // Si hay balanceAfter del primer trade, el depósito es balance - profit.
  const first = trades[0];
  if (first && Number.isFinite(first.balanceAfter) && first.balanceAfter !== 0) {
    const dep = first.balanceAfter - first.profit;
    if (dep > 0) return dep;
  }
  // Heurística: 10.000 por defecto.
  return 10000;
}

export function computeMetrics(trades: Trade[], initialDeposit: number): Metrics {
  const n = trades.length;
  const profits = trades.map((t) => t.profit);
  const wins = profits.filter((p) => p > 0);
  const losses = profits.filter((p) => p < 0);

  const grossProfit = wins.reduce((a, b) => a + b, 0);
  const grossLoss = Math.abs(losses.reduce((a, b) => a + b, 0));
  const netProfit = grossProfit - grossLoss;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  const equity = buildEquityCurve(trades, initialDeposit);
  const finalBalance = equity[equity.length - 1]?.balance ?? initialDeposit;
  const maxDrawdownAbs = Math.max(0, ...equity.map((p) => p.ddAbs));
  const maxDrawdownPct = Math.max(0, ...equity.map((p) => p.ddPct));
  const currentDrawdownAbs = equity[equity.length - 1]?.ddAbs ?? 0;

  // Duración del mayor drawdown (en ms): tiempo entre pico y recuperación.
  const longestDdDurationMs = computeLongestDdDuration(equity);

  // Rachas.
  const maxWinStreak = computeStreak(profits, (p) => p > 0);
  const maxLossStreak = computeStreak(profits, (p) => p < 0);

  // Long / short.
  const longTrades = trades.filter((t) => t.type === 'long');
  const shortTrades = trades.filter((t) => t.type === 'short');
  const longWins = longTrades.filter((t) => t.profit > 0).length;
  const shortWins = shortTrades.filter((t) => t.profit > 0).length;

  // Sharpe / Sortino sobre retornos por operación.
  const sd = stdDev(profits);
  const avgRet = mean(profits);
  const downside = profits.filter((p) => p < 0);
  const downsideDev = downside.length
    ? Math.sqrt(downside.reduce((a, b) => a + b * b, 0) / downside.length)
    : 0;
  const sharpe = sd > 0 ? (avgRet / sd) * Math.sqrt(n || 1) : 0;
  const sortino = downsideDev > 0 ? (avgRet / downsideDev) * Math.sqrt(n || 1) : 0;

  // CAGR aproximado.
  const start = firstTime(trades);
  const end = lastTime(trades);
  const years = start && end ? Math.max((end.getTime() - start.getTime()) / (365.25 * 864e5), 1 / 365) : 0;
  const totalReturnPct = initialDeposit > 0 ? (netProfit / initialDeposit) * 100 : 0;
  const cagrPct =
    initialDeposit > 0 && finalBalance > 0 && years > 0
      ? (Math.pow(finalBalance / initialDeposit, 1 / years) - 1) * 100
      : 0;

  const durations = trades
    .map((t) => (t.openTime && t.closeTime ? t.closeTime.getTime() - t.openTime.getTime() : NaN))
    .filter((d) => Number.isFinite(d) && d >= 0);

  return {
    netProfit,
    grossProfit,
    grossLoss,
    profitFactor,
    expectedPayoff: n ? netProfit / n : 0,
    recoveryFactor: maxDrawdownAbs > 0 ? netProfit / maxDrawdownAbs : netProfit > 0 ? Infinity : 0,
    totalReturnPct,
    cagrPct,
    sharpe,
    sortino,
    totalTrades: n,
    longs: longTrades.length,
    shorts: shortTrades.length,
    longWinRate: longTrades.length ? (longWins / longTrades.length) * 100 : 0,
    shortWinRate: shortTrades.length ? (shortWins / shortTrades.length) * 100 : 0,
    winRate: n ? (wins.length / n) * 100 : 0,
    wins: wins.length,
    losses: losses.length,
    bestTrade: n ? Math.max(...profits) : 0,
    worstTrade: n ? Math.min(...profits) : 0,
    avgWin: wins.length ? mean(wins) : 0,
    avgLoss: losses.length ? mean(losses) : 0,
    winLossRatio: losses.length && wins.length ? Math.abs(mean(wins) / mean(losses)) : 0,
    maxWinStreak,
    maxLossStreak,
    avgDurationMs: durations.length ? mean(durations) : 0,
    maxDrawdownAbs,
    maxDrawdownPct,
    currentDrawdownAbs,
    longestDdDurationMs,
    stdDevReturns: sd,
    initialDeposit,
    finalBalance,
    start,
    end,
  };
}

function computeStreak(profits: number[], pred: (p: number) => boolean): Streak {
  let best: Streak = { count: 0, amount: 0 };
  let count = 0;
  let amount = 0;
  for (const p of profits) {
    if (pred(p)) {
      count++;
      amount += p;
      if (count > best.count || (count === best.count && Math.abs(amount) > Math.abs(best.amount))) {
        best = { count, amount };
      }
    } else {
      count = 0;
      amount = 0;
    }
  }
  return best;
}

function computeLongestDdDuration(equity: EquityPoint[]): number {
  let longest = 0;
  let peakTime: number | null = null;
  let peakBalance = -Infinity;
  for (const p of equity) {
    const t = p.time?.getTime() ?? null;
    if (p.balance >= peakBalance) {
      peakBalance = p.balance;
      peakTime = t;
    } else if (peakTime != null && t != null) {
      longest = Math.max(longest, t - peakTime);
    }
  }
  return longest;
}

function firstTime(trades: Trade[]): Date | null {
  for (const t of trades) {
    if (t.openTime) return t.openTime;
    if (t.closeTime) return t.closeTime;
  }
  return null;
}

function lastTime(trades: Trade[]): Date | null {
  for (let i = trades.length - 1; i >= 0; i--) {
    if (trades[i].closeTime) return trades[i].closeTime;
    if (trades[i].openTime) return trades[i].openTime;
  }
  return null;
}

/** P&L mensual: clave "YYYY-MM" -> profit. */
export function monthlyPnl(trades: Trade[]): { month: string; profit: number }[] {
  const map = new Map<string, number>();
  for (const t of trades) {
    const d = t.closeTime ?? t.openTime;
    if (!d) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    map.set(key, (map.get(key) ?? 0) + t.profit);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, profit]) => ({ month, profit }));
}

/** Agrupa por una clave arbitraria (símbolo, hora, día de la semana). */
export function breakdownBy(trades: Trade[], keyFn: (t: Trade) => string | null): Breakdown[] {
  const map = new Map<string, { trades: number; profit: number; wins: number }>();
  for (const t of trades) {
    const key = keyFn(t);
    if (key == null) continue;
    const e = map.get(key) ?? { trades: 0, profit: 0, wins: 0 };
    e.trades++;
    e.profit += t.profit;
    if (t.profit > 0) e.wins++;
    map.set(key, e);
  }
  return Array.from(map.entries()).map(([key, e]) => ({
    key,
    trades: e.trades,
    profit: e.profit,
    winRate: e.trades ? (e.wins / e.trades) * 100 : 0,
  }));
}

export const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/** Distribución (histograma) de profit por operación en N buckets. */
export function profitHistogram(trades: Trade[], buckets = 20): { range: string; count: number; mid: number }[] {
  if (!trades.length) return [];
  const profits = trades.map((t) => t.profit);
  const min = Math.min(...profits);
  const max = Math.max(...profits);
  if (min === max) return [{ range: min.toFixed(0), count: profits.length, mid: min }];
  const width = (max - min) / buckets;
  const bins = Array.from({ length: buckets }, (_, i) => ({
    lo: min + i * width,
    hi: min + (i + 1) * width,
    count: 0,
  }));
  for (const p of profits) {
    let idx = Math.floor((p - min) / width);
    if (idx >= buckets) idx = buckets - 1;
    if (idx < 0) idx = 0;
    bins[idx].count++;
  }
  return bins.map((b) => ({
    range: `${b.lo.toFixed(0)}…${b.hi.toFixed(0)}`,
    count: b.count,
    mid: (b.lo + b.hi) / 2,
  }));
}
