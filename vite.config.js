import { defineConfig } from 'vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { resolve } from 'path';

export default defineConfig({
  plugins: [basicSsl()],
  server: {
    https: true,
    host:true,
    port: 8002
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        protected: resolve(__dirname, 'vr.html'),
      },
    },
  },
});