/**
 * Vencimentos e situação de cobrança de uma conta (FR-036).
 *
 * Regras:
 * - Conta pode não ter vencimento: nunca fica "atrasada".
 * - Vencimento único é uma parcela; parcelado são várias datas.
 * - Guardamos só as DATAS. O valor de cada parcela é o total ATUAL da conta dividido
 *   igualmente (centavos que sobram vão para a última). Se um item for cancelado,
 *   as parcelas se ajustam sozinhas, sem soma divergente.
 * - Pagamentos quitam as parcelas na ordem do vencimento.
 * - Atrasada = existe valor vencido (parcelas com data anterior a hoje) ainda não pago.
 * - Entrega não altera a situação de pagamento.
 */

export type SituacaoCobranca = 'QUITADA' | 'SEM_VENCIMENTO' | 'EM_DIA' | 'ATRASADA';

export interface ParcelaCalculada {
  numero: number;
  vencimento: string; // AAAA-MM-DD
  valor_centavos: number;
  pago_centavos: number;
  situacao: 'PAGA' | 'PARCIAL' | 'ABERTA' | 'VENCIDA';
}

export interface ResumoCobranca {
  situacao: SituacaoCobranca;
  saldo_centavos: number;
  valor_vencido_centavos: number;
  dias_atraso: number;
  proximo_vencimento: string | null;
  parcelas: ParcelaCalculada[];
}

export const MAX_PARCELAS = 24;

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

export function dataValida(data: string): boolean {
  if (!DATA_ISO.test(data)) return false;
  const d = new Date(`${data}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === data;
}

/** Divide o total em n parcelas inteiras; a última recebe o resto. */
export function dividirEmParcelas(totalCentavos: number, quantidade: number): number[] {
  if (quantidade <= 0) return [];
  const base = Math.floor(totalCentavos / quantidade);
  const valores = Array.from({ length: quantidade }, () => base);
  valores[quantidade - 1] += totalCentavos - base * quantidade;
  return valores;
}

/** Gera n vencimentos mensais a partir da primeira data, preservando o dia (ajusta para o fim do mês quando preciso). */
export function gerarVencimentosMensais(primeiro: string, quantidade: number): string[] {
  if (!dataValida(primeiro)) throw new Error('Data do primeiro vencimento inválida.');
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > MAX_PARCELAS) {
    throw new Error(`Número de parcelas deve ser de 1 a ${MAX_PARCELAS}.`);
  }
  const [ano, mes, dia] = primeiro.split('-').map(Number);
  return Array.from({ length: quantidade }, (_, i) => {
    const alvoMes = mes - 1 + i;
    const anoAlvo = ano + Math.floor(alvoMes / 12);
    const mesAlvo = alvoMes % 12;
    const ultimoDia = new Date(Date.UTC(anoAlvo, mesAlvo + 1, 0)).getUTCDate();
    return new Date(Date.UTC(anoAlvo, mesAlvo, Math.min(dia, ultimoDia))).toISOString().slice(0, 10);
  });
}

/** Valida e ordena uma lista de vencimentos informada pela revendedora. */
export function normalizarVencimentos(vencimentos: unknown): string[] {
  if (!Array.isArray(vencimentos)) throw new Error('Vencimentos devem ser uma lista de datas.');
  if (vencimentos.length > MAX_PARCELAS) throw new Error(`No máximo ${MAX_PARCELAS} parcelas.`);
  for (const v of vencimentos) {
    if (typeof v !== 'string' || !dataValida(v)) throw new Error(`Data de vencimento inválida: ${String(v)}.`);
  }
  const ordenadas = [...(vencimentos as string[])].sort();
  if (new Set(ordenadas).size !== ordenadas.length) throw new Error('Há duas parcelas com a mesma data.');
  return ordenadas;
}

function diasEntre(de: string, ate: string): number {
  return Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000);
}

export function calcularCobranca(
  conta: { valor_total: number; total_pago: number },
  vencimentos: string[],
  hoje: string
): ResumoCobranca {
  const saldo = Math.max(0, conta.valor_total - conta.total_pago);
  const datas = [...vencimentos].sort();
  const valores = dividirEmParcelas(conta.valor_total, datas.length);

  let pagoRestante = conta.total_pago;
  const parcelas: ParcelaCalculada[] = datas.map((vencimento, i) => {
    const valor = valores[i];
    const pago = Math.max(0, Math.min(valor, pagoRestante));
    pagoRestante -= pago;
    const situacao: ParcelaCalculada['situacao'] =
      pago >= valor ? 'PAGA' : vencimento < hoje ? 'VENCIDA' : pago > 0 ? 'PARCIAL' : 'ABERTA';
    return { numero: i + 1, vencimento, valor_centavos: valor, pago_centavos: pago, situacao };
  });

  const vencidas = parcelas.filter((p) => p.situacao === 'VENCIDA');
  const valorVencido = vencidas.reduce((s, p) => s + p.valor_centavos - p.pago_centavos, 0);
  const proxima = parcelas.find((p) => p.situacao !== 'PAGA' && p.vencimento >= hoje);

  let situacao: SituacaoCobranca;
  if (saldo === 0) situacao = 'QUITADA';
  else if (parcelas.length === 0) situacao = 'SEM_VENCIMENTO';
  else if (valorVencido > 0) situacao = 'ATRASADA';
  else situacao = 'EM_DIA';

  return {
    situacao,
    saldo_centavos: saldo,
    valor_vencido_centavos: situacao === 'QUITADA' ? 0 : valorVencido,
    dias_atraso: vencidas.length > 0 && saldo > 0 ? diasEntre(vencidas[0].vencimento, hoje) : 0,
    proximo_vencimento: proxima?.vencimento ?? null,
    parcelas
  };
}

/** Data de hoje (AAAA-MM-DD) no fuso informado — o padrão é o horário de Brasília. */
export function hojeNoFuso(fuso = 'America/Sao_Paulo', agora = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora);
}

/** Texto de lembrete de cobrança para enviar pelo WhatsApp. */
export function mensagemCobranca(nomeCliente: string, resumo: ResumoCobranca, formatarReais: (c: number) => string): string {
  const primeiroNome = nomeCliente.trim().split(/\s+/)[0];
  const br = (d: string) => d.split('-').reverse().join('/');
  if (resumo.situacao === 'ATRASADA') {
    const venc = resumo.parcelas.find((p) => p.situacao === 'VENCIDA')!;
    return `Oi, ${primeiroNome}! Tudo bem? Passando para lembrar do pagamento de ${formatarReais(resumo.valor_vencido_centavos)} que venceu em ${br(venc.vencimento)}. Se já pagou, me avisa que eu atualizo aqui. Obrigada!`;
  }
  if (resumo.proximo_vencimento) {
    return `Oi, ${primeiroNome}! Tudo bem? Só lembrando que o próximo pagamento vence em ${br(resumo.proximo_vencimento)}. Saldo em aberto: ${formatarReais(resumo.saldo_centavos)}. Obrigada!`;
  }
  return `Oi, ${primeiroNome}! Tudo bem? Passando para lembrar do saldo em aberto de ${formatarReais(resumo.saldo_centavos)}. Obrigada!`;
}

/** Link do WhatsApp com mensagem pronta. Telefone brasileiro sem DDI recebe 55. */
export function linkWhatsApp(telefone: string | null | undefined, mensagem: string): string | null {
  const digitos = (telefone ?? '').replace(/\D/g, '');
  if (digitos.length < 10) return null;
  const comDdi = digitos.length <= 11 ? `55${digitos}` : digitos;
  return `https://wa.me/${comDdi}?text=${encodeURIComponent(mensagem)}`;
}
