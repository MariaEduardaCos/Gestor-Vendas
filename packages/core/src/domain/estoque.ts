import { gerarUuidV7 } from '../value-objects/uuid.js';
import { badRequestError, DomainError, createProblemDetails } from '../errors/problem-details.js';

export interface EstoqueItemProps {
  id?: string;
  operacaoId: string;
  produtoId: string;
  presentes: number;
  reservados?: number;
  prontaEntrega?: number;
  criadoEm?: string;
  atualizadoEm?: string;
}

export class EstoqueItem {
  public readonly id: string;
  public readonly operacaoId: string;
  public readonly produtoId: string;
  public presentes: number;
  public reservados: number;
  public prontaEntrega: number;
  public readonly criadoEm: string;
  public atualizadoEm: string;

  constructor(props: EstoqueItemProps) {
    if (!props.operacaoId || props.operacaoId.trim().length === 0) {
      throw badRequestError('A operacaoId é obrigatória para o item de estoque.');
    }
    if (!props.produtoId || props.produtoId.trim().length === 0) {
      throw badRequestError('O produtoId é obrigatório para o item de estoque.');
    }

    const presentes = props.presentes;
    const reservados = props.reservados ?? 0;
    const prontaEntrega = props.prontaEntrega ?? (presentes - reservados);

    EstoqueItem.validarInvariante(presentes, reservados, prontaEntrega);

    const agora = new Date().toISOString();
    this.id = props.id ?? gerarUuidV7();
    this.operacaoId = props.operacaoId.trim();
    this.produtoId = props.produtoId.trim();
    this.presentes = presentes;
    this.reservados = reservados;
    this.prontaEntrega = prontaEntrega;
    this.criadoEm = props.criadoEm ?? agora;
    this.atualizadoEm = props.atualizadoEm ?? agora;
  }

  public static validarInvariante(presentes: number, reservados: number, prontaEntrega: number): void {
    if (!Number.isInteger(presentes) || presentes < 0) {
      throw badRequestError('A quantidade de itens presentes deve ser um número inteiro não negativo.');
    }
    if (!Number.isInteger(reservados) || reservados < 0) {
      throw badRequestError('A quantidade de itens reservados deve ser um número inteiro não negativo.');
    }
    if (!Number.isInteger(prontaEntrega) || prontaEntrega < 0) {
      throw badRequestError('A quantidade de itens de pronta-entrega deve ser um número inteiro não negativo.');
    }
    if (presentes < reservados) {
      throw badRequestError('A quantidade de itens presentes não pode ser menor que a de reservados.');
    }
    if (presentes !== reservados + prontaEntrega) {
      throw badRequestError(
        'A regra de conservação de estoque foi violada: Presentes deve ser igual a Reservados + ProntaEntrega (AD-3).'
      );
    }
  }

  public lancarEstoqueInicial(quantidade: number): void {
    if (!Number.isInteger(quantidade) || quantidade < 0) {
      throw badRequestError('A quantidade inicial deve ser um número inteiro não negativo.');
    }
    if (this.reservados > 0) {
      throw badRequestError('Não é permitido redefinir contagem inicial com reservas ativas.');
    }
    this.presentes = quantidade;
    this.reservados = 0;
    this.prontaEntrega = quantidade;
    EstoqueItem.validarInvariante(this.presentes, this.reservados, this.prontaEntrega);
    this.atualizadoEm = new Date().toISOString();
  }

  public reservarProntaEntrega(quantidade: number): void {
    if (!Number.isInteger(quantidade) || quantidade <= 0) {
      throw badRequestError('A quantidade a ser reservada deve ser um número inteiro maior que zero.');
    }
    if (this.prontaEntrega < quantidade) {
      throw new DomainError(
        createProblemDetails(
          400,
          'ESTOQUE_INSUFICIENTE_PRONTA_ENTREGA',
          'Estoque Insuficiente',
          `Você tem apenas ${this.prontaEntrega} unidade(s) na pronta-entrega que acabou de ser reservada.`
        )
      );
    }
    this.prontaEntrega -= quantidade;
    this.reservados += quantidade;
    EstoqueItem.validarInvariante(this.presentes, this.reservados, this.prontaEntrega);
    this.atualizadoEm = new Date().toISOString();
  }

  public efetuarSaidaImediata(quantidade: number): void {
    if (!Number.isInteger(quantidade) || quantidade <= 0) {
      throw badRequestError('A quantidade para saída imediata deve ser um número inteiro maior que zero.');
    }
    if (this.prontaEntrega < quantidade) {
      throw new DomainError(
        createProblemDetails(
          400,
          'ESTOQUE_INSUFICIENTE_PRONTA_ENTREGA',
          'Estoque Insuficiente',
          `Você tem apenas ${this.prontaEntrega} unidade(s) na pronta-entrega que acabou de ser reservada.`
        )
      );
    }
    this.prontaEntrega -= quantidade;
    this.presentes -= quantidade;
    EstoqueItem.validarInvariante(this.presentes, this.reservados, this.prontaEntrega);
    this.atualizadoEm = new Date().toISOString();
  }

  public confirmarEntregaFisica(quantidade: number): void {
    if (!Number.isInteger(quantidade) || quantidade <= 0) {
      throw badRequestError('A quantidade entregue deve ser um número inteiro maior que zero.');
    }
    if (this.reservados < quantidade) {
      throw badRequestError(
        `Não há reservas suficientes para confirmar esta entrega. Reservados atuais: ${this.reservados}, solicitados: ${quantidade}.`
      );
    }
    if (this.presentes < quantidade) {
      throw badRequestError(
        `Não há unidades físicas suficientes na estante. Presentes atuais: ${this.presentes}, solicitados: ${quantidade}.`
      );
    }
    this.reservados -= quantidade;
    this.presentes -= quantidade;
    EstoqueItem.validarInvariante(this.presentes, this.reservados, this.prontaEntrega);
    this.atualizadoEm = new Date().toISOString();
  }

  public cancelarReserva(quantidade: number): void {
    if (!Number.isInteger(quantidade) || quantidade <= 0) {
      throw badRequestError('A quantidade a cancelar da reserva deve ser um número inteiro maior que zero.');
    }
    if (this.reservados < quantidade) {
      throw badRequestError(
        `Quantidade a cancelar (${quantidade}) excede as reservas existentes (${this.reservados}).`
      );
    }
    this.reservados -= quantidade;
    this.prontaEntrega += quantidade;
    EstoqueItem.validarInvariante(this.presentes, this.reservados, this.prontaEntrega);
    this.atualizadoEm = new Date().toISOString();
  }

  public ajustarContagemFisica(novaContagem: number, justificativa: string): void {
    if (!Number.isInteger(novaContagem) || novaContagem < 0) {
      throw badRequestError('A nova contagem física deve ser um número inteiro não negativo.');
    }
    if (!justificativa || justificativa.trim().length === 0) {
      throw badRequestError('A justificativa do ajuste de inventário é obrigatória.');
    }
    if (novaContagem < this.reservados) {
      throw new DomainError(
        createProblemDetails(
          400,
          'AJUSTE_ABAIXO_DE_RESERVAS',
          'Ajuste Bloqueado por Reservas Ativas',
          `Não é permitido reduzir a contagem física para ${novaContagem} unidade(s) pois existem ${this.reservados} unidade(s) reservadas ativas para clientes. Resolva ou desvincule as reservas antes de ajustar.`
        )
      );
    }
    this.presentes = novaContagem;
    this.prontaEntrega = this.presentes - this.reservados;
    EstoqueItem.validarInvariante(this.presentes, this.reservados, this.prontaEntrega);
    this.atualizadoEm = new Date().toISOString();
  }

  public static criarInicial(props: {
    id?: string;
    operacaoId: string;
    produtoId: string;
    quantidade: number;
  }): EstoqueItem {
    if (!Number.isInteger(props.quantidade) || props.quantidade < 0) {
      throw badRequestError('A quantidade inicial de estoque deve ser um número inteiro não negativo.');
    }
    return new EstoqueItem({
      id: props.id,
      operacaoId: props.operacaoId,
      produtoId: props.produtoId,
      presentes: props.quantidade,
      reservados: 0,
      prontaEntrega: props.quantidade
    });
  }

  public toJSON() {
    return {
      id: this.id,
      operacaoId: this.operacaoId,
      produtoId: this.produtoId,
      presentes: this.presentes,
      reservados: this.reservados,
      prontaEntrega: this.prontaEntrega,
      criadoEm: this.criadoEm,
      atualizadoEm: this.atualizadoEm
    };
  }
}

export type TipoMovimentacaoEstoque =
  | 'ESTOQUE_INICIAL'
  | 'ENTRADA_CONFERENCIA'
  | 'RESERVA'
  | 'CANCELAMENTO_RESERVA'
  | 'SAIDA_VENDA'
  | 'AJUSTE_BALANCO';

export interface MovimentacaoEstoqueProps {
  id?: string;
  operacaoId: string;
  produtoId: string;
  estoqueItemId: string;
  tipo: TipoMovimentacaoEstoque;
  quantidade: number;
  presentesAnterior: number;
  presentesPosterior: number;
  reservadosAnterior: number;
  reservadosPosterior: number;
  prontaEntregaAnterior: number;
  prontaEntregaPosterior: number;
  compraId?: string | null;
  operadorId: string;
  operadorNome: string;
  detalhes?: string | null;
  criadoEm?: string;
}

export class MovimentacaoEstoque {
  public readonly id: string;
  public readonly operacaoId: string;
  public readonly produtoId: string;
  public readonly estoqueItemId: string;
  public readonly tipo: TipoMovimentacaoEstoque;
  public readonly quantidade: number;
  public readonly presentesAnterior: number;
  public readonly presentesPosterior: number;
  public readonly reservadosAnterior: number;
  public readonly reservadosPosterior: number;
  public readonly prontaEntregaAnterior: number;
  public readonly prontaEntregaPosterior: number;
  public readonly compraId: string | null;
  public readonly operadorId: string;
  public readonly operadorNome: string;
  public readonly detalhes: string | null;
  public readonly criadoEm: string;

  constructor(props: MovimentacaoEstoqueProps) {
    if (!props.operacaoId || props.operacaoId.trim().length === 0) {
      throw badRequestError('A operacaoId é obrigatória para a movimentação.');
    }
    if (!props.produtoId || props.produtoId.trim().length === 0) {
      throw badRequestError('O produtoId é obrigatório para a movimentação.');
    }
    if (!props.estoqueItemId || props.estoqueItemId.trim().length === 0) {
      throw badRequestError('O estoqueItemId é obrigatório para a movimentação.');
    }
    if (!props.tipo) {
      throw badRequestError('O tipo da movimentação é obrigatório.');
    }
    if (!Number.isInteger(props.quantidade) || props.quantidade < 0) {
      throw badRequestError('A quantidade da movimentação deve ser um número inteiro não negativo.');
    }
    if (!props.operadorId || !props.operadorNome) {
      throw badRequestError('A movimentação requer operador nominal (operadorId e operadorNome).');
    }

    if (props.tipo === 'ESTOQUE_INICIAL' && props.compraId !== null && props.compraId !== undefined) {
      throw badRequestError('Lançamento de estoque inicial não pode possuir vínculo com compra da marca (FR-013).');
    }

    this.id = props.id ?? gerarUuidV7();
    this.operacaoId = props.operacaoId.trim();
    this.produtoId = props.produtoId.trim();
    this.estoqueItemId = props.estoqueItemId.trim();
    this.tipo = props.tipo;
    this.quantidade = props.quantidade;
    this.presentesAnterior = props.presentesAnterior;
    this.presentesPosterior = props.presentesPosterior;
    this.reservadosAnterior = props.reservadosAnterior;
    this.reservadosPosterior = props.reservadosPosterior;
    this.prontaEntregaAnterior = props.prontaEntregaAnterior;
    this.prontaEntregaPosterior = props.prontaEntregaPosterior;
    this.compraId = props.compraId ?? null;
    this.operadorId = props.operadorId.trim();
    this.operadorNome = props.operadorNome.trim();
    this.detalhes = props.detalhes ?? null;
    this.criadoEm = props.criadoEm ?? new Date().toISOString();
  }

  public toJSON() {
    return {
      id: this.id,
      operacaoId: this.operacaoId,
      produtoId: this.produtoId,
      estoqueItemId: this.estoqueItemId,
      tipo: this.tipo,
      quantidade: this.quantidade,
      presentesAnterior: this.presentesAnterior,
      presentesPosterior: this.presentesPosterior,
      reservadosAnterior: this.reservadosAnterior,
      reservadosPosterior: this.reservadosPosterior,
      prontaEntregaAnterior: this.prontaEntregaAnterior,
      prontaEntregaPosterior: this.prontaEntregaPosterior,
      compraId: this.compraId,
      operadorId: this.operadorId,
      operadorNome: this.operadorNome,
      detalhes: this.detalhes,
      criadoEm: this.criadoEm
    };
  }
}
