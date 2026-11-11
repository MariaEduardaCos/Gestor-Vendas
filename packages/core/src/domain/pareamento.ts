export type StatusPareamento = 'AGUARDANDO_CELULAR' | 'CONECTADO' | 'DESCONECTADO' | 'EXPIRADO';

export type TipoPontaPareamento = 'DESKTOP' | 'MOBILE';

export type TipoMensagemPareamento = 'SCAN' | 'STATUS' | 'PING' | 'PONG' | 'ERRO';

export interface MensagemScan {
  tipo: 'SCAN';
  codigo: string;
  timestamp?: string;
}

export interface MensagemStatus {
  tipo: 'STATUS';
  status: StatusPareamento;
  detalhe?: string;
  tempoRestanteMs?: number;
}

export interface MensagemPing {
  tipo: 'PING';
}

export interface MensagemPong {
  tipo: 'PONG';
}

export interface MensagemErro {
  tipo: 'ERRO';
  motivo: string;
  codigo?: string;
}

export type PareamentoMensagem =
  | MensagemScan
  | MensagemStatus
  | MensagemPing
  | MensagemPong
  | MensagemErro;

export interface SessaoPareamentoDTO {
  token: string;
  operacao_id: string;
  criadoEm: string;
  expiraEm: string;
  status: StatusPareamento;
  tempoRestanteMs: number;
  celularConectado: boolean;
  urlPareamento?: string;
}

/**
 * TTL estrito de 10 minutos (600.000 ms) para a sessão de pareamento efêmero (AD-6, FR-014).
 */
export const PAREAMENTO_TTL_PADRAO_MS = 10 * 60 * 1000;

export function normalizarDataMs(valor: Date | string | number): number {
  if (typeof valor === 'number') return valor;
  if (valor instanceof Date) return valor.getTime();
  return new Date(valor).getTime();
}

/**
 * Verifica se a sessão efêmera atingiu o TTL de 10 minutos.
 */
export function validarSessaoExpirada(
  criadoEm: Date | string | number,
  ttlMs: number = PAREAMENTO_TTL_PADRAO_MS,
  agoraMs?: number
): boolean {
  const agora = agoraMs ?? Date.now();
  const inicio = normalizarDataMs(criadoEm);
  return agora - inicio >= ttlMs;
}

/**
 * Calcula o tempo restante da sessão em milissegundos (retorna 0 se expirada).
 */
export function calcularTempoRestanteMs(
  criadoEm: Date | string | number,
  ttlMs: number = PAREAMENTO_TTL_PADRAO_MS,
  agoraMs?: number
): number {
  const agora = agoraMs ?? Date.now();
  const inicio = normalizarDataMs(criadoEm);
  const restante = ttlMs - (agora - inicio);
  return restante > 0 ? restante : 0;
}

/**
 * Serializa uma mensagem de pareamento em formato JSON string.
 */
export function serializarMensagem(mensagem: PareamentoMensagem): string {
  return JSON.stringify(mensagem);
}

/**
 * Desserializa e normaliza uma mensagem de pareamento.
 * Suporta formatos padrão ({ tipo: 'SCAN', codigo: '...' }) e legado/alternativo ({ event: 'SCAN', code: '...' }).
 */
export function deserializarMensagem(conteudo: string): PareamentoMensagem | null {
  try {
    const raw = JSON.parse(conteudo);
    if (!raw || typeof raw !== 'object') return null;

    // Normalização de tipo/event
    const tipo = (raw.tipo || raw.event || '').toString().toUpperCase();

    if (tipo === 'SCAN') {
      const codigoBruto = raw.codigo ?? raw.code;
      if (!codigoBruto || typeof codigoBruto !== 'string' && typeof codigoBruto !== 'number') {
        return null;
      }
      const codigo = String(codigoBruto).trim();
      if (!codigo) return null;

      return {
        tipo: 'SCAN',
        codigo,
        timestamp: raw.timestamp ? String(raw.timestamp) : new Date().toISOString()
      };
    }

    if (tipo === 'STATUS') {
      const status = raw.status as StatusPareamento;
      return {
        tipo: 'STATUS',
        status,
        detalhe: raw.detalhe ? String(raw.detalhe) : undefined,
        tempoRestanteMs: typeof raw.tempoRestanteMs === 'number' ? raw.tempoRestanteMs : undefined
      };
    }

    if (tipo === 'PING') {
      return { tipo: 'PING' };
    }

    if (tipo === 'PONG') {
      return { tipo: 'PONG' };
    }

    if (tipo === 'ERRO') {
      return {
        tipo: 'ERRO',
        motivo: String(raw.motivo || 'Erro desconhecido'),
        codigo: raw.codigo ? String(raw.codigo) : undefined
      };
    }

    return null;
  } catch {
    return null;
  }
}
