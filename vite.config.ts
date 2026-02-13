import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    historyApiFallback: true,
  },
  preview: {
    historyApiFallback: true,
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
    include: ['hls.js'],
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react-vendor';
            }
            if (id.includes('@supabase')) {
              return 'supabase-vendor';
            }
            if (id.includes('lucide-react')) {
              return 'icons';
            }
            if (id.includes('qrcode')) {
              return 'qrcode-vendor';
            }
            if (id.includes('hls.js')) {
              return 'hls-vendor';
            }
            return 'vendor';
          }
          if (id.includes('src/pages/')) {
            const pageName = id.split('src/pages/')[1].split('.')[0];
            return `page-${pageName.toLowerCase()}`;
          }
          if (id.includes('src/contexts/')) {
            return 'contexts';
          }
          if (id.includes('src/components/')) {
            return 'components';
          }
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
});
