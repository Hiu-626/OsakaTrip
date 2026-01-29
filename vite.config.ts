import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // 確保環境變數 process.env 在瀏覽器端可用
    'process.env': process.env
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
});