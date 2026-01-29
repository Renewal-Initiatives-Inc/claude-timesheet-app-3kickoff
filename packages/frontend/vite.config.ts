import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react() as any], // Type cast: vitest@2 expects vite@5, we have vite@6
  server: {
    port: 5173,
    hmr: process.env.PLAYWRIGHT ? false : true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    // Optimize chunk splitting for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunk for React core (rarely changes)
          'vendor-react': ['react', 'react-dom'],
          // Router in separate chunk
          'vendor-router': ['react-router-dom'],
        },
      },
    },
    // Target modern browsers for smaller bundles
    target: 'es2020',
    // Minimum chunk size (to avoid too many small chunks)
    chunkSizeWarningLimit: 500,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'src/__tests__/**/*.{ts,tsx}'],
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
