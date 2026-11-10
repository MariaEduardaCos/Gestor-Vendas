import { buildApp } from './app.js';

export * from './app.js';
export * from './db/tenant-prisma.js';
export * from './plugins/session.js';

async function start() {
  const app = buildApp();
  const port = Number(process.env.PORT) || 3333;
  const host = process.env.HOST || '0.0.0.0';

  try {
    await app.listen({ port, host });
    console.log(`[ConsultoraSync Server] Servidor escutando em http://${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  start();
}
