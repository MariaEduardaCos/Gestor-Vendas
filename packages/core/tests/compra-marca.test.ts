import { describe, it, expect } from 'vitest';
import { CompraMarca, ItemCompraMarca } from '../src/domain/compra-marca.js';
import { gerarUuidV7 } from '../src/value-objects/uuid.js';

describe('Story 2.2: CompraMarca e Consolidação de Espelho por Produto', () => {
  const operacaoId = gerarUuidV7();
  const marcaId = gerarUuidV7();
  const produtoHidratanteId = gerarUuidV7();
  const produtoBatomId = gerarUuidV7();

  const clienteAnaId = gerarUuidV7();
  const clienteBiaId = gerarUuidV7();

  describe('ItemCompraMarca (FR-018)', () => {
    it('deve criar item de compra para cliente com vínculo nominal', () => {
      const item = new ItemCompraMarca({
        operacaoId,
        compraId: gerarUuidV7(),
        produtoId: produtoHidratanteId,
        destinacao: 'CLIENTE',
        clienteId: clienteAnaId,
        clienteNome: 'Ana Silva',
        quantidade: 1,
        custoUnitarioCentavos: 3500,
        origemCusto: 'ESTIMADO_PERCENTUAL'
      });

      expect(item.destinacao).toBe('CLIENTE');
      expect(item.clienteId).toBe(clienteAnaId);
      expect(item.clienteNome).toBe('Ana Silva');
      expect(item.quantidade).toBe(1);
      expect(item.custoUnitarioCentavos).toBe(3500);
      expect(item.subtotalCustoCentavos).toBe(3500);
    });

    it('deve rejeitar item com destinação CLIENTE sem clienteId', () => {
      expect(() => {
        new ItemCompraMarca({
          operacaoId,
          compraId: gerarUuidV7(),
          produtoId: produtoHidratanteId,
          destinacao: 'CLIENTE',
          quantidade: 1
        });
      }).toThrowError(/cliente_id válido/);
    });

    it('deve criar item de compra para pronta-entrega sem exigir clienteId', () => {
      const item = new ItemCompraMarca({
        operacaoId,
        compraId: gerarUuidV7(),
        produtoId: produtoHidratanteId,
        destinacao: 'PRONTA_ENTREGA',
        quantidade: 2,
        custoUnitarioCentavos: 3500
      });

      expect(item.destinacao).toBe('PRONTA_ENTREGA');
      expect(item.clienteId).toBeNull();
      expect(item.quantidade).toBe(2);
      expect(item.subtotalCustoCentavos).toBe(7000);
    });

    it('deve rejeitar quantidade inválida (zero ou negativa)', () => {
      expect(() => {
        new ItemCompraMarca({
          operacaoId,
          compraId: gerarUuidV7(),
          produtoId: produtoHidratanteId,
          destinacao: 'PRONTA_ENTREGA',
          quantidade: 0
        });
      }).toThrowError(/maior que zero/);
    });
  });

  describe('CompraMarca e Espelho Consolidado (FR-015, FR-017, FR-018)', () => {
    it('deve consolidar o espelho do pedido da marca somando quantidades e preservando vínculos nominais estritos', () => {
      const compraId = gerarUuidV7();

      // Ana: 1 hidratante
      const itemAna = new ItemCompraMarca({
        operacaoId,
        compraId,
        produtoId: produtoHidratanteId,
        destinacao: 'CLIENTE',
        clienteId: clienteAnaId,
        clienteNome: 'Ana Silva',
        quantidade: 1,
        custoUnitarioCentavos: 3500
      });

      // Bia: 1 hidratante
      const itemBia = new ItemCompraMarca({
        operacaoId,
        compraId,
        produtoId: produtoHidratanteId,
        destinacao: 'CLIENTE',
        clienteId: clienteBiaId,
        clienteNome: 'Bia Santos',
        quantidade: 1,
        custoUnitarioCentavos: 3500
      });

      // Pronta-entrega: +1 hidratante
      const itemPeHidratante = new ItemCompraMarca({
        operacaoId,
        compraId,
        produtoId: produtoHidratanteId,
        destinacao: 'PRONTA_ENTREGA',
        quantidade: 1,
        custoUnitarioCentavos: 3500
      });

      // Pronta-entrega: 2 batons
      const itemPeBatom = new ItemCompraMarca({
        operacaoId,
        compraId,
        produtoId: produtoBatomId,
        destinacao: 'PRONTA_ENTREGA',
        quantidade: 2,
        custoUnitarioCentavos: 2000
      });

      const compra = new CompraMarca({
        id: compraId,
        operacaoId,
        marcaId,
        marcaNome: 'Natura',
        numeroPedido: 'PED-2026-001',
        observacoes: 'Ciclo 15/2026',
        itens: [itemAna, itemBia, itemPeHidratante, itemPeBatom]
      });

      expect(compra.status).toBe('PEDIDO_REGISTRADO');
      expect(compra.quantidadeTotalItens).toBe(5); // 3 hidratantes + 2 batons
      expect(compra.quantidadeItensClientes).toBe(2);
      expect(compra.quantidadeItensProntaEntrega).toBe(3);
      expect(compra.custoTotalEstimadoCentavos).toBe(3 * 3500 + 2 * 2000); // 10500 + 4000 = 14500 (R$ 145,00)
      expect(compra.custoTotalEstimadoFormatado).toBe('R$ 145,00');

      // Geração do espelho do pedido por produto
      const espelho = compra.gerarEspelhoPorProduto();
      expect(espelho.length).toBe(2);

      const espelhoHidratante = espelho.find((e) => e.produtoId === produtoHidratanteId)!;
      expect(espelhoHidratante).toBeDefined();
      expect(espelhoHidratante.quantidadeTotal).toBe(3);
      expect(espelhoHidratante.quantidadeClientes).toBe(2);
      expect(espelhoHidratante.quantidadeProntaEntrega).toBe(1);
      expect(espelhoHidratante.destinacoes.length).toBe(3);

      // Checa vínculos nominais
      const destAna = espelhoHidratante.destinacoes.find((d) => d.clienteId === clienteAnaId);
      expect(destAna?.clienteNome).toBe('Ana Silva');
      expect(destAna?.quantidade).toBe(1);

      const destBia = espelhoHidratante.destinacoes.find((d) => d.clienteId === clienteBiaId);
      expect(destBia?.clienteNome).toBe('Bia Santos');
      expect(destBia?.quantidade).toBe(1);

      const destPe = espelhoHidratante.destinacoes.find((d) => d.tipo === 'PRONTA_ENTREGA');
      expect(destPe?.quantidade).toBe(1);

      const espelhoBatom = espelho.find((e) => e.produtoId === produtoBatomId)!;
      expect(espelhoBatom.quantidadeTotal).toBe(2);
      expect(espelhoBatom.quantidadeClientes).toBe(0);
      expect(espelhoBatom.quantidadeProntaEntrega).toBe(2);
    });

    it('deve rejeitar compra sem itens', () => {
      expect(() => {
        new CompraMarca({
          operacaoId,
          marcaId,
          itens: []
        });
      }).toThrowError(/ao menos um item/);
    });

    it('deve rejeitar compra sem operacaoId ou marcaId', () => {
      expect(() => {
        new CompraMarca({
          operacaoId: '',
          marcaId,
          itens: [
            new ItemCompraMarca({
              operacaoId,
              compraId: gerarUuidV7(),
              produtoId: produtoHidratanteId,
              destinacao: 'PRONTA_ENTREGA',
              quantidade: 1
            })
          ]
        });
      }).toThrowError(/operacaoId é obrigatória/);
    });
  });
});
