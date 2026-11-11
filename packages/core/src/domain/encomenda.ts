import { gerarUuidV7 } from '../value-objects/uuid.js';
import { Centavos } from '../value-objects/centavos.js';
import { DomainError, createProblemDetails } from '../errors/problem-details.js';

export type StatusEntregaItem = 'AGUARDANDO_FABRICA' | 'RESERVADO_PRESENTE' | 'ENTREGUE' | 'CANCELADO';
export type StatusConta = 'ABERTA' | 'PARCIALMENTE_PAGA' | 'QUITADA' | 'CANCELADA';
export type StatusEncomenda = 'AGUARDANDO_FABRICA' | 'PARCIALMENTE_RECEBIDO' | 'RECEBIDO' | 'CANCELADO';
export type OrigemCustoItem = 'INFORMADO_MANUAL' | 'ESTIMADO_PERCENTUAL' | 'DESCONHECIDO';

export interface ItemContaProps {
  id?: string;
  operacaoId: string;
  contaId: string;
  encomendaId?: string | null;
  produtoId: string;
  quantidade: number;
  precoUnitarioCentavos: number;
  custoUnitarioCentavos?: number | null;
  origemCusto?: OrigemCustoItem;
  statusEntrega?: StatusEntregaItem;
  criadoEm?: string;
  atualizadoEm?: string;
}

export class ItemConta {
  public readonly id: string;
  public readonly operacaoId: string;
  public readonly contaId: string;
  public encomendaId: string | null;
  public readonly produtoId: string;
  public quantidade: number;
  public readonly precoUnitarioCentavos: number;
  public readonly custoUnitarioCentavos: number | null;
  public readonly origemCusto: OrigemCustoItem;
  public statusEntrega: StatusEntregaItem;
  public readonly criadoEm: string;
  public atualizadoEm: string;

  constructor(props: ItemContaProps) {
    if (!props.operacaoId || props.operacaoId.trim().length === 0) {
      throw new DomainError(
        createProblemDetails(400, 'BAD_REQUEST', 'Operação Obrigatória', 'A operacaoId é obrigatória para o item da conta.')
      );
    }
    if (!props.contaId || props.contaId.trim().length === 0) {
      throw new DomainError(
        createProblemDetails(400, 'BAD_REQUEST', 'Conta Obrigatória', 'A contaId é obrigatória para o item da conta.')
      );
    }
    if (!props.produtoId || props.produtoId.trim().length === 0) {
      throw new DomainError(
        createProblemDetails(400, 'BAD_REQUEST', 'Produto Obrigatório', 'O produtoId é obrigatório para o item da conta.')
      );
    }

    if (!Number.isInteger(props.quantidade) || props.quantidade <= 0) {
      throw new DomainError(
        createProblemDetails(
          400,
          'QUANTIDADE_INVALIDA',
          'Quantidade Inválida',
          'A quantidade encomendada deve ser um número inteiro maior que zero.'
        )
      );
    }

    if (!Number.isInteger(props.precoUnitarioCentavos) || props.precoUnitarioCentavos <= 0) {
      throw new DomainError(
        createProblemDetails(
          400,
          'BAD_REQUEST',
          'Preço Unitário Inválido',
          'O preço unitário em centavos deve ser um número inteiro maior que zero.'
        )
      );
    }

    let custoFinal: number | null = null;
    let origemFinal: OrigemCustoItem = 'DESCONHECIDO';

    if (props.custoUnitarioCentavos !== undefined && props.custoUnitarioCentavos !== null) {
      if (!Number.isInteger(props.custoUnitarioCentavos) || props.custoUnitarioCentavos < 0) {
        throw new DomainError(
          createProblemDetails(
            400,
            'BAD_REQUEST',
            'Custo Unitário Inválido',
            'O custo unitário em centavos deve ser um número inteiro maior ou igual a zero.'
          )
        );
      }
      custoFinal = props.custoUnitarioCentavos;
      origemFinal = props.origemCusto ?? 'INFORMADO_MANUAL';
    } else {
      custoFinal = null;
      origemFinal = 'DESCONHECIDO';
    }

    const agora = new Date().toISOString();
    this.id = props.id ?? gerarUuidV7();
    this.operacaoId = props.operacaoId.trim();
    this.contaId = props.contaId.trim();
    this.encomendaId = props.encomendaId && props.encomendaId.trim().length > 0 ? props.encomendaId.trim() : null;
    this.produtoId = props.produtoId.trim();
    this.quantidade = props.quantidade;
    this.precoUnitarioCentavos = props.precoUnitarioCentavos;
    this.custoUnitarioCentavos = custoFinal;
    this.origemCusto = origemFinal;
    this.statusEntrega = props.statusEntrega ?? 'AGUARDANDO_FABRICA';
    this.criadoEm = props.criadoEm ?? agora;
    this.atualizadoEm = props.atualizadoEm ?? agora;
  }

  public get subtotalCentavos(): number {
    return this.quantidade * this.precoUnitarioCentavos;
  }

  public get subtotalCustoCentavos(): number | null {
    if (this.custoUnitarioCentavos === null) return null;
    return this.quantidade * this.custoUnitarioCentavos;
  }

  public get precoUnitarioFormatado(): string {
    return Centavos.deInteiro(this.precoUnitarioCentavos).paraFormatado();
  }

  public get subtotalFormatado(): string {
    return Centavos.deInteiro(this.subtotalCentavos).paraFormatado();
  }

  public get custoUnitarioFormatado(): string {
    if (this.custoUnitarioCentavos === null) return 'Desconhecido';
    return Centavos.deInteiro(this.custoUnitarioCentavos).paraFormatado();
  }

  public atualizarStatusEntrega(novoStatus: StatusEntregaItem): void {
    this.statusEntrega = novoStatus;
    this.atualizadoEm = new Date().toISOString();
  }

  public toJSON() {
    return {
      id: this.id,
      operacaoId: this.operacaoId,
      contaId: this.contaId,
      encomendaId: this.encomendaId,
      produtoId: this.produtoId,
      quantidade: this.quantidade,
      precoUnitarioCentavos: this.precoUnitarioCentavos,
      precoUnitarioFormatado: this.precoUnitarioFormatado,
      custoUnitarioCentavos: this.custoUnitarioCentavos,
      custoUnitarioFormatado: this.custoUnitarioFormatado,
      origemCusto: this.origemCusto,
      statusEntrega: this.statusEntrega,
      subtotalCentavos: this.subtotalCentavos,
      subtotalFormatado: this.subtotalFormatado,
      subtotalCustoCentavos: this.subtotalCustoCentavos,
      criadoEm: this.criadoEm,
      atualizadoEm: this.atualizadoEm
    };
  }
}

export interface ContaClienteProps {
  id?: string;
  operacaoId: string;
  clienteId: string;
  encomendaId?: string | null;
  valorTotalCentavos?: number;
  totalPagoCentavos?: number;
  status?: StatusConta;
  itens?: ItemConta[];
  criadoEm?: string;
  atualizadoEm?: string;
}

export class ContaCliente {
  public readonly id: string;
  public readonly operacaoId: string;
  public readonly clienteId: string;
  public encomendaId: string | null;
  public valorTotalCentavos: number;
  public totalPagoCentavos: number;
  public status: StatusConta;
  public itens: ItemConta[];
  public readonly criadoEm: string;
  public atualizadoEm: string;

  constructor(props: ContaClienteProps) {
    if (!props.operacaoId || props.operacaoId.trim().length === 0) {
      throw new DomainError(
        createProblemDetails(400, 'BAD_REQUEST', 'Operação Obrigatória', 'A operacaoId é obrigatória para a conta.')
      );
    }
    if (!props.clienteId || props.clienteId.trim().length === 0) {
      throw new DomainError(
        createProblemDetails(400, 'BAD_REQUEST', 'Cliente Obrigatório', 'A clienteId é obrigatória para a conta.')
      );
    }

    const totalPago = props.totalPagoCentavos ?? 0;
    if (!Number.isInteger(totalPago) || totalPago < 0) {
      throw new DomainError(
        createProblemDetails(400, 'BAD_REQUEST', 'Valor Inválido', 'O total pago deve ser um número inteiro maior ou igual a zero em centavos.')
      );
    }

    const itensIniciais = props.itens ?? [];
    const somaItens = itensIniciais
      .filter((i) => i.statusEntrega !== 'CANCELADO')
      .reduce((acc, cur) => acc + cur.subtotalCentavos, 0);

    const valorTotal = props.valorTotalCentavos !== undefined ? props.valorTotalCentavos : somaItens;
    if (!Number.isInteger(valorTotal) || valorTotal < 0) {
      throw new DomainError(
        createProblemDetails(400, 'BAD_REQUEST', 'Valor Inválido', 'O valor total deve ser um número inteiro maior ou igual a zero em centavos.')
      );
    }

    const agora = new Date().toISOString();
    this.id = props.id ?? gerarUuidV7();
    this.operacaoId = props.operacaoId.trim();
    this.clienteId = props.clienteId.trim();
    this.encomendaId = props.encomendaId && props.encomendaId.trim().length > 0 ? props.encomendaId.trim() : null;
    this.valorTotalCentavos = valorTotal;
    this.totalPagoCentavos = totalPago;
    this.status = props.status ?? (totalPago >= valorTotal && valorTotal > 0 ? 'QUITADA' : totalPago > 0 ? 'PARCIALMENTE_PAGA' : 'ABERTA');
    this.itens = [...itensIniciais];
    this.criadoEm = props.criadoEm ?? agora;
    this.atualizadoEm = props.atualizadoEm ?? agora;
  }

  public adicionarItem(item: ItemConta): void {
    this.itens.push(item);
    this.recalcularTotal();
  }

  public recalcularTotal(): void {
    this.valorTotalCentavos = this.itens
      .filter((i) => i.statusEntrega !== 'CANCELADO')
      .reduce((acc, cur) => acc + cur.subtotalCentavos, 0);
    this.atualizarStatus();
    this.atualizadoEm = new Date().toISOString();
  }

  public calcularTotalSemAguardadosCentavos(): number {
    return this.itens
      .filter((i) => i.statusEntrega !== 'AGUARDANDO_FABRICA' && i.statusEntrega !== 'CANCELADO')
      .reduce((acc, cur) => acc + cur.subtotalCentavos, 0);
  }

  public calcularSaldoTotalDevidoCentavos(): number {
    return Math.max(0, this.valorTotalCentavos - this.totalPagoCentavos);
  }

  public calcularSaldoCobravelHojeCentavos(): number {
    const totalSemAguardados = this.calcularTotalSemAguardadosCentavos();
    return Math.max(0, totalSemAguardados - this.totalPagoCentavos);
  }

  public registrarPagamento(valorCentavos: number): void {
    if (!Number.isInteger(valorCentavos) || valorCentavos <= 0) {
      throw new DomainError(
        createProblemDetails(400, 'BAD_REQUEST', 'Valor de Pagamento Inválido', 'O pagamento deve ser um valor inteiro positivo em centavos.')
      );
    }
    this.totalPagoCentavos += valorCentavos;
    this.atualizarStatus();
    this.atualizadoEm = new Date().toISOString();
  }

  private atualizarStatus(): void {
    if (this.valorTotalCentavos === 0) {
      this.status = 'ABERTA';
    } else if (this.totalPagoCentavos >= this.valorTotalCentavos) {
      this.status = 'QUITADA';
    } else if (this.totalPagoCentavos > 0) {
      this.status = 'PARCIALMENTE_PAGA';
    } else {
      this.status = 'ABERTA';
    }
  }

  public get valorTotalFormatado(): string {
    return Centavos.deInteiro(this.valorTotalCentavos).paraFormatado();
  }

  public get totalPagoFormatado(): string {
    return Centavos.deInteiro(this.totalPagoCentavos).paraFormatado();
  }

  public get saldoTotalDevidoFormatado(): string {
    return Centavos.deInteiro(this.calcularSaldoTotalDevidoCentavos()).paraFormatado();
  }

  public get saldoCobravelHojeFormatado(): string {
    return Centavos.deInteiro(this.calcularSaldoCobravelHojeCentavos()).paraFormatado();
  }

  public get totalSemAguardadosFormatado(): string {
    return Centavos.deInteiro(this.calcularTotalSemAguardadosCentavos()).paraFormatado();
  }

  public toJSON() {
    return {
      id: this.id,
      operacaoId: this.operacaoId,
      clienteId: this.clienteId,
      encomendaId: this.encomendaId,
      valorTotalCentavos: this.valorTotalCentavos,
      valorTotalFormatado: this.valorTotalFormatado,
      totalPagoCentavos: this.totalPagoCentavos,
      totalPagoFormatado: this.totalPagoFormatado,
      saldoTotalDevidoCentavos: this.calcularSaldoTotalDevidoCentavos(),
      saldoTotalDevidoFormatado: this.saldoTotalDevidoFormatado,
      saldoCobravelHojeCentavos: this.calcularSaldoCobravelHojeCentavos(),
      saldoCobravelHojeFormatado: this.saldoCobravelHojeFormatado,
      totalSemAguardadosCentavos: this.calcularTotalSemAguardadosCentavos(),
      totalSemAguardadosFormatado: this.totalSemAguardadosFormatado,
      status: this.status,
      itens: this.itens.map((i) => i.toJSON()),
      criadoEm: this.criadoEm,
      atualizadoEm: this.atualizadoEm
    };
  }
}

export interface EncomendaProps {
  id?: string;
  operacaoId: string;
  clienteId: string;
  contaId?: string | null;
  descricao?: string | null;
  status?: StatusEncomenda;
  itens?: ItemConta[];
  criadoEm?: string;
  atualizadoEm?: string;
}

export class Encomenda {
  public readonly id: string;
  public readonly operacaoId: string;
  public readonly clienteId: string;
  public contaId: string | null;
  public descricao: string | null;
  public status: StatusEncomenda;
  public itens: ItemConta[];
  public readonly criadoEm: string;
  public atualizadoEm: string;

  constructor(props: EncomendaProps) {
    if (!props.operacaoId || props.operacaoId.trim().length === 0) {
      throw new DomainError(
        createProblemDetails(400, 'BAD_REQUEST', 'Operação Obrigatória', 'A operacaoId é obrigatória para a encomenda.')
      );
    }
    if (!props.clienteId || props.clienteId.trim().length === 0) {
      throw new DomainError(
        createProblemDetails(400, 'BAD_REQUEST', 'Cliente Obrigatório', 'A clienteId é obrigatória para a encomenda.')
      );
    }

    const itensIniciais = props.itens ?? [];
    if (itensIniciais.length === 0) {
      throw new DomainError(
        createProblemDetails(400, 'ITENS_OBRIGATORIOS', 'Itens Obrigatórios', 'A encomenda deve conter ao menos um item.')
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
    this.clienteId = props.clienteId.trim();
    this.contaId = props.contaId && props.contaId.trim().length > 0 ? props.contaId.trim() : null;
    this.descricao = props.descricao ? props.descricao.trim() : null;
    this.status = props.status ?? 'AGUARDANDO_FABRICA';
    this.itens = [...itensIniciais];
    this.criadoEm = props.criadoEm ?? agora;
    this.atualizadoEm = props.atualizadoEm ?? agora;
  }

  public get quantidadeTotalItens(): number {
    return this.itens
      .filter((i) => i.statusEntrega !== 'CANCELADO')
      .reduce((acc, cur) => acc + cur.quantidade, 0);
  }

  public get valorTotalCentavos(): number {
    return this.itens
      .filter((i) => i.statusEntrega !== 'CANCELADO')
      .reduce((acc, cur) => acc + cur.subtotalCentavos, 0);
  }

  public get valorTotalFormatado(): string {
    return Centavos.deInteiro(this.valorTotalCentavos).paraFormatado();
  }

  public atualizarStatus(novoStatus: StatusEncomenda): void {
    this.status = novoStatus;
    this.atualizadoEm = new Date().toISOString();
  }

  public toJSON() {
    return {
      id: this.id,
      operacaoId: this.operacaoId,
      clienteId: this.clienteId,
      contaId: this.contaId,
      descricao: this.descricao,
      status: this.status,
      quantidadeTotalItens: this.quantidadeTotalItens,
      valorTotalCentavos: this.valorTotalCentavos,
      valorTotalFormatado: this.valorTotalFormatado,
      itens: this.itens.map((i) => i.toJSON()),
      criadoEm: this.criadoEm,
      atualizadoEm: this.atualizadoEm
    };
  }
}
