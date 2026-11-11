import { describe, it, expect } from 'vitest';
import {
  ItemConta,
  ContaCliente,
  Encomenda,
  DomainError
} from '../src/index.js';

describe('Story 2.1: Domínio Puro de Encomenda, ItemConta e ContaCliente', () => {
  const operacaoId = '018f3a20-0000-7000-8000-000000000001';
  const clienteId = '018f3a20-0000-7000-8000-000000000002';
  const produtoAId = '018f3a20-0000-7000-8000-000000000003';
  const produtoBId = '018f3a20-0000-7000-8000-000000000004';
  const contaId = '018f3a20-0000-7000-8000-000000000005';

  describe('ItemConta & Congelamento Histórico (AD-2, FR-019, FR-015)', () => {
    it('deve criar ItemConta válido com status AGUARDANDO_FABRICA e valores calculados', () => {
      const item = new ItemConta({
        operacaoId,
        contaId,
        produtoId: produtoAId,
        quantidade: 2,
        precoUnitarioCentavos: 5000, // R$ 50,00
        custoUnitarioCentavos: 3500, // R$ 35,00
        origemCusto: 'ESTIMADO_PERCENTUAL'
      });

      expect(item.statusEntrega).toBe('AGUARDANDO_FABRICA');
      expect(item.quantidade).toBe(2);
      expect(item.precoUnitarioCentavos).toBe(5000);
      expect(item.subtotalCentavos).toBe(10000); // R$ 100,00
      expect(item.subtotalFormatado).toContain('100,00');
      expect(item.custoUnitarioCentavos).toBe(3500);
      expect(item.subtotalCustoCentavos).toBe(7000);
      expect(item.origemCusto).toBe('ESTIMADO_PERCENTUAL');
    });

    it('deve preservar custo NULL e origem DESCONHECIDO sem presumir zero (AD-2)', () => {
      const item = new ItemConta({
        operacaoId,
        contaId,
        produtoId: produtoAId,
        quantidade: 1,
        precoUnitarioCentavos: 8000,
        custoUnitarioCentavos: null
      });

      expect(item.custoUnitarioCentavos).toBeNull();
      expect(item.origemCusto).toBe('DESCONHECIDO');
      expect(item.custoUnitarioFormatado).toBe('Desconhecido');
      expect(item.subtotalCustoCentavos).toBeNull();
    });

    it('deve rejeitar quantidade menor ou igual a zero com erro QUANTIDADE_INVALIDA (FR-015)', () => {
      expect(() => {
        new ItemConta({
          operacaoId,
          contaId,
          produtoId: produtoAId,
          quantidade: 0,
          precoUnitarioCentavos: 5000
        });
      }).toThrowError();

      try {
        new ItemConta({
          operacaoId,
          contaId,
          produtoId: produtoAId,
          quantidade: -1,
          precoUnitarioCentavos: 5000
        });
      } catch (err: any) {
        expect(err).toBeInstanceOf(DomainError);
        expect(err.problem.code).toBe('QUANTIDADE_INVALIDA');
        expect(err.problem.status).toBe(400);
      }
    });

    it('deve rejeitar preço unitário menor ou igual a zero', () => {
      expect(() => {
        new ItemConta({
          operacaoId,
          contaId,
          produtoId: produtoAId,
          quantidade: 1,
          precoUnitarioCentavos: 0
        });
      }).toThrow();
    });
  });

  describe('ContaCliente & Projeção "Visão Sem Itens Aguardados" (AD-4, FR-016)', () => {
    it('conta nasce com total devido, mas com saldo cobrável hoje R$ 0,00 se todos os itens estão AGUARDANDO_FABRICA', () => {
      const item1 = new ItemConta({
        operacaoId,
        contaId,
        produtoId: produtoAId,
        quantidade: 2,
        precoUnitarioCentavos: 5000 // R$ 100,00
      });
      const item2 = new ItemConta({
        operacaoId,
        contaId,
        produtoId: produtoBId,
        quantidade: 1,
        precoUnitarioCentavos: 4500 // R$ 45,00
      });

      const conta = new ContaCliente({
        id: contaId,
        operacaoId,
        clienteId,
        itens: [item1, item2]
      });

      // Total devido total: R$ 145,00 (14500 centavos)
      expect(conta.valorTotalCentavos).toBe(14500);
      expect(conta.calcularSaldoTotalDevidoCentavos()).toBe(14500);
      expect(conta.valorTotalFormatado).toContain('145,00');

      // Projeção "Sem Aguardados": R$ 0,00 cobrável hoje!
      expect(conta.calcularTotalSemAguardadosCentavos()).toBe(0);
      expect(conta.calcularSaldoCobravelHojeCentavos()).toBe(0);
      expect(conta.saldoCobravelHojeFormatado).toContain('0,00');
    });

    it('quando um item chega da fábrica e é reservado/disponibilizado, o saldo cobrável hoje passa a incluí-lo', () => {
      const item1 = new ItemConta({
        operacaoId,
        contaId,
        produtoId: produtoAId,
        quantidade: 2,
        precoUnitarioCentavos: 5000 // R$ 100,00
      });
      const item2 = new ItemConta({
        operacaoId,
        contaId,
        produtoId: produtoBId,
        quantidade: 1,
        precoUnitarioCentavos: 4500 // R$ 45,00
      });

      const conta = new ContaCliente({
        id: contaId,
        operacaoId,
        clienteId,
        itens: [item1, item2]
      });

      // Chegada do item 1 da fábrica (agora RESERVADO_PRESENTE na estante)
      item1.atualizarStatusEntrega('RESERVADO_PRESENTE');

      expect(conta.calcularTotalSemAguardadosCentavos()).toBe(10000); // R$ 100,00
      expect(conta.calcularSaldoCobravelHojeCentavos()).toBe(10000); // R$ 100,00
      expect(conta.calcularSaldoTotalDevidoCentavos()).toBe(14500); // R$ 145,00
    });

    it('pagamento parcial amortiza saldo cobrável hoje e saldo total', () => {
      const item1 = new ItemConta({
        operacaoId,
        contaId,
        produtoId: produtoAId,
        quantidade: 1,
        precoUnitarioCentavos: 10000,
        statusEntrega: 'RESERVADO_PRESENTE'
      });

      const conta = new ContaCliente({
        id: contaId,
        operacaoId,
        clienteId,
        itens: [item1]
      });

      conta.registrarPagamento(4000); // R$ 40,00 pagos

      expect(conta.totalPagoCentavos).toBe(4000);
      expect(conta.status).toBe('PARCIALMENTE_PAGA');
      expect(conta.calcularSaldoTotalDevidoCentavos()).toBe(6000);
      expect(conta.calcularSaldoCobravelHojeCentavos()).toBe(6000);

      conta.registrarPagamento(6000); // mais R$ 60,00
      expect(conta.totalPagoCentavos).toBe(10000);
      expect(conta.status).toBe('QUITADA');
      expect(conta.calcularSaldoTotalDevidoCentavos()).toBe(0);
      expect(conta.calcularSaldoCobravelHojeCentavos()).toBe(0);
    });
  });

  describe('Encomenda (FR-015, FR-016)', () => {
    it('deve criar encomenda com itens e totais calculados', () => {
      const item1 = new ItemConta({
        operacaoId,
        contaId,
        produtoId: produtoAId,
        quantidade: 3,
        precoUnitarioCentavos: 3000
      });

      const encomenda = new Encomenda({
        operacaoId,
        clienteId,
        descricao: 'Presente de Aniversário',
        itens: [item1]
      });

      expect(encomenda.status).toBe('AGUARDANDO_FABRICA');
      expect(encomenda.quantidadeTotalItens).toBe(3);
      expect(encomenda.valorTotalCentavos).toBe(9000);
      expect(encomenda.descricao).toBe('Presente de Aniversário');
    });

    it('deve rejeitar encomenda sem itens', () => {
      expect(() => {
        new Encomenda({
          operacaoId,
          clienteId,
          itens: []
        });
      }).toThrow();
    });

    it('deve desconsiderar itens cancelados nos totais calculados da encomenda', () => {
      const itemAtivo = new ItemConta({
        operacaoId,
        contaId,
        produtoId: produtoAId,
        quantidade: 2,
        precoUnitarioCentavos: 5000,
        statusEntrega: 'AGUARDANDO_FABRICA'
      });

      const itemCancelado = new ItemConta({
        operacaoId,
        contaId,
        produtoId: produtoBId,
        quantidade: 1,
        precoUnitarioCentavos: 4000,
        statusEntrega: 'CANCELADO'
      });

      const encomenda = new Encomenda({
        operacaoId,
        clienteId,
        itens: [itemAtivo, itemCancelado]
      });

      expect(encomenda.quantidadeTotalItens).toBe(2);
      expect(encomenda.valorTotalCentavos).toBe(10000);
    });
  });
});
