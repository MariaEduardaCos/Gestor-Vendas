import { describe, it, expect } from 'vitest';
import {
  Operacao,
  Operador,
  SessaoOperacional,
  RegistroAuditoria,
  Centavos,
  gerarUuidV7,
  validarUuid,
  unauthorizedError,
  forbiddenError
} from '../src/index.js';

describe('Core Domain & Value Objects', () => {
  it('deve gerar UUID v7 válido e ordenável', () => {
    const id1 = gerarUuidV7();
    const id2 = gerarUuidV7();
    expect(validarUuid(id1)).toBe(true);
    expect(validarUuid(id2)).toBe(true);
    expect(id1).not.toBe(id2);
  });

  it('deve instanciar Operacao com id v7 e timestamp UTC', () => {
    const op = new Operacao({ nome: 'Operação Dona Sônia' });
    expect(op.id).toBeDefined();
    expect(op.nome).toBe('Operação Dona Sônia');
    expect(new Date(op.criadoEm).toISOString()).toBe(op.criadoEm);

    expect(() => new Operacao({ nome: undefined as any })).toThrow('O nome da operação é obrigatório.');
    expect(() => new Operacao({ nome: '   ' })).toThrow('O nome da operação é obrigatório.');
  });

  it('deve instanciar Operador vinculado à Operacao', () => {
    const op = new Operacao({ nome: 'Operação Dona Sônia' });
    const operador = new Operador({
      operacaoId: op.id,
      nome: 'Dona Sônia',
      ativo: true
    });
    expect(operador.operacaoId).toBe(op.id);
    expect(operador.nome).toBe('Dona Sônia');
    expect(operador.ativo).toBe(true);
  });

  it('deve exigir operacaoId e operador nominal para Sessao e Auditoria', () => {
    expect(() => new SessaoOperacional({ operacaoId: '', operadorId: 'op-1', operadorNome: 'Sônia' }))
      .toThrow('Sessão requer operacaoId obrigatório.');

    const sessao = new SessaoOperacional({
      operacaoId: 'op-1',
      operadorId: 'user-1',
      operadorNome: 'Dona Sônia'
    });

    const aud = RegistroAuditoria.criarDeSessao(sessao, 'CONFIRMAR_VENDA', 'Venda #10');
    expect(aud.operacaoId).toBe('op-1');
    expect(aud.operadorId).toBe('user-1');
    expect(aud.operadorNome).toBe('Dona Sônia');
    expect(aud.acao).toBe('CONFIRMAR_VENDA');
    expect(new Date(aud.criadoEm).toISOString()).toBe(aud.criadoEm);
  });

  it('Centavos deve garantir integridade e rejeitar ponto flutuante', () => {
    const c1 = Centavos.deInteiro(5000); // R$ 50,00
    const c2 = Centavos.deInteiro(2550); // R$ 25,50
    expect(c1.somar(c2).valor).toBe(7550);
    expect(c1.multiplicarPorQuantidade(2).valor).toBe(10000);

    expect(() => Centavos.deInteiro(49.99)).toThrow();
  });

  it('deve formatar erros no padrão RFC 7807', () => {
    const err = unauthorizedError('Sessão expirada.');
    expect(err.problem.status).toBe(401);
    expect(err.problem.code).toBe('UNAUTHORIZED');
    expect(err.problem.type).toBe('https://consultorasync.app/errors/unauthorized');
  });
});
