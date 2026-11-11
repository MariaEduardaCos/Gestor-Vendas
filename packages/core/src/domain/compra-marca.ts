import { gerarUuidV7 } from '../value-objects/uuid.js';
import { Centavos } from '../value-objects/centavos.js';
import { DomainError, createProblemDetails } from '../errors/problem-details.js';
import type { OrigemCustoItem } from './encomenda.js';

export type DestinacaoItemCompra = 'CLIENTE' | 'PRONTA_ENTREGA';
export type StatusCompraMarca = 'PEDIDO_REGISTRADO' | 'CONFERENCIA_EM_ANDAMENTO' | 'CONFERIDA' | 'CANCELADA';

export interface DestinacaoNominal {
  tipo: DestinacaoItemCompra;
  quantidade: number;
  clienteId?: string | null;
  clienteNome?: string | null;
  encomendaId?: string | null;
  itemContaId?: string | null;
}

export interface EspelhoItemProduto {
  produtoId: string;
  quantidadeTotal: number;
  quantidadeClientes: number;
  quantidadeProntaEntrega: number;
  destinacoes: DestinacaoNominal[];
}

export interface ItemCompraMarcaProps {
  id?: string;
  operacaoId: string;
  compraId: string;
  produtoId: string;
  destinacao: DestinacaoItemCompra;
  quantidade: number;
  clienteId?: string | null;
  clienteNome?: string | null;
  encomendaId?: string | null;
  itemContaId?: string | null;
  custoUnitarioCentavos?: number | null;
  origemCusto?: OrigemCustoItem;
  quantidadeRecebida?: number;
  criadoEm?: string;
  atualizadoEm?: string;
}

export class ItemCompraMarca {
  public readonly id: string;
  public readonly operacaoId: string;
  public readonly compraId: string;
  public readonly produtoId: string;
  public readonly destinacao: DestinacaoItemCompra;
  public readonly quantidade: number;
  public readonly clienteId: string | null;
  public readonly clienteNome: string | null;
  public readonly encomendaId: string | null;
  public readonly itemContaId: string | null;
  public readonly custoUnitarioCentavos: number | null;
  public readonly origemCusto: OrigemCustoItem;
  public quantidadeRecebida: number;
  public readonly criadoEm: string;
  public atualizadoEm: string;

  constructor(props: ItemCompraMarcaProps) {
    if (!props.operacaoId || props.operacaoId.trim().length === 0) {
      throw new DomainError(
        createProblemDetails(400, 'BAD_REQUEST', 'Operação Obrigatória', 'A operacaoId é obrigatória para o item da compra.')
      );
    }
    if (!props.compraId || props.compraId.trim().length === 0) {
      throw new DomainError(
        createProblemDetails(400, 'BAD_REQUEST', 'Compra Obrigatória', 'A compraId é obrigatória para o item da compra.')
      );
    }
    if (!props.produtoId || props.produtoId.trim().length === 0) {
      throw new DomainError(
        createProblemDetails(400, 'BAD_REQUEST', 'Produto Obrigatório', 'O produtoId é obrigatório para o item da compra.')
      );
    }

    if (!Number.isInteger(props.quantidade) || props.quantidade <= 0) {
      throw new DomainError(
        createProblemDetails(
          400,
          'QUANTIDADE_INVALIDA',
          'Quantidade Inválida',
          'A quantidade de cada item da compra deve ser um número inteiro maior que zero.'
        )
      );
    }

    if (props.destinacao === 'CLIENTE') {
      if (!props.clienteId || props.clienteId.trim().length === 0) {
        throw new DomainError(
          createProblemDetails(
            400,
            'DESTINACAO_INVALIDA',
            'Cliente Obrigatório na Destinação',
            'Itens com destinação CLIENTE exigem a vinculação de um cliente_id válido.'
          )
        );
      }
    }

    const agora = new Date().toISOString();
    this.id = props.id ?? gerarUuidV7();
    this.operacaoId = props.operacaoId.trim();
    this.compraId = props.compraId.trim();
    this.produtoId = props.produtoId.trim();
    this.destinacao = props.destinacao;
    this.quantidade = props.quantidade;
    this.clienteId = props.clienteId && props.clienteId.trim().length > 0 ? props.clienteId.trim() : null;
    this.clienteNome = props.clienteNome && props.clienteNome.trim().length > 0 ? props.clienteNome.trim() : null;
    this.encomendaId = props.encomendaId && props.encomendaId.trim().length > 0 ? props.encomendaId.trim() : null;
    this.itemContaId = props.itemContaId && props.itemContaId.trim().length > 0 ? props.itemContaId.trim() : null;
    this.custoUnitarioCentavos = props.custoUnitarioCentavos !== undefined ? props.custoUnitarioCentavos : null;
    this.origemCusto = props.origemCusto ?? 'DESCONHECIDO';
    this.quantidadeRecebida = props.quantidadeRecebida ?? 0;
    this.criadoEm = props.criadoEm ?? agora;
    this.atualizadoEm = props.atualizadoEm ?? agora;
  }

  public get subtotalCustoCentavos(): number | null {
    if (this.custoUnitarioCentavos === null) return null;
    return this.quantidade * this.custoUnitarioCentavos;
  }

  public toJSON() {
    return {
      id: this.id,
      operacaoId: this.operacaoId,
      compraId: this.compraId,
      produtoId: this.produtoId,
      destinacao: this.destinacao,
      quantidade: this.quantidade,
      clienteId: this.clienteId,
      clienteNome: this.clienteNome,
      encomendaId: this.encomendaId,
      itemContaId: this.itemContaId,
      custoUnitarioCentavos: this.custoUnitarioCentavos,
      origemCusto: this.origemCusto,
      quantidadeRecebida: this.quantidadeRecebida,
      subtotalCustoCentavos: this.subtotalCustoCentavos,
      criadoEm: this.criadoEm,
      atualizadoEm: this.atualizadoEm
    };
  }
}

export interface CompraMarcaProps {
  id?: string;
  operacaoId: string;
  marcaId: string;
  marcaNome?: string | null;
  numeroPedido?: string | null;
  observacoes?: string | null;
  status?: StatusCompraMarca;
  itens?: ItemCompraMarca[];
  dataPedido?: string;
  criadoEm?: string;
  atualizadoEm?: string;
}

export class CompraMarca {
  public readonly id: string;
  public readonly operacaoId: string;
  public readonly marcaId: string;
  public marcaNome: string | null;
  public numeroPedido: string | null;
  public observacoes: string | null;
  public status: StatusCompraMarca;
  public itens: ItemCompraMarca[];
  public readonly dataPedido: string;
  public readonly criadoEm: string;
  public atualizadoEm: string;

  constructor(props: CompraMarcaProps) {
    if (!props.operacaoId || props.operacaoId.trim().length === 0) {
      throw new DomainError(
        createProblemDetails(400, 'BAD_REQUEST', 'Operação Obrigatória', 'A operacaoId é obrigatória para a compra.')
      );
    }
    if (!props.marcaId || props.marcaId.trim().length === 0) {
      throw new DomainError(
        createProblemDetails(400, 'BAD_REQUEST', 'Marca Obrigatória', 'A marcaId é obrigatória para a compra.')
      );
    }

    const itensIniciais = props.itens ?? [];
    if (itensIniciais.length === 0) {
      throw new DomainError(
        createProblemDetails(400, 'ITENS_OBRIGATORIOS', 'Itens Obrigatórios', 'A compra à marca deve conter ao menos um item.')
      );
    }

    for (const item of itensIniciais) {
      if (item.quantidade <= 0) {
        throw new DomainError(
          createProblemDetails(400, 'QUANTIDADE_INVALIDA', 'Quantidade Inválida', 'A quantidade de cada item deve ser positiva.')
        );
      }
    }

    const agora = new Date().toISOString();
    this.id = props.id ?? gerarUuidV7();
    this.operacaoId = props.operacaoId.trim();
    this.marcaId = props.marcaId.trim();
    this.marcaNome = props.marcaNome ? props.marcaNome.trim() : null;
    this.numeroPedido = props.numeroPedido ? props.numeroPedido.trim() : null;
    this.observacoes = props.observacoes ? props.observacoes.trim() : null;
    this.status = props.status ?? 'PEDIDO_REGISTRADO';
    this.itens = [...itensIniciais];
    this.dataPedido = props.dataPedido ?? agora;
    this.criadoEm = props.criadoEm ?? agora;
    this.atualizadoEm = props.atualizadoEm ?? agora;
  }

  public get quantidadeTotalItens(): number {
    return this.itens.reduce((acc, cur) => acc + cur.quantidade, 0);
  }

  public get quantidadeItensClientes(): number {
    return this.itens
      .filter((i) => i.destinacao === 'CLIENTE')
      .reduce((acc, cur) => acc + cur.quantidade, 0);
  }

  public get quantidadeItensProntaEntrega(): number {
    return this.itens
      .filter((i) => i.destinacao === 'PRONTA_ENTREGA')
      .reduce((acc, cur) => acc + cur.quantidade, 0);
  }

  public get custoTotalEstimadoCentavos(): number | null {
    let total = 0;
    for (const item of this.itens) {
      if (item.custoUnitarioCentavos === null) return null;
      total += item.quantidade * item.custoUnitarioCentavos;
    }
    return total;
  }

  public get custoTotalEstimadoFormatado(): string {
    const total = this.custoTotalEstimadoCentavos;
    if (total === null) return 'A calcular (custos parciais)';
    return Centavos.deInteiro(total).paraFormatado();
  }

  /**
   * Consolida o espelho do pedido agrupando por produto (FR-017, FR-018).
   * Retorna a quantidade total consolidada por produto (para digitação no site da marca)
   * e preserva o vínculo nominal estrito de cada unidade.
   */
  public gerarEspelhoPorProduto(): EspelhoItemProduto[] {
    const mapa = new Map<string, EspelhoItemProduto>();

    for (const item of this.itens) {
      let registro = mapa.get(item.produtoId);
      if (!registro) {
        registro = {
          produtoId: item.produtoId,
          quantidadeTotal: 0,
          quantidadeClientes: 0,
          quantidadeProntaEntrega: 0,
          destinacoes: []
        };
        mapa.set(item.produtoId, registro);
      }

      registro.quantidadeTotal += item.quantidade;
      if (item.destinacao === 'CLIENTE') {
        registro.quantidadeClientes += item.quantidade;
      } else {
        registro.quantidadeProntaEntrega += item.quantidade;
      }

      registro.destinacoes.push({
        tipo: item.destinacao,
        quantidade: item.quantidade,
        clienteId: item.clienteId,
        clienteNome: item.clienteNome,
        encomendaId: item.encomendaId,
        itemContaId: item.itemContaId
      });
    }

    return Array.from(mapa.values());
  }

  public atualizarStatus(novoStatus: StatusCompraMarca): void {
    this.status = novoStatus;
    this.atualizadoEm = new Date().toISOString();
  }

  public toJSON() {
    return {
      id: this.id,
      operacaoId: this.operacaoId,
      marcaId: this.marcaId,
      marcaNome: this.marcaNome,
      numeroPedido: this.numeroPedido,
      observacoes: this.observacoes,
      status: this.status,
      quantidadeTotalItens: this.quantidadeTotalItens,
      quantidadeItensClientes: this.quantidadeItensClientes,
      quantidadeItensProntaEntrega: this.quantidadeItensProntaEntrega,
      custoTotalEstimadoCentavos: this.custoTotalEstimadoCentavos,
      custoTotalEstimadoFormatado: this.custoTotalEstimadoFormatado,
      espelhoPorProduto: this.gerarEspelhoPorProduto(),
      itens: this.itens.map((i) => i.toJSON()),
      dataPedido: this.dataPedido,
      criadoEm: this.criadoEm,
      atualizadoEm: this.atualizadoEm
    };
  }
}
