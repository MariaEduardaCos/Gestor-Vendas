import { describe, it, expect } from 'vitest';
import { montarFilaCobranca, mensagemFilaCobranca } from '../src/domain/cobranca';

const reais = (c: number) => `R$ ${(c / 100).toFixed(2).replace('.', ',')}`;
const HOJE = '2026-11-13';

describe('Fila de cobrança do dia', () => {
  it('junta as contas da mesma cliente e soma atrasado e vencendo hoje', () => {
    const fila = montarFilaCobranca(
      [
        { id: 'c1', cliente_id: 'ana', valor_total: 9000, total_pago: 0, vencimentos: ['2026-11-01', '2026-12-01', '2027-01-01'] },
        { id: 'c2', cliente_id: 'ana', valor_total: 5000, total_pago: 0, vencimentos: [HOJE] }
      ],
      HOJE
    );
    expect(fila).toHaveLength(1);
    expect(fila[0]).toMatchObject({
      cliente_id: 'ana',
      motivo: 'ATRASADA',
      valor_vencido_centavos: 3000,
      valor_vence_hoje_centavos: 5000,
      vencido_desde: '2026-11-01',
      dias_atraso: 12,
      saldo_centavos: 14000,
      conta_ids: ['c1', 'c2']
    });
    expect(mensagemFilaCobranca('Ana Souza', fila[0], reais)).toBe(
      'Oi, Ana! Tudo bem? Passando para lembrar do pagamento de R$ 30,00 que venceu em 01/11/2026, e de R$ 50,00 que vence hoje. Se já pagou, me avisa que eu atualizo aqui. Obrigada!'
    );
  });

  it('ordena atrasadas, depois vence hoje, depois vence em breve; ignora quitadas, sem vencimento e vencimentos distantes', () => {
    const fila = montarFilaCobranca(
      [
        { id: 'a', cliente_id: 'breve', valor_total: 1000, total_pago: 0, vencimentos: ['2026-11-15'] },
        { id: 'b', cliente_id: 'hoje', valor_total: 1000, total_pago: 0, vencimentos: [HOJE] },
        { id: 'c', cliente_id: 'pouco', valor_total: 1000, total_pago: 0, vencimentos: ['2026-11-10'] },
        { id: 'd', cliente_id: 'muito', valor_total: 1000, total_pago: 0, vencimentos: ['2026-10-01'] },
        { id: 'e', cliente_id: 'quitada', valor_total: 1000, total_pago: 1000, vencimentos: ['2026-10-01'] },
        { id: 'f', cliente_id: 'sem', valor_total: 1000, total_pago: 0, vencimentos: [] },
        { id: 'g', cliente_id: 'longe', valor_total: 1000, total_pago: 0, vencimentos: ['2026-11-30'] }
      ],
      HOJE
    );
    expect(fila.map((i) => i.cliente_id)).toEqual(['muito', 'pouco', 'hoje', 'breve']);
  });

  it('parcela vencida já paga não entra; pagamento parcial reduz o valor cobrado', () => {
    const fila = montarFilaCobranca(
      [
        { id: 'x', cliente_id: 'paga', valor_total: 6000, total_pago: 3000, vencimentos: ['2026-11-01', '2026-12-01'] },
        { id: 'y', cliente_id: 'parcial', valor_total: 6000, total_pago: 1000, vencimentos: ['2026-11-01', '2026-12-01'] }
      ],
      HOJE
    );
    expect(fila).toHaveLength(1);
    expect(fila[0]).toMatchObject({ cliente_id: 'parcial', valor_vencido_centavos: 2000 });
  });

  it('mensagens de vence hoje e de lembrete', () => {
    const [hoje] = montarFilaCobranca([{ id: 'h', cliente_id: 'h', valor_total: 2500, total_pago: 0, vencimentos: [HOJE] }], HOJE);
    expect(mensagemFilaCobranca('Bia', hoje, reais)).toContain('hoje vence o pagamento de R$ 25,00');
    const [breve] = montarFilaCobranca([{ id: 'b', cliente_id: 'b', valor_total: 2500, total_pago: 0, vencimentos: ['2026-11-16'] }], HOJE);
    expect(mensagemFilaCobranca('Bia', breve, reais)).toContain('no dia 16/11/2026 vence o pagamento de R$ 25,00');
  });
});
