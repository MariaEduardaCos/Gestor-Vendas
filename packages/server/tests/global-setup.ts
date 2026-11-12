import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Os testes usam um banco próprio e descartável (prisma/test.db),
// para nunca tocar no banco de desenvolvimento (prisma/dev.db).
export const TEST_DATABASE_URL = 'file:./test.db';

export default function setup() {
  const raizServidor = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const pastaPrisma = path.join(raizServidor, 'prisma');

  // Cada execução começa com um banco de teste vazio.
  for (const sufixo of ['', '-journal', '-wal', '-shm']) {
    rmSync(path.join(pastaPrisma, `test.db${sufixo}`), { force: true });
  }

  execSync('npx prisma db push --skip-generate', {
    cwd: raizServidor,
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'pipe'
  });
}
