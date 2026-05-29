// Exportación de datos: CSV / JSON de operaciones y métricas. PDF vía impresión.

import type { Trade } from '../types';
import type { Metrics } from './metrics';
import { fmtDateTime } from './format';

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportTradesCsv(trades: Trade[]) {
  const headers = [
    'index',
    'openTime',
    'closeTime',
    'symbol',
    'type',
    'lots',
    'openPrice',
    'closePrice',
    'sl',
    'tp',
    'commission',
    'swap',
    'profit',
    'balanceAfter',
  ];
  const rows = trades.map((t) =>
    [
      t.index,
      t.openTime ? t.openTime.toISOString() : '',
      t.closeTime ? t.closeTime.toISOString() : '',
      t.symbol,
      t.type,
      t.lots,
      t.openPrice ?? '',
      t.closePrice ?? '',
      t.sl ?? '',
      t.tp ?? '',
      t.commission,
      t.swap,
      t.profit,
      t.balanceAfter,
    ].join(','),
  );
  download('operaciones.csv', [headers.join(','), ...rows].join('\n'), 'text/csv');
}

export function exportMetricsJson(metrics: Metrics) {
  const serializable = {
    ...metrics,
    start: metrics.start ? fmtDateTime(metrics.start) : null,
    end: metrics.end ? fmtDateTime(metrics.end) : null,
  };
  download('metricas.json', JSON.stringify(serializable, null, 2), 'application/json');
}

/** Exporta el dashboard a PDF usando el diálogo de impresión del navegador. */
export function exportPdf() {
  window.print();
}
