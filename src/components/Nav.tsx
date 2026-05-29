import { Badge } from './Badge';
import { LINKS } from '../lib/links';

export type SectionId = 'resumen' | 'metricas' | 'operaciones' | 'fondeos';

const ITEMS: { id: SectionId; label: string }[] = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'metricas', label: 'Métricas' },
  { id: 'operaciones', label: 'Operaciones' },
  { id: 'fondeos', label: 'Fondeos' },
];

interface NavProps {
  active: SectionId;
  onChange: (id: SectionId) => void;
  hasData: boolean;
  fileName?: string;
  onReset: () => void;
}

export function Nav({ active, onChange, hasData, fileName, onReset }: NavProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-base/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          {/* Logo autocontenido (gradiente propio, no depende de utilidades de color) */}
          <span className="flex h-9 w-9 items-center justify-center rounded-xl shadow-glow" aria-hidden>
            <svg viewBox="0 0 64 64" className="h-9 w-9">
              <defs>
                <linearGradient id="navLogo" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#22d3ee" />
                </linearGradient>
              </defs>
              <rect width="64" height="64" rx="16" fill="url(#navLogo)" />
              <polyline
                points="12,46 26,30 36,38 54,14"
                fill="none"
                stroke="#0a0f1d"
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="54" cy="14" r="5" fill="#0a0f1d" />
            </svg>
          </span>
          <div className="leading-tight">
            <div className="text-sm font-extrabold tracking-tight text-white">Backtest Analyzer</div>
            <div className="text-[10px] uppercase tracking-widest text-brand-400">Toolkit · MT4 / MT5</div>
          </div>
        </div>

        <Badge tone="pos" pulse>
          100% LOCAL
        </Badge>

        {hasData && (
          <nav className="order-last flex w-full gap-1 overflow-x-auto sm:order-none sm:ml-4 sm:w-auto">
            {ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => onChange(item.id)}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  active === item.id
                    ? 'bg-brand/15 text-brand'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        )}

        <div className="ml-auto flex items-center gap-3">
          {hasData && fileName && (
            <span className="hidden max-w-[220px] truncate text-xs text-slate-500 md:inline" title={fileName}>
              {fileName}
            </span>
          )}
          {hasData && (
            <button
              onClick={onReset}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-neg/40 hover:text-neg"
            >
              Cargar otro
            </button>
          )}
          <a
            href={LINKS.site}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-glow"
            title="Bots y comunidad de trading algorítmico"
          >
            <span className="glow-dot" />
            Comunidad PRO
          </a>
        </div>
      </div>
    </header>
  );
}
