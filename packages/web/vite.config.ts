import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

// HTTPS=1 liga um certificado local autoassinado: o navegador do celular só libera
// a câmera em conexão segura. Use `npm run dev:celular` para testar o leitor no celular.
const comHttps = process.env.HTTPS === '1';

export default defineConfig({
  plugins: [react(), ...(comHttps ? [basicSsl()] : [])],
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3333',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://localhost:3333',
        ws: true
      }
    }
  }
});
