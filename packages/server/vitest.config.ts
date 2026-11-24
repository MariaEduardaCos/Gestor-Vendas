import { defineConfig } from 'vitest/config';
import { TEST_DATABASE_URL } from './tests/test-db-url.js';

export default defineConfig({
  test: {
    fileParallelism: false,
    globalSetup: ['./tests/global-setup.ts'],
    // Schema separado: rodar os testes não apaga os dados de desenvolvimento.
    env: { DATABASE_URL: TEST_DATABASE_URL }
  }
});
