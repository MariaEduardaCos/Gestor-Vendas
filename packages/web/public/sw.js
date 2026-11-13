/*
 * Service worker do ConsultoraSync.
 *
 * - Telas (navegação): rede primeiro; sem internet, abre a última versão do app guardada.
 * - Arquivos do app (/assets/*, com hash no nome): guardados na primeira vez e reaproveitados.
 * - Leituras da API (GET /api/...): rede primeiro; sem internet, devolve a última resposta
 *   guardada com o cabeçalho "X-Consultorasync-Cache: 1", para a tela avisar que são dados salvos.
 * - Servidor fora do ar (502/503/504) conta como sem internet.
 * - Nunca guarda: gravações (POST/PUT/DELETE), login, exportações e o leitor remoto.
 * - Ao sair da conta, o app manda "limpar-dados" e as leituras guardadas são apagadas.
 */
const VERSAO = 'v1';
const CACHE_APP = `cs-app-${VERSAO}`;
const CACHE_API = `cs-api-${VERSAO}`;
const CACHE_FONTES = `cs-fontes-${VERSAO}`;
const CACHES_ATUAIS = [CACHE_APP, CACHE_API, CACHE_FONTES];
const LIMITE_API = 150;
const LIMITE_ASSETS = 80;

const ESSENCIAIS = ['/', '/manifest.webmanifest', '/icones/icone-192.png', '/icones/favicon-32.png'];

// A sessão (/api/auth/session) é guardada para o app abrir sem internet; o resto de /auth não.
const API_NUNCA = [/^\/api\/auth\/(?!session$)/, /^\/api\/exportar/, /^\/api\/pareamento/];
const SERVIDOR_FORA = [502, 503, 504];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE_APP)
      .then((c) => c.addAll(ESSENCIAIS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n.startsWith('cs-') && !CACHES_ATUAIS.includes(n)).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (evento) => {
  if (evento.data === 'limpar-dados') {
    evento.waitUntil(caches.delete(CACHE_API));
  }
});

async function aparar(nome, limite) {
  const cache = await caches.open(nome);
  const chaves = await cache.keys();
  for (let i = 0; i < chaves.length - limite; i++) await cache.delete(chaves[i]);
}

async function navegacao(req) {
  const cache = await caches.open(CACHE_APP);
  try {
    const resp = await fetch(req);
    if (resp.ok) cache.put('/', resp.clone());
    return resp;
  } catch {
    return (await cache.match('/')) ?? Response.error();
  }
}

async function assetImutavel(req) {
  const cache = await caches.open(CACHE_APP);
  const salvo = await cache.match(req);
  if (salvo) return salvo;
  const resp = await fetch(req);
  if (resp.ok) {
    await cache.put(req, resp.clone());
    aparar(CACHE_APP, LIMITE_ASSETS);
  }
  return resp;
}

async function leituraApi(req) {
  const cache = await caches.open(CACHE_API);
  let resp = null;
  try {
    resp = await fetch(req);
    if (resp.ok) {
      await cache.put(req, resp.clone());
      aparar(CACHE_API, LIMITE_API);
    }
    if (!SERVIDOR_FORA.includes(resp.status)) return resp;
  } catch {
    /* sem conexão */
  }
  const salvo = await cache.match(req);
  if (!salvo) return resp ?? Response.error();
  const cabecalhos = new Headers(salvo.headers);
  cabecalhos.set('X-Consultorasync-Cache', '1');
  return new Response(await salvo.blob(), { status: salvo.status, statusText: salvo.statusText, headers: cabecalhos });
}

async function fonte(req) {
  const cache = await caches.open(CACHE_FONTES);
  const salvo = await cache.match(req);
  const rede = fetch(req)
    .then((resp) => {
      if (resp.ok || resp.type === 'opaque') cache.put(req, resp.clone());
      return resp;
    })
    .catch(() => salvo ?? Response.error());
  return salvo ?? rede;
}

self.addEventListener('fetch', (evento) => {
  const req = evento.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    if (req.mode === 'navigate') return evento.respondWith(navegacao(req));
    if (url.pathname.startsWith('/assets/')) return evento.respondWith(assetImutavel(req));
    if (url.pathname.startsWith('/api/')) {
      if (API_NUNCA.some((r) => r.test(url.pathname))) return;
      return evento.respondWith(leituraApi(req));
    }
    return;
  }

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    evento.respondWith(fonte(req));
  }
});
