# Backtest Analyzer Toolkit · by nico66fx

Web app para **analizar backtests de MetaTrader 4 y MetaTrader 5** con métricas profesionales,
gráficos interactivos y un **simulador de fondeos de prop firms**. Forma parte del ecosistema de
herramientas gratuitas de [**nico66fx**](https://nico66fx.github.io) (bots y trading algorítmico).

> 🔒 **100% en el cliente.** Todo el procesamiento ocurre en tu navegador con la API de ficheros.
> Tus reportes **nunca se suben a ningún servidor**.

Estética **dark fintech azul/cian** alineada con [nico66fx.github.io](https://nico66fx.github.io):
fuente display **Sora**, glassmorphism, CTAs con barrido/glow, barra de progreso de scroll y
animaciones de entrada. Incluye enlaces (sin spam) a la comunidad de trading algorítmico.

![estilo dark fintech](public/favicon.svg)

## Características

- **Ingestión multi-formato** (drag & drop o botón):
  - MT5: reporte del Strategy Tester en **XML** (SpreadsheetML) y **HTML** (con tablas de Deals/Orders).
  - MT4: **Statement / Strategy Tester Report** en HTML.
  - **CSV / XLSX** de operaciones.
  - Parsers tolerantes a idioma (EN/ES) y a separadores decimales (coma/punto).
- **Dashboard de métricas completas**: beneficio neto, profit factor, expected payoff, recovery
  factor, retorno %, CAGR, Sharpe, Sortino, win rate (global/long/short), mejores/peores
  operaciones, medias, ratio win/loss, rachas, duración media, drawdown absoluto/relativo,
  desviación típica, etc.
- **Gráficos** (Recharts): curva de equity con gradiente, drawdown, P&L por operación, histograma
  de resultados, P&L mensual y desglose por símbolo / hora del día / día de la semana.
- **Filtros en vivo** por símbolo y rango de fechas que recalculan todo.
- **Simulador de fondeos (walk-forward)**: desliza una ventana de inicio a lo largo del backtest y
  cuenta cuántos challenges habrías superado, con reglas configurables (presets FTMO / The5ers /
  genéricos + personalizado), desglose de motivos de fallo, mapa temporal y curvas de la mejor/peor
  ventana. La simulación corre en un **Web Worker** para no bloquear la UI.
- **Exportación**: CSV de operaciones, JSON de métricas y PDF (vía impresión del navegador).
- **Datos de ejemplo** integrados para probar sin un archivo real.

## Desarrollo

Requiere **Node 18+**.

```bash
npm install
npm run dev      # servidor de desarrollo (Vite) en http://localhost:5173
npm run build    # type-check + build de producción en dist/
npm run preview  # sirve la build de producción
```

## Despliegue

La app es estática (carpeta `dist/`). Se puede desplegar en cualquier hosting estático.

### Vercel

Importa el repo en Vercel. Framework preset: **Vite**. Build command `npm run build`,
output `dist`. Sin variables de entorno necesarias.

### GitHub Pages

GitHub Pages sirve bajo un subpath (`/<repo>/`), así que hay que fijar el `base`:

```bash
VITE_BASE=/<nombre-del-repo>/ npm run build
```

Luego publica el contenido de `dist/` en la rama `gh-pages` (por ejemplo con la acción
`peaceiris/actions-gh-pages` o `npx gh-pages -d dist`).

## Estructura del proyecto

```
src/
  types.ts                 Tipos del dominio (Trade, ReportMeta, ...)
  lib/
    parsers/               Parsers separados de la UI
      index.ts             Detección de formato + enrutado
      utils.ts             Números, fechas, mapeo de cabeceras EN/ES
      fromTable.ts         Tabla genérica -> operaciones (CSV/XLSX/Deals)
      html.ts              MT4 statement + MT5 HTML
      xml.ts               MT5 SpreadsheetML
      csv.ts / xlsx.ts     CSV (SheetJS para XLSX)
    metrics.ts             Motor de métricas + curva de equity + agrupaciones
    funding.ts             Lógica del simulador de fondeos
    funding.worker.ts      Web Worker que ejecuta la simulación
    format.ts              Formateo (moneda, %, fechas, duraciones)
    sample.ts              Generador de backtest de ejemplo
    export.ts              Exportación CSV / JSON / PDF
  state/store.tsx          Estado global (dataset, filtros, métricas derivadas)
  components/              UI reutilizable (Card, StatCard, Badge, Nav, charts, ...)
  sections/                Resumen, Métricas, Operaciones, Fondeos
  App.tsx                  Shell + navegación + landing + disclaimer
```

## Cómo funciona el simulador de fondeos

1. Se reconstruye la equity escalando los profits del backtest al capital del challenge
   (según el modo de escalado y el multiplicador de riesgo).
2. Se generan **ventanas de inicio** (cada N operaciones, días o semanas — walk-forward).
3. Desde cada ventana se simula el challenge hacia delante aplicando, operación a operación:
   objetivo de beneficio, **pérdida diaria máxima** (vs inicio del día), **max drawdown**
   (estático o trailing) y límite de tiempo. Si pasa Fase 1 encadena Fase 2 → **Funded**.
4. Se agregan resultados: % de fondeos, motivos de fallo, días medios por fase, mapa temporal y
   curvas de la mejor/peor ventana.

> ⚠️ Es una **aproximación** basada en datos de cierre: no replica el peor tick intradía ni las
> reglas específicas de cada prop firm (consistencia, festivos, noticias…). Contenido educativo,
> no es asesoramiento financiero.
