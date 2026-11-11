import { describe, it, expect } from 'vitest';
import { FiltroAntiDuplicacao } from '../src/index.js';

describe('Story 1.5: FiltroAntiDuplicacao (Domain Scanner)', () => {
  it('deve aceitar a primeira leitura de um código de barras válido', () => {
    const filtro = new FiltroAntiDuplicacao();
    const resultado = filtro.processar('7891234567890');

    expect(resultado.aceito).toBe(true);
    expect(resultado.codigo).toBe('7891234567890');
    expect(resultado.motivo).toBeUndefined();
  });

  it('deve ter 1500ms como janela padrão de debounce e reportar via getJanelaMs()', () => {
    const filtroPadrao = new FiltroAntiDuplicacao();
    expect(filtroPadrao.getJanelaMs()).toBe(1500);
  });

  it('deve bloquear leituras repetidas do mesmo código dentro da janela de 1,5s (1500ms) (FR-009)', () => {
    let tempo = 1000;
    const filtro = new FiltroAntiDuplicacao({
      janelaDebounceMs: 1500,
      obterTempo: () => tempo
    });

    // 1ª leitura no t = 1000ms: deve ser aceita
    const r1 = filtro.processar('7891234567890');
    expect(r1.aceito).toBe(true);
    expect(r1.codigo).toBe('7891234567890');

    // 2ª leitura no t = 1500ms (+500ms): produto mantido no enquadramento, deve ser rejeitada
    tempo = 1500;
    const r2 = filtro.processar('7891234567890');
    expect(r2.aceito).toBe(false);
    expect(r2.motivo).toBe('DEBOUNCE');

    // 3ª leitura no t = 2499ms (+1499ms desde a 1ª): ainda bloqueada (borda estrita)
    tempo = 2499;
    const r3 = filtro.processar('7891234567890');
    expect(r3.aceito).toBe(false);
    expect(r3.motivo).toBe('DEBOUNCE');

    // 4ª leitura no t = 2500ms (+1500ms desde a 1ª): janela expirou, deve ser aceita
    tempo = 2500;
    const r4 = filtro.processar('7891234567890');
    expect(r4.aceito).toBe(true);
    expect(r4.codigo).toBe('7891234567890');
  });

  it('deve aceitar leituras sequenciais rápidas de códigos distintos (código diferente reseta o bloqueio)', () => {
    let tempo = 1000;
    const filtro = new FiltroAntiDuplicacao({
      obterTempo: () => tempo
    });

    // Produto A no t = 1000ms
    const rA1 = filtro.processar('PRODUTO_A');
    expect(rA1.aceito).toBe(true);

    // Produto B no t = 1500ms (apenas 500ms depois, mas código diferente): DEVE SER ACEITO
    tempo = 1500;
    const rB1 = filtro.processar('PRODUTO_B');
    expect(rB1.aceito).toBe(true);
    expect(rB1.codigo).toBe('PRODUTO_B');

    // Produto A novamente no t = 1700ms (código diferente do anterior B): DEVE SER ACEITO
    tempo = 1700;
    const rA2 = filtro.processar('PRODUTO_A');
    expect(rA2.aceito).toBe(true);
  });

  it('deve sanitizar espaços nas pontas e considerar iguais códigos com espaços extras', () => {
    let tempo = 1000;
    const filtro = new FiltroAntiDuplicacao({
      obterTempo: () => tempo
    });

    const r1 = filtro.processar('   7891234567890   ');
    expect(r1.aceito).toBe(true);
    expect(r1.codigo).toBe('7891234567890');

    tempo = 1200;
    const r2 = filtro.processar('7891234567890\n');
    expect(r2.aceito).toBe(false);
    expect(r2.motivo).toBe('DEBOUNCE');
  });

  it('deve rejeitar códigos vazios ou nulos como CODIGO_INVALIDO', () => {
    const filtro = new FiltroAntiDuplicacao();

    expect(filtro.processar('').aceito).toBe(false);
    expect(filtro.processar('').motivo).toBe('CODIGO_INVALIDO');

    expect(filtro.processar('   ').aceito).toBe(false);
    expect(filtro.processar('   ').motivo).toBe('CODIGO_INVALIDO');

    expect(filtro.processar(null).aceito).toBe(false);
    expect(filtro.processar(undefined).aceito).toBe(false);
  });

  it('podeProcessar deve ser idempotente e não consumir ou mutar a leitura', () => {
    let tempo = 1000;
    const filtro = new FiltroAntiDuplicacao({
      obterTempo: () => tempo
    });

    // Antes de processar, podeProcessar é true
    expect(filtro.podeProcessar('CODIGO_X')).toBe(true);
    expect(filtro.podeProcessar('CODIGO_X')).toBe(true);
    expect(filtro.getUltimoCodigo()).toBeNull();

    // Processa de fato
    const res = filtro.processar('CODIGO_X');
    expect(res.aceito).toBe(true);
    expect(filtro.getUltimoCodigo()).toBe('CODIGO_X');

    // Agora podeProcessar é false sem mutar
    expect(filtro.podeProcessar('CODIGO_X')).toBe(false);
    expect(filtro.podeProcessar('CODIGO_X')).toBe(false);
  });
});
