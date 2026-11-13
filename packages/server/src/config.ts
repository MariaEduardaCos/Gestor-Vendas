/**
 * Configuração de segurança do servidor.
 *
 * "Modo desenvolvimento" libera atalhos que nunca podem existir num sistema publicado:
 * a entrada automática com a conta de demonstração e o segredo de sessão padrão.
 * Fica ligado só com NODE_ENV=development/test, ou com ALLOW_DEV_SESSION=1 de forma explícita.
 * Sem NODE_ENV o servidor se comporta como produção (seguro por padrão).
 */
export function modoDesenvolvimento(): boolean {
  const env = process.env.NODE_ENV;
  return env === 'development' || env === 'test' || process.env.ALLOW_DEV_SESSION === '1';
}

const SEGREDO_DESENVOLVIMENTO = 'consultorasync-dev-session-secret-key-32b';
const TAMANHO_MINIMO_SEGREDO = 32;

/** Segredo que assina as sessões. Fora do modo desenvolvimento, SESSION_SECRET é obrigatório. */
export function segredoSessao(): string {
  const segredo = process.env.SESSION_SECRET;
  if (segredo && segredo.length >= TAMANHO_MINIMO_SEGREDO) return segredo;
  if (modoDesenvolvimento()) return segredo || SEGREDO_DESENVOLVIMENTO;
  throw new Error(
    `SESSION_SECRET ausente ou curto (mínimo ${TAMANHO_MINIMO_SEGREDO} caracteres). ` +
      'Defina a variável de ambiente, ou use NODE_ENV=development para rodar localmente.'
  );
}

/** Origens aceitas pelo CORS. Em desenvolvimento, qualquer origem; em produção, só CORS_ORIGINS. */
export function origensPermitidas(): boolean | string[] {
  const lista = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (lista.length > 0) return lista;
  // Sem lista em produção: só a própria origem (o site é servido pelo mesmo endereço ou via proxy).
  return modoDesenvolvimento() ? true : false;
}
