import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build:{minify:'terser',terserOptions:{compress:{passes:2}}},
  worker:{format:'es',rollupOptions:{output:{manualChunks(id){
    if(id.includes('/node_modules/clipper-lib/'))return 'geometry-clipping';
  }}}},
  plugins: [tailwindcss(), reactRouter()],
  server: {
    // Dev-only: PORT env wins so preview tooling can assign a free port
    // (a stray local process often squats on 3000 — see gm-site memory).
    port: Number(process.env.PORT) || 3000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
