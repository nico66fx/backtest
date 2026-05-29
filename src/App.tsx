import { useState } from 'react';
import { StoreProvider, useStore } from './state/store';
import { Nav, type SectionId } from './components/Nav';
import { FileDrop } from './components/FileDrop';
import { FilterBar } from './components/FilterBar';
import { Overview } from './sections/Overview';
import { MetricsSection } from './sections/Metrics';
import { Trades } from './sections/Trades';
import { Funding } from './sections/Funding';
import { CommunityCTA } from './components/CommunityCTA';
import { ScrollProgress } from './components/ScrollFx';
import { LINKS } from './lib/links';

function Landing() {
  const { setResult } = useStore();
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="mb-10 text-center">
        <div className="eyebrow mb-3 text-accent-400">Toolkit gratuito · by {LINKS.brand}</div>
        <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
          Analiza tus <span className="text-gradient">backtests</span> como un PRO
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-slate-400">
          Sube tu reporte de MetaTrader 4 o 5 y obtén todas las métricas profesionales, gráficos
          interactivos y un simulador de fondeos de prop firms. Sin servidores, sin registros: todo
          en tu navegador.
        </p>
      </div>

      <FileDrop onLoaded={setResult} />

      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {[
          { t: 'Métricas completas', d: 'Profit factor, Sharpe, Sortino, drawdown, rachas, expected payoff y mucho más.' },
          { t: 'Gráficos interactivos', d: 'Curva de equity, drawdown, P&L por operación, distribución, mensual y por símbolo/hora.' },
          { t: 'Simulador de fondeos', d: 'Descubre cuántos challenges habrías superado, encadenando fondeos consecutivos.' },
        ].map((f, i) => (
          <div
            key={f.t}
            className="animate-rise card-glass rounded-2xl p-5"
            style={{ animationDelay: `${i * 90}ms` }}
          >
            <div className="mb-2 h-1 w-8 rounded-full bg-gradient-to-r from-brand to-accent" />
            <h3 className="font-bold text-white">{f.t}</h3>
            <p className="mt-1 text-sm text-slate-400">{f.d}</p>
          </div>
        ))}
      </div>

      <div className="mt-12">
        <CommunityCTA />
      </div>
    </div>
  );
}

function Dashboard({ active }: { active: SectionId }) {
  const { dataset } = useStore();
  if (!dataset) return null;
  const warnings = dataset.result.warnings;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      {warnings.length > 0 && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-2.5 text-sm text-amber-200">
          {warnings.map((w, i) => (
            <div key={i}>⚠️ {w}</div>
          ))}
        </div>
      )}
      <FilterBar />
      {active === 'resumen' && <Overview />}
      {active === 'metricas' && <MetricsSection />}
      {active === 'operaciones' && <Trades />}
      {active === 'fondeos' && <Funding />}

      <div className="pt-2">
        <CommunityCTA />
      </div>
    </div>
  );
}

function Shell() {
  const { dataset, clear } = useStore();
  const [active, setActive] = useState<SectionId>('resumen');

  return (
    <div className="flex min-h-full flex-col">
      <ScrollProgress />
      <Nav
        active={active}
        onChange={setActive}
        hasData={!!dataset}
        fileName={dataset?.result.meta.fileName}
        onReset={clear}
      />

      <main className="flex-1">{dataset ? <Dashboard active={active} /> : <Landing />}</main>

      <footer className="border-t border-white/10 px-4 py-8 text-center text-xs text-slate-500 sm:px-6">
        <div className="mx-auto mb-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          <a href={LINKS.site} target="_blank" rel="noopener noreferrer" className="font-semibold text-slate-300 transition hover:text-brand-400">
            nico66fx.github.io
          </a>
          <span className="text-slate-700">·</span>
          <a href={LINKS.telegram} target="_blank" rel="noopener noreferrer" className="font-semibold text-slate-300 transition hover:text-accent-400">
            Comunidad en Telegram
          </a>
        </div>
        <p className="mx-auto max-w-3xl">
          <strong className="text-slate-400">Aviso:</strong> contenido educativo. Los resultados pasados no garantizan
          resultados futuros. Esto no es asesoramiento financiero. El simulador de fondeos es una aproximación basada en
          datos de cierre y no replica exactamente la ejecución intradía ni las reglas concretas de cada prop firm.
        </p>
        <p className="mt-2 text-slate-600">🔒 100% local · tus archivos nunca salen de tu equipo · Backtest Analyzer Toolkit by {LINKS.brand}</p>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
