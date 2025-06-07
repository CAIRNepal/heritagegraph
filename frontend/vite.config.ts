import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
  return {
    base: './', // Changed from '/' to './' for relative paths
    build: {
      outDir: 'build',
      manifest: true,
      rollupOptions: {
        output: {
          // Ensure assets use hash for cache busting
          entryFileNames: `assets/[name].[hash].js`,
          chunkFileNames: `assets/[name].[hash].js`,
          assetFileNames: ({ name }) => {
            if (/\.css$/.test(name ?? '')) {
              return `assets/css/[name].[hash].[ext]`;
            }
            if (/\.(png|jpe?g|gif|svg|webp)$/.test(name ?? '')) {
              return `assets/media/[name].[hash].[ext]`;
            }
            return 'assets/[name].[hash].[ext]';
          },
        },
      },
    },
    plugins: [react()],
    server: {
      port: 3000,
      proxy: {
        '/data': {
          target: 'http://0.0.0.0:8000', 
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''), 
        },
      },
    },
  };
});
