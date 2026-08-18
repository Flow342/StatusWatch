import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: Number(env.CLIENT_PORT || 5173),
      // In development the app calls a same-origin "/api" and Vite forwards it to the
      // API server, so no CORS setup is needed locally. In production the built assets
      // are served by a web server and VITE_API_BASE_URL points at the real API.
      proxy: {
        '/api': {
          target: env.VITE_DEV_API_PROXY || 'http://localhost:4000',
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: Number(env.CLIENT_PREVIEW_PORT || 4173),
    },
    build: {
      outDir: 'dist',
      sourcemap: mode !== 'production',
    },
  };
});
