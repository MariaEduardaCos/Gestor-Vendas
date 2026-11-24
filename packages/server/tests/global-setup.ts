import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { TEST_DATABASE_URL } from './test-db-url.js';

// Os testes usam um schema próprio e descartável ("testes") no PostgreSQL,
// para nunca tocar nos dados de desenvolvimento.
export default function setup() {
  const raizServidor = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

  // Cria ou atualiza as tabelas do schema de teste (cada teste limpa os dados que usa).
  execSync('npx prisma db push --skip-generate', {
    cwd: raizServidor,
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'pipe'
  });
}
