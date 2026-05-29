// Simulador de fondeos de prop firms.
//
// Modelo SECUENCIAL/CONSECUTIVO: se simula como una persona que compra un fondeo,
// lo opera desde la operación N hasta que (a) lo pasa o (b) lo quema, y en cuanto
// termina arranca un fondeo NUEVO desde la siguiente operación. Así, el backtest
// se parte en intentos consecutivos encadenados, sin solaparse.
//
// Aproximación: la equity intradía se reconstruye con los precios/horas de CIERRE
// de cada operación (no replica el peor tick intradía real).

import type { Trade } from '../types';

// Cómo se escala el P&L del backtest al challenge (todo proporcional):
//  - 'auto'      : proporcional al capital (capital del challenge / depósito del backtest)
//  - 'multiplier': multiplicador manual sobre el lotaje original del backtest
//  - 'fixedLot'  : fijas un lotaje objetivo → factor = objetivo / lote medio del backtest
export type LotMode = 'auto' | 'multiplier' | 'fixedLot';
export type FailReason = 'daily' | 'maxdd' | 'timeout' | null;
// 'incomplete' = el backtest se acabó con el intento aún en curso (no resuelto).
export type Outcome = 'funded' | 'phase1' | 'failed' | 'incomplete';

export interface FundingConfig {
  accountSize: number;
  /** Objetivo de beneficio fase 1 (%). */
  phase1TargetPct: number;
  /** Objetivo fase 2 (%); null = challenge de una sola fase. */
  phase2TargetPct: number | null;
  /** Pérdida diaria máxima (% del capital). */
  dailyLossPct: number;
  /** Pérdida total / max drawdown (% del capital). */
  maxLossPct: number;
  /** Drawdown máximo estático (desde capital inicial) o trailing (desde el pico). */
  trailing: boolean;
  /** Días mínimos de trading exigidos por fase. */
  minTradingDays: number;
  /** Límite de tiempo por fase en días; null = ilimitado. */
  maxDays: number | null;
  /** Modo de ajuste de lotaje/escalado. */
  lotMode: LotMode;
  /** Multiplicador sobre el lotaje original (modo 'multiplier'). */
  lotMultiplier: number;
  /** Lotaje objetivo (modo 'fixedLot'). */
  targetLot: number;
}

export const PROP_PRESETS: Record<string, Partial<FundingConfig> & { label: string }> = {
  ftmo2: {
    label: 'FTMO · 2 fases',
    phase1TargetPct: 10,
    phase2TargetPct: 5,
    dailyLossPct: 5,
    maxLossPct: 10,
    trailing: false,
    minTradingDays: 4,
    maxDays: null,
  },
  the5ers: {
    label: 'The5ers · Hi-Stakes',
    phase1TargetPct: 8,
    phase2TargetPct: 5,
    dailyLossPct: 5,
    maxLossPct: 10,
    trailing: false,
    minTradingDays: 3,
    maxDays: null,
  },
  oneStep: {
    label: 'Genérico · 1 fase',
    phase1TargetPct: 10,
    phase2TargetPct: null,
    dailyLossPct: 5,
    maxLossPct: 6,
    trailing: true,
    minTradingDays: 0,
    maxDays: 30,
  },
  instant: {
    label: 'Evaluación rápida',
    phase1TargetPct: 8,
    phase2TargetPct: null,
    dailyLossPct: 4,
    maxLossPct: 8,
    trailing: false,
    minTradingDays: 5,
    maxDays: null,
  },
};

export const DEFAULT_CONFIG: FundingConfig = {
  accountSize: 100000,
  phase1TargetPct: 10,
  phase2TargetPct: 5,
  dailyLossPct: 5,
  maxLossPct: 10,
  trailing: false,
  minTradingDays: 4,
  maxDays: null,
  lotMode: 'auto',
  lotMultiplier: 1,
  targetLot: 0.1,
};

/** Lote medio del backtest (ignora operaciones con lotaje 0/desconocido). */
export function averageLots(trades: Trade[]): number {
  const ls = trades.map((t) => t.lots).filter((l) => Number.isFinite(l) && l > 0);
  if (!ls.length) return 0;
  return ls.reduce((a, b) => a + b, 0) / ls.length;
}

/** Factor proporcional que se aplica al P&L de cada operación según el modo. */
export function scaleFactor(trades: Trade[], initialDeposit: number, cfg: FundingConfig): number {
  if (cfg.lotMode === 'multiplier') return cfg.lotMultiplier > 0 ? cfg.lotMultiplier : 1;
  if (cfg.lotMode === 'fixedLot') {
    const avg = averageLots(trades);
    return avg > 0 ? cfg.targetLot / avg : 1;
  }
  // 'auto': proporcional al capital del challenge.
  return initialDeposit > 0 ? cfg.accountSize / initialDeposit : 1;
}

export interface PhaseResult {
  passed: boolean;
  reason: FailReason;
  days: number;
  /** Índice de la última operación consumida por la fase. */
  endIndex: number;
  /** false = se agotaron los datos antes de pasar/quemar (intento en curso). */
  resolved: boolean;
}

export interface WindowResult {
  /** Número de intento consecutivo (1, 2, 3…). */
  attempt: number;
  startIndex: number;
  /** Índice de la última operación de este intento (para encadenar el siguiente). */
  endIndex: number;
  startTime: number | null; // epoch ms
  endTime: number | null;
  outcome: Outcome;
  reason: FailReason;
  totalDays: number;
  phase1Days: number;
  phase2Days: number | null;
}

export interface FundingSummary {
  /** Intentos totales resueltos (excluye el intento en curso al final). */
  totalAttempts: number;
  funded: number;
  phase1Only: number;
  failed: number;
  incomplete: number;
  passRatePct: number;
  failByReason: { daily: number; maxdd: number; timeout: number };
  avgDaysPhase1: number;
  avgDaysPhase2: number | null;
  windows: WindowResult[];
  bestCurve: { i: number; equity: number }[];
  worstCurve: { i: number; equity: number }[];
  bestWindowIndex: number;
  worstWindowIndex: number;
  hasTimes: boolean;
}

interface ScaledTrade {
  profit: number;
  day: number; // índice de día (epoch día) o secuencial si no hay tiempos
  time: number | null;
}

/** Día (UTC local) como número entero para agrupar. */
function dayNumber(d: Date): number {
  return Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 864e5);
}

function buildScaled(trades: Trade[], initialDeposit: number, cfg: FundingConfig): { scaled: ScaledTrade[]; hasTimes: boolean } {
  const factor = scaleFactor(trades, initialDeposit, cfg);
  const hasTimes = trades.some((t) => t.closeTime || t.openTime);
  const scaled = trades.map((t, i) => {
    const d = t.closeTime ?? t.openTime;
    return {
      profit: t.profit * factor,
      day: d ? dayNumber(d) : i, // sin tiempos, cada trade es su propio "día"
      time: d ? d.getTime() : null,
    };
  });
  return { scaled, hasTimes };
}

interface SimPhaseOpts {
  targetAmount: number;
  startEquity: number;
  maxFloorBase: number; // capital de referencia para max DD
  cfg: FundingConfig;
  captureCurve?: { i: number; equity: number }[];
  curveOffset?: number;
}

/**
 * Simula una fase desde `from` (inclusive). Devuelve el resultado y el índice
 * donde terminó (para encadenar la fase 2).
 */
function simulatePhase(
  scaled: ScaledTrade[],
  from: number,
  opts: SimPhaseOpts,
): PhaseResult {
  const { cfg } = opts;
  let equity = opts.startEquity;
  let peak = opts.startEquity;
  const maxLossAmount = (cfg.maxLossPct / 100) * cfg.accountSize;
  const dailyLossAmount = (cfg.dailyLossPct / 100) * cfg.accountSize;

  let currentDay = scaled[from]?.day ?? 0;
  let dayStartEquity = equity;
  let dayMinEquity = equity;
  const tradingDays = new Set<number>();
  const startTime = scaled[from]?.time ?? null;
  let days = 0;

  for (let i = from; i < scaled.length; i++) {
    const tr = scaled[i];

    if (tr.day !== currentDay) {
      currentDay = tr.day;
      dayStartEquity = equity;
      dayMinEquity = equity;
    }

    equity += tr.profit;
    tradingDays.add(tr.day);
    if (equity < dayMinEquity) dayMinEquity = equity;
    if (equity > peak) peak = equity;

    if (opts.captureCurve) {
      opts.captureCurve.push({ i: (opts.curveOffset ?? 0) + (i - from), equity });
    }

    // Tiempo transcurrido (días) desde el inicio de la fase.
    if (startTime != null && tr.time != null) {
      days = Math.round((tr.time - startTime) / 864e5);
    } else {
      days = i - from + 1;
    }

    // 1) Max drawdown.
    const maxFloor = cfg.trailing ? peak - maxLossAmount : opts.maxFloorBase - maxLossAmount;
    if (equity <= maxFloor) {
      return { passed: false, reason: 'maxdd', days, endIndex: i, resolved: true };
    }

    // 2) Daily drawdown (peor punto del día vs inicio del día).
    const dayFloor = dayStartEquity - dailyLossAmount;
    if (dayMinEquity <= dayFloor) {
      return { passed: false, reason: 'daily', days, endIndex: i, resolved: true };
    }

    // 3) Objetivo alcanzado (con mínimo de días de trading).
    if (equity >= opts.targetAmount && tradingDays.size >= cfg.minTradingDays) {
      return { passed: true, reason: null, days, endIndex: i, resolved: true };
    }

    // 4) Timeout por límite de tiempo configurado.
    if (cfg.maxDays != null && days > cfg.maxDays) {
      return { passed: false, reason: 'timeout', days, endIndex: i, resolved: true };
    }
  }

  // Se acabaron los datos del backtest sin pasar ni quemar: intento EN CURSO.
  return { passed: false, reason: null, days, endIndex: scaled.length - 1, resolved: false };
}

/**
 * Simula UN challenge completo (1 o 2 fases) que arranca en la operación `from`.
 * Devuelve el resultado y `endIndex` = última operación consumida, para que el
 * siguiente intento consecutivo empiece justo después.
 */
function simulateChallenge(
  scaled: ScaledTrade[],
  from: number,
  attempt: number,
  cfg: FundingConfig,
  capture?: { i: number; equity: number }[],
): WindowResult {
  const startTime = scaled[from]?.time ?? null;
  const p1 = simulatePhase(scaled, from, {
    targetAmount: cfg.accountSize * (1 + cfg.phase1TargetPct / 100),
    startEquity: cfg.accountSize,
    maxFloorBase: cfg.accountSize,
    cfg,
    captureCurve: capture,
    curveOffset: 0,
  });

  const base = (endIndex: number, outcome: Outcome, reason: FailReason, p1Days: number, p2Days: number | null) => ({
    attempt,
    startIndex: from,
    endIndex,
    startTime,
    endTime: scaled[endIndex]?.time ?? null,
    outcome,
    reason,
    totalDays: p1Days + (p2Days ?? 0),
    phase1Days: p1Days,
    phase2Days: p2Days,
  });

  // Fase 1 no superada.
  if (!p1.passed) {
    return base(p1.endIndex, p1.resolved ? 'failed' : 'incomplete', p1.reason, p1.days, null);
  }

  // Challenge de una sola fase superado.
  if (cfg.phase2TargetPct == null) {
    return base(p1.endIndex, 'funded', null, p1.days, null);
  }

  // Fase 2: la cuenta se "reinicia" al capital, con objetivo menor.
  const p2 = simulatePhase(scaled, p1.endIndex + 1, {
    targetAmount: cfg.accountSize * (1 + cfg.phase2TargetPct / 100),
    startEquity: cfg.accountSize,
    maxFloorBase: cfg.accountSize,
    cfg,
    captureCurve: capture,
    curveOffset: capture ? capture.length : 0,
  });

  if (p2.passed) return base(p2.endIndex, 'funded', null, p1.days, p2.days);
  // Pasó fase 1 pero no resolvió fase 2: quemado (resolved) o en curso (incomplete).
  return base(p2.endIndex, p2.resolved ? 'phase1' : 'incomplete', p2.reason, p1.days, p2.days);
}

export function simulateFunding(
  trades: Trade[],
  initialDeposit: number,
  cfg: FundingConfig,
): FundingSummary {
  const { scaled, hasTimes } = buildScaled(trades, initialDeposit, cfg);

  // Modelo consecutivo: cada intento arranca donde terminó el anterior.
  const windows: WindowResult[] = [];
  let from = 0;
  let attempt = 1;
  while (from < scaled.length) {
    const w = simulateChallenge(scaled, from, attempt, cfg);
    windows.push(w);
    if (w.endIndex < from) break; // salvaguarda anti-bucle
    from = w.endIndex + 1;
    attempt++;
  }

  const funded = windows.filter((w) => w.outcome === 'funded');
  const phase1Only = windows.filter((w) => w.outcome === 'phase1');
  const failed = windows.filter((w) => w.outcome === 'failed');
  const incomplete = windows.filter((w) => w.outcome === 'incomplete');
  const resolved = windows.filter((w) => w.outcome !== 'incomplete');

  const failByReason = { daily: 0, maxdd: 0, timeout: 0 };
  for (const w of windows) {
    if (w.outcome !== 'funded' && w.outcome !== 'incomplete' && w.reason) failByReason[w.reason]++;
  }

  // Días medios fase 1: intentos que superaron la fase 1 (funded + phase1Only).
  const phase1Passers = windows.filter((w) => w.outcome === 'funded' || w.outcome === 'phase1');
  const avgDaysPhase1 = phase1Passers.length
    ? phase1Passers.reduce((a, w) => a + w.phase1Days, 0) / phase1Passers.length
    : 0;
  const p2list = funded.filter((w) => w.phase2Days != null);
  const avgDaysPhase2 = cfg.phase2TargetPct == null
    ? null
    : p2list.length
      ? p2list.reduce((a, w) => a + (w.phase2Days ?? 0), 0) / p2list.length
      : 0;

  // Mejor intento = fondeado más rápido; peor = el quemado más rápido.
  let bestWindowIndex = -1;
  let bestScore = Infinity;
  funded.forEach((w) => {
    if (w.totalDays < bestScore) {
      bestScore = w.totalDays;
      bestWindowIndex = w.startIndex;
    }
  });
  if (bestWindowIndex < 0 && windows.length) bestWindowIndex = windows[0].startIndex;

  let worstWindowIndex = -1;
  let worstScore = Infinity;
  failed.forEach((w) => {
    if (w.totalDays < worstScore) {
      worstScore = w.totalDays;
      worstWindowIndex = w.startIndex;
    }
  });
  if (worstWindowIndex < 0 && windows.length) {
    worstWindowIndex = windows[windows.length - 1].startIndex;
  }

  const bestCurve: { i: number; equity: number }[] = [];
  const worstCurve: { i: number; equity: number }[] = [];
  if (bestWindowIndex >= 0) simulateChallenge(scaled, bestWindowIndex, 0, cfg, bestCurve);
  if (worstWindowIndex >= 0) simulateChallenge(scaled, worstWindowIndex, 0, cfg, worstCurve);

  return {
    totalAttempts: resolved.length,
    funded: funded.length,
    phase1Only: phase1Only.length,
    failed: failed.length,
    incomplete: incomplete.length,
    passRatePct: resolved.length ? (funded.length / resolved.length) * 100 : 0,
    failByReason,
    avgDaysPhase1,
    avgDaysPhase2,
    windows,
    bestCurve,
    worstCurve,
    bestWindowIndex,
    worstWindowIndex,
    hasTimes,
  };
}
