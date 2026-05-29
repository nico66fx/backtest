// Web Worker para ejecutar la simulación de fondeos sin bloquear la UI.

import type { Trade } from '../types';
import { simulateFunding, type FundingConfig, type FundingSummary } from './funding';

export interface WorkerRequest {
  trades: Trade[];
  initialDeposit: number;
  config: FundingConfig;
}

export interface WorkerResponse {
  summary: FundingSummary;
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { trades, initialDeposit, config } = e.data;
  // Las fechas viajan como strings al serializarse; las rehidratamos.
  const hydrated: Trade[] = trades.map((t) => ({
    ...t,
    openTime: t.openTime ? new Date(t.openTime) : null,
    closeTime: t.closeTime ? new Date(t.closeTime) : null,
  }));
  const summary = simulateFunding(hydrated, initialDeposit, config);
  const res: WorkerResponse = { summary };
  (self as unknown as Worker).postMessage(res);
};
