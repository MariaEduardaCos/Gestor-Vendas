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
  forbiddenError,
  Cliente,
  formatarTelefone,
  sanitizarTelefone,
  Marca,
  Produto,
  EstoqueItem,
  MovimentacaoEstoque
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

  it('deve instanciar e validar entidade Cliente', () => {
    const cliente = new Cliente({
      operacaoId: 'op-123',
      nome: '  Carla Vizinha  ',
      telefone: '64998765432',
      endereco: 'Rua das Flores, 123'
    });

    expect(cliente.id).toBeDefined();
    expect(validarUuid(cliente.id)).toBe(true);
    expect(cliente.operacaoId).toBe('op-123');
    expect(cliente.nome).toBe('Carla Vizinha');
    expect(cliente.telefone).toBe('64998765432');
    expect(cliente.telefoneFormatado).toBe('(64) 99876-5432');
    expect(cliente.endereco).toBe('Rua das Flores, 123');
    expect(cliente.saldoCreditoCentavos).toBe(0);

    // Validações obrigatórias
    expect(() => new Cliente({ operacaoId: '', nome: 'Ana' })).toThrow();
    expect(() => new Cliente({ operacaoId: 'op-1', nome: '   ' })).toThrow();
    expect(() => new Cliente({ operacaoId: 'op-1', nome: 'Ana', saldoCreditoCentavos: -10 })).toThrow();

    // Valores em branco/espaços devem normalizar para null
    const clienteEspacos = new Cliente({
      operacaoId: 'op-1',
      nome: 'Cliente Espaços',
      telefone: '   ',
      endereco: '   '
    });
    expect(clienteEspacos.telefone).toBeNull();
    expect(clienteEspacos.endereco).toBeNull();

    clienteEspacos.atualizar({ telefone: '   ', endereco: '   ' });
    expect(clienteEspacos.telefone).toBeNull();
    expect(clienteEspacos.endereco).toBeNull();
  });

  it('deve atualizar dados do Cliente e gerenciar crédito', () => {
    const cliente = new Cliente({
      operacaoId: 'op-1',
      nome: 'Bia Santos'
    });

    cliente.atualizar({ nome: 'Bia Santos Silva', telefone: '(64) 98888-1111' });
    expect(cliente.nome).toBe('Bia Santos Silva');
    expect(cliente.telefone).toBe('(64) 98888-1111');

    cliente.adicionarCredito(5000); // R$ 50,00
    expect(cliente.saldoCreditoCentavos).toBe(5000);

    cliente.debitarCredito(2000); // R$ 20,00
    expect(cliente.saldoCreditoCentavos).toBe(3000);

    expect(() => cliente.debitarCredito(4000)).toThrow('Saldo de crédito insuficiente');
  });

  it('deve formatar e sanitizar telefones corretamente', () => {
    expect(formatarTelefone('64998765432')).toBe('(64) 99876-5432');
    expect(formatarTelefone('6433221100')).toBe('(64) 3322-1100');
    expect(sanitizarTelefone('(64) 99876-5432')).toBe('64998765432');
    expect(sanitizarTelefone('')).toBeNull();
  });

  it('deve instanciar e validar entidade Marca', () => {
    const marca = new Marca({
      operacaoId: 'op-1',
      nome: 'Natura',
      percentualPadrao: 30
    });

    expect(marca.id).toBeDefined();
    expect(validarUuid(marca.id)).toBe(true);
    expect(marca.operacaoId).toBe('op-1');
    expect(marca.nome).toBe('Natura');
    expect(marca.percentualPadrao).toBe(30);

    marca.atualizar({ percentualPadrao: 35 });
    expect(marca.percentualPadrao).toBe(35);

    marca.atualizar({ percentualPadrao: null });
    expect(marca.percentualPadrao).toBeNull();

    expect(() => new Marca({ operacaoId: '', nome: 'Avon' })).toThrow();
    expect(() => new Marca({ operacaoId: 'op-1', nome: '' })).toThrow();
    expect(() => new Marca({ operacaoId: 'op-1', nome: 'Avon', percentualPadrao: -5 })).toThrow();
    expect(() => new Marca({ operacaoId: 'op-1', nome: 'Avon', percentualPadrao: 105 })).toThrow();
  });

  it('deve calcular custo estimado a partir do percentual da marca (FR-011, D-01)', () => {
    // Given um produto cadastrado com preço de venda R$ 100,00 e uma marca cadastrada com percentual de lucro de 30%
    const produto = new Produto({
      operacaoId: 'op-1',
      nome: 'Hidratante Tododia Algodão',
      precoVendaCentavos: 10000, // R$ 100,00
      percentualDescontoMarca: 30
    });

    // When o custo estimado for calculado, then o sistema registra custo estimado de R$ 70,00 com proveniência ESTIMADO_PERCENTUAL
    expect(produto.precoVendaCentavos).toBe(10000);
    expect(produto.custoCentavos).toBe(7000);
    expect(produto.provenienciaCusto).toBe('ESTIMADO_PERCENTUAL');
    expect(produto.precoVendaFormatado).toContain('100,00');
    expect(produto.custoFormatado).toContain('70,00');
  });

  it('deve priorizar custo manual informado e validar valores não negativos (FR-011)', () => {
    const produto = new Produto({
      operacaoId: 'op-1',
      nome: 'Perfume Essencial',
      precoVendaCentavos: 20000, // R$ 200,00
      custoManualCentavos: 12000, // R$ 120,00
      percentualDescontoMarca: 30 // Mesmo tendo marca, manual prevalece
    });

    expect(produto.custoCentavos).toBe(12000);
    expect(produto.provenienciaCusto).toBe('INFORMADO_MANUAL');
    expect(produto.custoFormatado).toContain('120,00');

    expect(() => new Produto({
      operacaoId: 'op-1',
      nome: 'Perfume',
      precoVendaCentavos: 10000,
      custoManualCentavos: -500
    })).toThrow();
  });

  it('deve registrar custo NULL e proveniencia DESCONHECIDO se ausente percentual e custo manual (FR-012, AD-2)', () => {
    // Proibido gravar 0,00 ou deduzir percentuais fictícios
    const produto = new Produto({
      operacaoId: 'op-1',
      nome: 'Produto Sem Custo',
      precoVendaCentavos: 5000
    });

    expect(produto.custoCentavos).toBeNull();
    expect(produto.provenienciaCusto).toBe('DESCONHECIDO');
    expect(produto.custoFormatado).toBe('Desconhecido');
  });

  it('deve validar preço de venda estritamente positivo e inteiro', () => {
    expect(() => new Produto({
      operacaoId: 'op-1',
      nome: 'Produto Zero',
      precoVendaCentavos: 0
    })).toThrow();

    expect(() => new Produto({
      operacaoId: 'op-1',
      nome: 'Produto Negativo',
      precoVendaCentavos: -100
    })).toThrow();

    expect(() => new Produto({
      operacaoId: 'op-1',
      nome: 'Produto Decimal',
      precoVendaCentavos: 49.99 as any
    })).toThrow();
  });

  it('variantes do mesmo produto recebem UUIDs v7 distintos e não se agrupam (FR-006)', () => {
    const v1 = new Produto({
      operacaoId: 'op-1',
      nome: 'Hidratante Tododia',
      variante: 'Algodão 400ml',
      precoVendaCentavos: 6000
    });

    const v2 = new Produto({
      operacaoId: 'op-1',
      nome: 'Hidratante Tododia',
      variante: 'Macadâmia Refil',
      precoVendaCentavos: 4500
    });

    expect(v1.id).not.toBe(v2.id);
    expect(validarUuid(v1.id)).toBe(true);
    expect(validarUuid(v2.id)).toBe(true);
    expect(v1.nome).toBe(v2.nome);
    expect(v1.variante).toBe('Algodão 400ml');
    expect(v2.variante).toBe('Macadâmia Refil');
  });

  it('deve armazenar null para marcaId com espaços em branco', () => {
    const prod = new Produto({
      operacaoId: 'op-1',
      marcaId: '   ',
      nome: 'Sabonete',
      precoVendaCentavos: 1500
    });
    expect(prod.marcaId).toBeNull();

    prod.atualizar({ marcaId: '    ' });
    expect(prod.marcaId).toBeNull();
  });

  it('deve preservar custo manual ao alterar preço ou detalhes em produto INFORMADO_MANUAL', () => {
    const prod = new Produto({
      operacaoId: 'op-1',
      nome: 'Perfume Kaiak',
      precoVendaCentavos: 10000,
      custoManualCentavos: 6500
    });
    expect(prod.custoCentavos).toBe(6500);
    expect(prod.provenienciaCusto).toBe('INFORMADO_MANUAL');

    // Atualiza apenas o nome
    prod.atualizar({ nome: 'Perfume Kaiak Masculino' });
    expect(prod.custoCentavos).toBe(6500);
    expect(prod.provenienciaCusto).toBe('INFORMADO_MANUAL');

    // Atualiza o preço sem passar parâmetros de custo
    prod.atualizar({ precoVendaCentavos: 12000 });
    expect(prod.custoCentavos).toBe(6500);
    expect(prod.provenienciaCusto).toBe('INFORMADO_MANUAL');
  });

  it('deve recalcular custo ao alterar preço em produto ESTIMADO_PERCENTUAL', () => {
    const prod = new Produto({
      operacaoId: 'op-1',
      nome: 'Hidratante Tododia',
      precoVendaCentavos: 10000,
      percentualDescontoMarca: 30
    });
    expect(prod.custoCentavos).toBe(7000);
    expect(prod.provenienciaCusto).toBe('ESTIMADO_PERCENTUAL');

    // Atualiza apenas variante: custo preservado
    prod.atualizar({ variante: 'Macadâmia' });
    expect(prod.custoCentavos).toBe(7000);
    expect(prod.provenienciaCusto).toBe('ESTIMADO_PERCENTUAL');

    // Atualiza preço: 30% sobre 20000 = 14000
    prod.atualizar({ precoVendaCentavos: 20000 });
    expect(prod.custoCentavos).toBe(14000);
    expect(prod.provenienciaCusto).toBe('ESTIMADO_PERCENTUAL');
  });

  describe('Story 1.4: Conservação de Estoque e Estoque Inicial', () => {
    it('deve instanciar EstoqueItem válido respeitando Presentes = Reservados + ProntaEntrega (AD-3)', () => {
      const item = new EstoqueItem({
        operacaoId: 'op-1',
        produtoId: 'prod-1',
        presentes: 5,
        reservados: 2,
        prontaEntrega: 3
      });

      expect(item.presentes).toBe(5);
      expect(item.reservados).toBe(2);
      expect(item.prontaEntrega).toBe(3);
      expect(item.presentes).toBe(item.reservados + item.prontaEntrega);
    });

    it('deve criar estoque inicial com Presentes = X, ProntaEntrega = X e Reservados = 0', () => {
      const item = EstoqueItem.criarInicial({
        operacaoId: 'op-1',
        produtoId: 'prod-1',
        quantidade: 5
      });

      expect(item.presentes).toBe(5);
      expect(item.prontaEntrega).toBe(5);
      expect(item.reservados).toBe(0);
      expect(item.presentes).toBe(item.reservados + item.prontaEntrega);
    });

    it('deve rejeitar violações da regra de conservação de estoque (AD-3)', () => {
      // Presentes (5) != Reservados (2) + ProntaEntrega (2) -> soma 4
      expect(() => new EstoqueItem({
        operacaoId: 'op-1',
        produtoId: 'prod-1',
        presentes: 5,
        reservados: 2,
        prontaEntrega: 2
      })).toThrow(/regra de conservação de estoque foi violada/i);

      // Presentes menor que Reservados
      expect(() => new EstoqueItem({
        operacaoId: 'op-1',
        produtoId: 'prod-1',
        presentes: 2,
        reservados: 3,
        prontaEntrega: -1
      })).toThrow();
    });

    it('deve rejeitar quantidades negativas e não inteiras no estoque (NFR-001)', () => {
      expect(() => EstoqueItem.criarInicial({
        operacaoId: 'op-1',
        produtoId: 'prod-1',
        quantidade: -2
      })).toThrow(/não negativo/i);

      expect(() => EstoqueItem.criarInicial({
        operacaoId: 'op-1',
        produtoId: 'prod-1',
        quantidade: 1.5
      })).toThrow(/inteiro/i);

      const item = EstoqueItem.criarInicial({
        operacaoId: 'op-1',
        produtoId: 'prod-1',
        quantidade: 5
      });

      expect(() => item.lancarEstoqueInicial(-2)).toThrow(/não negativo/i);
      expect(() => item.lancarEstoqueInicial(2.5)).toThrow(/inteiro/i);

      // Rejeita redefinir estoque inicial com reservas ativas
      const itemComReserva = new EstoqueItem({
        operacaoId: 'op-1',
        produtoId: 'prod-1',
        presentes: 5,
        reservados: 2,
        prontaEntrega: 3
      });
      expect(() => itemComReserva.lancarEstoqueInicial(10)).toThrow(/reservas ativas/i);
    });

    it('deve registrar MovimentacaoEstoque do tipo ESTOQUE_INICIAL com compraId nulo (FR-013, NFR-003)', () => {
      const mov = new MovimentacaoEstoque({
        operacaoId: 'op-1',
        produtoId: 'prod-1',
        estoqueItemId: 'est-1',
        tipo: 'ESTOQUE_INICIAL',
        quantidade: 5,
        presentesAnterior: 0,
        presentesPosterior: 5,
        reservadosAnterior: 0,
        reservadosPosterior: 0,
        prontaEntregaAnterior: 0,
        prontaEntregaPosterior: 5,
        compraId: null,
        operadorId: 'user-1',
        operadorNome: 'Dona Sônia',
        detalhes: 'Contagem inicial da estante física'
      });

      expect(mov.tipo).toBe('ESTOQUE_INICIAL');
      expect(mov.quantidade).toBe(5);
      expect(mov.compraId).toBeNull();
      expect(mov.operadorNome).toBe('Dona Sônia');
      expect(mov.criadoEm).toBeDefined();

      // Não pode permitir compraId em ESTOQUE_INICIAL
      expect(() => new MovimentacaoEstoque({
        operacaoId: 'op-1',
        produtoId: 'prod-1',
        estoqueItemId: 'est-1',
        tipo: 'ESTOQUE_INICIAL',
        quantidade: 5,
        presentesAnterior: 0,
        presentesPosterior: 5,
        reservadosAnterior: 0,
        reservadosPosterior: 0,
        prontaEntregaAnterior: 0,
        prontaEntregaPosterior: 5,
        compraId: 'compra-ficticia-123',
        operadorId: 'user-1',
        operadorNome: 'Dona Sônia'
      })).toThrow(/vínculo com compra/i);
    });
  });
});

