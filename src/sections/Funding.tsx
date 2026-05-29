import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { Card, SectionTitle } from '../components/Card';
import { StatCard } from '../components/StatCard';
import { Badge } from '../components/Badge';
import { WindowCurve } from '../components/charts';
import {
  DEFAULT_CONFIG,
  PROP_PRESETS,
  averageLots,
  scaleFactor,
  type FundingConfig,
  type FundingSummary,
  type LotMode,
  type WindowResult,
} from '../lib/funding';
import type { WorkerRequest, WorkerResponse } from '../lib/funding.worker';
import { fmtDateTime, fmtDays, fmtMoney, fmtNum, fmtPct } from '../lib/format';

const ACCOUNT_SIZES = [10000, 25000, 50000, 100000, 200000];

/** Hook que ejecuta la simulación en un Web Worker. */
function useFundingWorker() {
  const workerRef = useRef<Worker | null>(null);
  const [summary, setSummary] = useState<FundingSummary | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const worker = new Worker(new URL('../lib/funding.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      setSummary(e.data.summary);
      setRunning(false);
    };
    workerRef.current = worker;
    return () => worker.terminate();
  }, []);

  const run = (req: WorkerRequest) => {
    if (!workerRef.current) return;
    setRunning(true);
    workerRef.current.postMessage(req);
  };

  return { summary, running, run };
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</label>
      {children}
      {hint && <span className="text-[11px] text-slate-500">{hint}</span>}
    </div>
  );
}

const inputClass =
  'rounded-lg border border-white/10 bg-surface-2 px-3 py-1.5 text-sm text-white focus:border-brand focus:outline-none';

type SetFn = <K extends keyof FundingConfig>(k: K, v: FundingConfig[K]) => void;

const LOT_MODES: { id: LotMode; label: string }[] = [
  { id: 'auto', label: 'Proporcional al capital' },
  { id: 'multiplier', label: 'Multiplicador' },
  { id: 'fixedLot', label: 'Lotaje fijo' },
];

/**
 * Control de lotaje proporcional: permite reescalar el P&L del backtest al
 * tamaño/lotaje del challenge sin tener que volver a ejecutar el backtest.
 */
function LotAdjuster({
  cfg,
  set,
  avgLot,
  factor,
  currency,
}: {
  cfg: FundingConfig;
  set: SetFn;
  avgLot: number;
  factor: number;
  currency: string;
}) {
  const scaledLot = avgLot > 0 ? avgLot * factor : 0;
  return (
    <div className="mt-5 rounded-xl border border-brand/20 bg-brand/[0.04] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-brand">Ajuste de lotaje (proporcional)</h4>
        <span className="text-xs text-slate-400">
          Lote medio del backtest: <span className="tnum font-semibold text-white">{avgLot > 0 ? fmtNum(avgLot, 2) : '—'}</span>
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Modo de escalado">
          <div className="flex flex-wrap gap-1 rounded-lg bg-surface-2 p-1">
            {LOT_MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => set('lotMode', m.id)}
                className={`flex-1 whitespace-nowrap rounded-md px-2 py-1 text-xs font-semibold transition ${
                  cfg.lotMode === m.id ? 'bg-brand/20 text-brand' : 'text-slate-400 hover:text-white'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </Field>

        {cfg.lotMode === 'multiplier' && (
          <Field label="Multiplicador de lotaje (×)" hint="Sobre el lotaje original del backtest">
            <input
              type="number"
              value={cfg.lotMultiplier}
              step={0.1}
              min={0.01}
              onChange={(e) => set('lotMultiplier', +e.target.value)}
              className={inputClass}
            />
          </Field>
        )}

        {cfg.lotMode === 'fixedLot' && (
          <Field label="Lotaje objetivo" hint={avgLot > 0 ? `≈ ×${fmtNum(factor, 2)} sobre el lote medio` : 'sin lotaje en el backtest'}>
            <input
              type="number"
              value={cfg.targetLot}
              step={0.01}
              min={0.01}
              onChange={(e) => set('targetLot', +e.target.value)}
              className={inputClass}
            />
          </Field>
        )}

        {cfg.lotMode === 'auto' && (
          <Field label="Factor aplicado" hint="capital del challenge ÷ depósito del backtest">
            <div className={`${inputClass} pointer-events-none opacity-80`}>×{fmtNum(factor, 2)}</div>
          </Field>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-400">
        <span>
          Factor aplicado al P&L: <span className="tnum font-bold text-brand">×{fmtNum(factor, 2)}</span>
        </span>
        {scaledLot > 0 && (
          <span>
            Lotaje simulado ≈ <span className="tnum font-semibold text-white">{fmtNum(scaledLot, 2)}</span>
          </span>
        )}
        <span>
          Una operación de {fmtMoney(100, currency)} pasa a{' '}
          <span className="tnum font-semibold text-white">{fmtMoney(100 * factor, currency)}</span>
        </span>
      </div>
    </div>
  );
}

export function Funding() {
  const { dataset, filteredTrades } = useStore();
  const { summary, running, run } = useFundingWorker();
  const [cfg, setCfg] = useState<FundingConfig>(DEFAULT_CONFIG);
  const [twoPhase, setTwoPhase] = useState(true);

  const set = <K extends keyof FundingConfig>(k: K, v: FundingConfig[K]) =>
    setCfg((c) => ({ ...c, [k]: v }));

  const applyPreset = (key: string) => {
    const p = PROP_PRESETS[key];
    setCfg((c) => ({ ...c, ...p }));
    setTwoPhase(p.phase2TargetPct != null);
  };

  // Ejecuta la simulación cuando cambian config o datos.
  useEffect(() => {
    if (!dataset || filteredTrades.length === 0) return;
    const config: FundingConfig = { ...cfg, phase2TargetPct: twoPhase ? cfg.phase2TargetPct ?? 5 : null };
    const id = setTimeout(() => {
      run({ trades: filteredTrades, initialDeposit: dataset.initialDeposit, config });
    }, 150);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg, twoPhase, dataset, filteredTrades]);

  // Estadísticas de lotaje / factor de escalado para el control de lotaje (en vivo).
  const avgLot = useMemo(() => averageLots(filteredTrades), [filteredTrades]);
  const factor = useMemo(
    () => (dataset ? scaleFactor(filteredTrades, dataset.initialDeposit, cfg) : 1),
    [filteredTrades, dataset, cfg],
  );
  const currency = dataset?.result.meta.currency ?? 'USD';

  if (!dataset) return null;

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Simulador de fondeos"
        subtitle="Modelo consecutivo: cada vez que pasas o quemas un fondeo, empiezas otro en la siguiente operación."
        right={running ? <Badge tone="brand" pulse>Calculando…</Badge> : <Badge tone="pos" pulse>En vivo</Badge>}
      />

      {/* Presets */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(PROP_PRESETS).map(([key, p]) => (
          <button
            key={key}
            onClick={() => applyPreset(key)}
            className="rounded-xl border border-white/10 bg-surface/50 px-3 py-1.5 text-sm font-semibold text-slate-300 transition hover:border-brand/50 hover:text-brand"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Configuración */}
      <Card>
        <h3 className="mb-4 font-semibold text-brand">Parámetros del challenge</h3>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          <Field label="Capital de la cuenta">
            <select value={cfg.accountSize} onChange={(e) => set('accountSize', +e.target.value)} className={inputClass}>
              {ACCOUNT_SIZES.map((s) => (
                <option key={s} value={s}>
                  {fmtNum(s, 0)} $
                </option>
              ))}
            </select>
          </Field>

          <Field label="Objetivo Fase 1 (%)">
            <input type="number" value={cfg.phase1TargetPct} step={0.5} onChange={(e) => set('phase1TargetPct', +e.target.value)} className={inputClass} />
          </Field>

          <Field label="Segunda fase">
            <div className="flex items-center gap-2 pt-1.5">
              <button
                onClick={() => setTwoPhase((v) => !v)}
                className={`relative h-6 w-11 rounded-full transition ${twoPhase ? 'bg-brand' : 'bg-surface-2'}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${twoPhase ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
              <span className="text-sm text-slate-300">{twoPhase ? 'Activada' : 'Una sola fase'}</span>
            </div>
          </Field>

          <Field label="Objetivo Fase 2 (%)">
            <input
              type="number"
              value={cfg.phase2TargetPct ?? 5}
              step={0.5}
              disabled={!twoPhase}
              onChange={(e) => set('phase2TargetPct', +e.target.value)}
              className={`${inputClass} disabled:opacity-40`}
            />
          </Field>

          <Field label="Pérdida diaria máx. (%)">
            <input type="number" value={cfg.dailyLossPct} step={0.5} onChange={(e) => set('dailyLossPct', +e.target.value)} className={inputClass} />
          </Field>

          <Field label="Pérdida total máx. (%)">
            <input type="number" value={cfg.maxLossPct} step={0.5} onChange={(e) => set('maxLossPct', +e.target.value)} className={inputClass} />
          </Field>

          <Field label="Tipo de Max DD">
            <select value={cfg.trailing ? 'trailing' : 'static'} onChange={(e) => set('trailing', e.target.value === 'trailing')} className={inputClass}>
              <option value="static">Estático</option>
              <option value="trailing">Trailing</option>
            </select>
          </Field>

          <Field label="Días mínimos de trading">
            <input type="number" value={cfg.minTradingDays} min={0} onChange={(e) => set('minTradingDays', +e.target.value)} className={inputClass} />
          </Field>

          <Field label="Límite de tiempo (días)" hint="0 = ilimitado">
            <input
              type="number"
              value={cfg.maxDays ?? 0}
              min={0}
              onChange={(e) => set('maxDays', +e.target.value > 0 ? +e.target.value : null)}
              className={inputClass}
            />
          </Field>

        </div>

        {/* Ajuste de lotaje proporcional (sin re-ejecutar el backtest) */}
        <LotAdjuster cfg={cfg} set={set} avgLot={avgLot} factor={factor} currency={currency} />
      </Card>

      {summary && <Results summary={summary} cfg={{ ...cfg, phase2TargetPct: twoPhase ? cfg.phase2TargetPct ?? 5 : null }} />}

      <p className="rounded-xl border border-white/10 bg-surface/40 px-4 py-3 text-xs text-slate-500">
        ⚠️ La simulación es una <strong className="text-slate-300">aproximación</strong> basada en los datos de cierre de
        cada operación: no replica la ejecución intradía real ni las reglas exactas de cada prop firm (festivos,
        noticias, consistencia, etc.). Úsala como orientación, no como garantía.
      </p>
    </div>
  );
}

function Results({ summary, cfg }: { summary: FundingSummary; cfg: FundingConfig }) {
  const s = summary;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="% de fondeos pasados"
          value={fmtPct(s.passRatePct, 1)}
          tone={s.passRatePct >= 50 ? 'pos' : s.passRatePct >= 25 ? 'brand' : 'neg'}
          hint={`${s.funded} de ${s.totalAttempts} intentos consecutivos`}
          big
        />
        <StatCard
          label="Pasados / Quemados"
          value={`${s.funded} / ${s.failed + s.phase1Only}`}
          tone="brand"
          hint={
            cfg.phase2TargetPct != null
              ? `${s.failed} en Fase 1 · ${s.phase1Only} en Fase 2${s.incomplete ? ` · ${s.incomplete} en curso` : ''}`
              : `${s.incomplete ? `${s.incomplete} en curso` : 'challenge 1 fase'}`
          }
          big
        />
        <StatCard label="Días medios Fase 1" value={fmtDays(s.avgDaysPhase1)} hint="hasta superar objetivo" big />
        <StatCard
          label="Días medios Fase 2"
          value={s.avgDaysPhase2 != null ? fmtDays(s.avgDaysPhase2) : '—'}
          hint={s.avgDaysPhase2 != null ? 'hasta funded' : 'desactivada'}
          big
        />
      </div>

      {/* Desglose de motivos de fallo */}
      <Card>
        <h3 className="mb-3 font-semibold text-white">Motivos de fallo</h3>
        <div className="grid grid-cols-3 gap-4">
          <FailStat label="Pérdida diaria" value={s.failByReason.daily} total={s.totalAttempts} />
          <FailStat label="Max drawdown" value={s.failByReason.maxdd} total={s.totalAttempts} />
          <FailStat label="Tiempo agotado" value={s.failByReason.timeout} total={s.totalAttempts} />
        </div>
      </Card>

      {/* Timeline visual */}
      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-white">Línea temporal de intentos consecutivos</h3>
          <div className="flex flex-wrap gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-pos" /> Funded</span>
            <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-brand" /> Pasó Fase 1</span>
            <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-neg" /> Quemado</span>
            <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-slate-500" /> En curso</span>
          </div>
        </div>
        <Timeline windows={s.windows} />
        <p className="mt-2 text-xs text-slate-500">
          Cada bloque es un fondeo consecutivo; su ancho ≈ nº de operaciones que duró. Verde donde el sistema
          "fondeaba"; rojo donde se quemaba.
        </p>
      </Card>

      {/* Mejor / peor intento */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="mb-3 font-semibold text-pos">Mejor intento (fondeo más rápido)</h3>
          <WindowCurve curve={s.bestCurve} color="#22c55e" />
        </Card>
        <Card delay={60}>
          <h3 className="mb-3 font-semibold text-neg">Peor intento (quemado más rápido)</h3>
          <WindowCurve curve={s.worstCurve} color="#ef4444" />
        </Card>
      </div>

      {/* Tabla de intentos */}
      <SimTable windows={s.windows} twoPhase={cfg.phase2TargetPct != null} hasTimes={s.hasTimes} />
    </div>
  );
}

function FailStat({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-slate-400">{label}</div>
      <div className="tnum mt-1 text-2xl font-bold text-neg">{value}</div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-neg" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 text-xs text-slate-500">{fmtPct(pct, 1)}</div>
    </div>
  );
}

function outcomeColor(o: WindowResult['outcome']): string {
  if (o === 'funded') return 'bg-pos';
  if (o === 'phase1') return 'bg-brand';
  if (o === 'incomplete') return 'bg-slate-500';
  return 'bg-neg';
}

function Timeline({ windows }: { windows: WindowResult[] }) {
  if (!windows.length) return <div className="text-sm text-slate-500">Sin intentos.</div>;
  return (
    <div className="flex h-10 w-full gap-px overflow-hidden rounded-lg">
      {windows.map((w, i) => {
        const ops = w.endIndex - w.startIndex + 1;
        const label =
          w.outcome === 'funded'
            ? 'Funded'
            : w.outcome === 'phase1'
              ? 'Pasó Fase 1, quemado en Fase 2'
              : w.outcome === 'incomplete'
                ? 'En curso al acabar el backtest'
                : `Quemado: ${w.reason ?? '—'}`;
        return (
          <div
            key={i}
            className={`h-full ${outcomeColor(w.outcome)} opacity-80 transition hover:opacity-100`}
            style={{ flexGrow: ops, flexBasis: 0, minWidth: 3 }}
            title={`Intento #${w.attempt} · ops ${w.startIndex + 1}–${w.endIndex + 1} (${ops}) · ${label}${
              w.startTime ? ` · ${fmtDateTime(new Date(w.startTime))}` : ''
            }`}
          />
        );
      })}
    </div>
  );
}

function SimTable({ windows, twoPhase, hasTimes }: { windows: WindowResult[]; twoPhase: boolean; hasTimes: boolean }) {
  const [page, setPage] = useState(0);
  const PAGE = 25;
  const sorted = useMemo(() => windows, [windows]);
  const pages = Math.ceil(sorted.length / PAGE);
  const view = sorted.slice(page * PAGE, page * PAGE + PAGE);

  const reasonLabel = (w: WindowResult) => {
    if (w.outcome === 'funded') return 'Funded';
    if (w.outcome === 'phase1') return 'Quemado en Fase 2';
    if (w.outcome === 'incomplete') return 'En curso';
    return w.reason === 'daily' ? 'Pérdida diaria' : w.reason === 'maxdd' ? 'Max DD' : 'Timeout';
  };
  const badgeTone = (w: WindowResult) =>
    w.outcome === 'funded' ? 'pos' : w.outcome === 'phase1' ? 'brand' : w.outcome === 'incomplete' ? 'neutral' : 'neg';

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-white">Detalle de intentos consecutivos</h3>
        {pages > 1 && (
          <div className="flex items-center gap-2 text-sm">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="rounded-lg border border-white/10 px-2.5 py-1 disabled:opacity-30">←</button>
            <span className="tnum text-slate-400">{page + 1} / {pages}</span>
            <button onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1} className="rounded-lg border border-white/10 px-2.5 py-1 disabled:opacity-30">→</button>
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] border-collapse">
          <thead>
            <tr className="text-xs uppercase tracking-wider text-slate-400">
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">Inicio</th>
              <th className="px-3 py-2 text-left">Operaciones</th>
              <th className="px-3 py-2 text-left">Resultado</th>
              <th className="px-3 py-2 text-right">Días F1</th>
              {twoPhase && <th className="px-3 py-2 text-right">Días F2</th>}
              <th className="px-3 py-2 text-right">Días total</th>
            </tr>
          </thead>
          <tbody>
            {view.map((w) => (
              <tr key={w.attempt} className="border-t border-white/5 hover:bg-white/5">
                <td className="tnum px-3 py-2 text-sm text-slate-500">{w.attempt}</td>
                <td className="px-3 py-2 text-sm text-slate-300">
                  {hasTimes && w.startTime ? fmtDateTime(new Date(w.startTime)) : `Op #${w.startIndex + 1}`}
                </td>
                <td className="tnum px-3 py-2 text-sm text-slate-400">
                  {w.startIndex + 1}–{w.endIndex + 1} <span className="text-slate-600">({w.endIndex - w.startIndex + 1})</span>
                </td>
                <td className="px-3 py-2">
                  <Badge tone={badgeTone(w)}>{reasonLabel(w)}</Badge>
                </td>
                <td className="tnum px-3 py-2 text-right text-sm text-slate-300">{w.phase1Days}</td>
                {twoPhase && <td className="tnum px-3 py-2 text-right text-sm text-slate-300">{w.phase2Days ?? '—'}</td>}
                <td className="tnum px-3 py-2 text-right text-sm font-semibold text-white">{w.totalDays}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
