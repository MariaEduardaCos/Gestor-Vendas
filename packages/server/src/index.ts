import { buildApp } from './app.js';
import { carregarCatalogosIniciais } from './services/catalogos-iniciais.js';

export * from './app.js';
export * from './db/tenant-prisma.js';
export * from './plugins/session.js';
export * from './infrastructure/pareamentoHub.js';
export * from './routes/pareamento.js';

async function start() {
  const app = buildApp();
  const port = Number(process.env.PORT) || 3333;
  const host = process.env.HOST || '0.0.0.0';

  try {
    await app.listen({ port, host });
    console.log(`[ConsultoraSync Server] Servidor escutando em http://${host}:${port}`);
    // Em segundo plano: o servidor já atende enquanto os catálogos carregam.
    carregarCatalogosIniciais(app.prisma, (m) => app.log.info(m)).catch((e) => app.log.error(e, 'Falha ao carregar catálogos iniciais'));
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  start();
}
