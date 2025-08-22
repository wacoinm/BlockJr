import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const isDev = process.env.NODE_ENV === 'development'

export default defineConfig({
  plugins: [react()],
  server: {
    host: isDev ? '0.0.0.0' : undefined,
    port: 5173,
    strictPort: true
  },
  build: {
    outDir: 'dist',
    sourcemap: isDev
  }
})
