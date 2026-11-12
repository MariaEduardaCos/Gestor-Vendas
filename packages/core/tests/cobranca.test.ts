import { describe, it, expect } from 'vitest';
import {
  calcularCobranca,
  dividirEmParcelas,
  gerarVencimentosMensais,
  normalizarVencimentos,
  hojeNoFuso,
  linkWhatsApp,
  mensagemCobranca
} from '../src/domain/cobranca.js';

const reais = (c: number) => `R$ ${(c / 100).toFixed(2).replace('.', ',')}`;

describe('dividirEmParcelas e vencimentos mensais', () => {
  it('divide em centavos inteiros e a última parcela recebe o resto', () => {
    expect(dividirEmParcelas(10000, 3)).toEqual([3333, 3333, 3334]);
    expect(dividirEmParcelas(10000, 3).reduce((a, b) => a + b, 0)).toBe(10000);
  });

  it('gera meses seguidos ajustando o dia 31 para o fim de meses menores', () => {
    expect(gerarVencimentosMensais('2026-01-31', 3)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
    expect(gerarVencimentosMensais('2026-11-10', 3)).toEqual(['2026-11-10', '2026-12-10', '2027-01-10']);
  });

  it('recusa quantidade e datas inválidas', () => {
    expect(() => gerarVencimentosMensais('2026-02-30', 2)).toThrow();
    expect(() => gerarVencimentosMensais('2026-02-10', 0)).toThrow();
    expect(() => normalizarVencimentos(['2026-12-01', '2026-12-01'])).toThrow(/mesma data/);
    expect(() => normalizarVencimentos(['ontem'])).toThrow();
    expect(normalizarVencimentos(['2026-12-10', '2026-11-10'])).toEqual(['2026-11-10', '2026-12-10']);
  });
});

describe('calcularCobranca (FR-036)', () => {
  const hoje = '2026-11-12';

  it('sem vencimento nunca fica atrasada', () => {
    const r = calcularCobranca({ valor_total: 10000, total_pago: 0 }, [], hoje);
    expect(r).toMatchObject({ situacao: 'SEM_VENCIMENTO', valor_vencido_centavos: 0, dias_atraso: 0 });
  });

  it('atrasada só quando há data vencida e saldo positivo, contando os dias', () => {
    const r = calcularCobranca({ valor_total: 10000, total_pago: 0 }, ['2026-11-02'], hoje);
    expect(r).toMatchObject({ situacao: 'ATRASADA', valor_vencido_centavos: 10000, dias_atraso: 10 });
  });

  it('vencendo hoje ainda está em dia', () => {
    expect(calcularCobranca({ valor_total: 10000, total_pago: 0 }, [hoje], hoje).situacao).toBe('EM_DIA');
  });

  it('pagamentos quitam as parcelas na ordem; vencido é só o que falta das parcelas passadas', () => {
    const r = calcularCobranca({ valor_total: 9000, total_pago: 4000 }, ['2026-10-10', '2026-11-10', '2026-12-10'], hoje);
    expect(r.parcelas.map((p) => [p.situacao, p.pago_centavos])).toEqual([
      ['PAGA', 3000],
      ['VENCIDA', 1000],
      ['ABERTA', 0]
    ]);
    expect(r).toMatchObject({ situacao: 'ATRASADA', valor_vencido_centavos: 2000, proximo_vencimento: '2026-12-10', dias_atraso: 2 });
  });

  it('parcelas pagas em dia deixam a conta em dia', () => {
    const r = calcularCobranca({ valor_total: 9000, total_pago: 6000 }, ['2026-10-10', '2026-11-10', '2026-12-10'], hoje);
    expect(r.situacao).toBe('EM_DIA');
  });

  it('cancelamento reduz o total e as parcelas se ajustam sem soma divergente', () => {
    const r = calcularCobranca({ valor_total: 6000, total_pago: 0 }, ['2026-12-10', '2027-01-10'], hoje);
    expect(r.parcelas.map((p) => p.valor_centavos)).toEqual([3000, 3000]);
  });

  it('quitada não tem atraso mesmo com datas passadas', () => {
    const r = calcularCobranca({ valor_total: 5000, total_pago: 5000 }, ['2026-01-01'], hoje);
    expect(r).toMatchObject({ situacao: 'QUITADA', valor_vencido_centavos: 0, dias_atraso: 0 });
  });
});

describe('hojeNoFuso, WhatsApp e mensagem', () => {
  it('usa o dia de Brasília mesmo quando em UTC já é o dia seguinte', () => {
    expect(hojeNoFuso('America/Sao_Paulo', new Date('2026-11-13T01:30:00Z'))).toBe('2026-11-12');
  });

  it('monta link wa.me com DDI 55 e recusa telefone curto', () => {
    expect(linkWhatsApp('(64) 99999-0001', 'oi')).toBe('https://wa.me/5564999990001?text=oi');
    expect(linkWhatsApp('5564999990001', 'oi')).toBe('https://wa.me/5564999990001?text=oi');
    expect(linkWhatsApp('1234', 'oi')).toBeNull();
    expect(linkWhatsApp(null, 'oi')).toBeNull();
  });

  it('mensagem de atraso cita valor vencido e data', () => {
    const r = calcularCobranca({ valor_total: 10000, total_pago: 0 }, ['2026-11-02'], '2026-11-12');
    expect(mensagemCobranca('Ana Paula Souza', r, reais)).toContain('Oi, Ana!');
    expect(mensagemCobranca('Ana', r, reais)).toContain('R$ 100,00 que venceu em 02/11/2026');
  });
});
