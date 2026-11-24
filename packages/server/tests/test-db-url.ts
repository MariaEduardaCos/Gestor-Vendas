// Banco dos testes: TEST_DATABASE_URL, ou o PostgreSQL local padrão (npm run db:local) no schema "testes".
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL || 'postgresql://postgres@127.0.0.1:5433/consultorasync?schema=testes';
