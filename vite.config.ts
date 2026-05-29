import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base` se puede sobreescribir con la env VITE_BASE para GitHub Pages.
// Ej: VITE_BASE=/backtest-analyzer/ npm run build
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  worker: {
    format: 'es',
  },
});
