// Genera un backtest de ejemplo realista (con tendencias, rachas y drawdowns)
// para que la app sea explorable sin necesidad de un archivo real.

import type { ParseResult, Trade } from '../types';

// PRNG determinista (mulberry32) para que el ejemplo sea siempre el mismo.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateSample(): ParseResult {
  const rand = mulberry32(20240517);
  const symbols = ['EURUSD', 'XAUUSD', 'GBPUSD', 'US100'];
  const initialDeposit = 10000;
  const trades: Trade[] = [];
  let balance = initialDeposit;
  let time = new Date(2023, 0, 3, 8, 0, 0).getTime();
  const N = 420;

  for (let i = 0; i < N; i++) {
    // Avance temporal: varias operaciones al día, saltando fines de semana.
    time += (2 + rand() * 10) * 3600 * 1000;
    let d = new Date(time);
    while (d.getDay() === 0 || d.getDay() === 6) {
      time += 24 * 3600 * 1000;
      d = new Date(time);
    }
    const openTime = new Date(time);
    const durMs = (0.5 + rand() * 12) * 3600 * 1000;
    const closeTime = new Date(time + durMs);

    const symbol = symbols[Math.floor(rand() * symbols.length)];
    const side = rand() > 0.45 ? 'long' : 'short';
    const lots = Math.round((0.1 + rand() * 0.9) * 100) / 100;

    // Sistema con edge positivo: ~55% win, ganancias algo mayores que pérdidas,
    // con tramos de mala racha para generar drawdowns visibles.
    const regime = Math.sin(i / 35) + (rand() - 0.5);
    const win = rand() < 0.52 + regime * 0.06;
    let profit: number;
    if (win) {
      profit = (40 + rand() * 220) * lots * 3;
    } else {
      profit = -(40 + rand() * 160) * lots * 3;
    }
    profit = Math.round(profit * 100) / 100;
    const commission = -Math.round(lots * 7 * 100) / 100;
    const swap = rand() > 0.7 ? -Math.round(rand() * 3 * 100) / 100 : 0;
    const net = profit + commission + swap;
    balance += net;

    const openPrice = Math.round((1 + rand()) * 10000) / 10000;
    const closePrice = Math.round((openPrice + (rand() - 0.5) * 0.01) * 10000) / 10000;

    trades.push({
      index: i,
      openTime,
      closeTime,
      symbol,
      type: side,
      lots,
      openPrice,
      closePrice,
      sl: Math.round((openPrice - 0.005) * 10000) / 10000,
      tp: Math.round((openPrice + 0.008) * 10000) / 10000,
      commission,
      swap,
      profit: net,
      balanceAfter: Math.round(balance * 100) / 100,
    });
  }

  return {
    trades,
    meta: {
      source: 'sample',
      fileName: 'Ejemplo · Estrategia multi-símbolo',
      symbol: 'Multi',
      period: '2023.01 – 2024.xx',
      initialDeposit,
      leverage: '1:100',
      currency: 'USD',
      modelQuality: '99,9% (ejemplo)',
    },
    warnings: [],
  };
}
