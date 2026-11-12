import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    fileParallelism: false,
    globalSetup: ['./tests/global-setup.ts'],
    // Banco separado: rodar os testes não apaga os dados de desenvolvimento.
    env: { DATABASE_URL: 'file:./test.db' }
  }
});
