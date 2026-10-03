import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import {realpathSync} from 'node:fs';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [tailwindcss(), reactRouter()],
  server: {
    // Local worktrees may reuse an installed dependency directory through a junction.
    fs: {allow: [path.resolve('.'), realpathSync(path.resolve('node_modules'))]},
    // Dev-only: PORT env wins so preview tooling can assign a free port
    // (a stray local process often squats on 3000 — see gm-site memory).
    port: Number(process.env.PORT) || 3000,
  },
  resolve: {
    // A dependency junction must not create a second React dispatcher.
    dedupe: ['react', 'react-dom'],
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
