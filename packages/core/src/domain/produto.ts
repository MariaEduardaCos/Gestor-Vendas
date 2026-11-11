import { gerarUuidV7 } from '../value-objects/uuid.js';
import { Centavos } from '../value-objects/centavos.js';
import { badRequestError } from '../errors/problem-details.js';

export type ProvenienciaCusto = 'INFORMADO_MANUAL' | 'ESTIMADO_PERCENTUAL' | 'DESCONHECIDO';

export interface ProdutoProps {
  id?: string;
  operacaoId: string;
  marcaId?: string | null;
  nome: string;
  variante?: string | null;
  codigoBarras?: string | null;
  precoVendaCentavos: number;
  custoCentavos?: number | null;
  provenienciaCusto?: ProvenienciaCusto;
  custoManualCentavos?: number | null;
  percentualDescontoMarca?: number | null;
  criadoEm?: string;
  atualizadoEm?: string;
}

export class Produto {
  public readonly id: string;
  public readonly operacaoId: string;
  public marcaId: string | null;
  public nome: string;
  public variante: string | null;
  public codigoBarras: string | null;
  public precoVendaCentavos: number;
  public custoCentavos: number | null;
  public provenienciaCusto: ProvenienciaCusto;
  public readonly criadoEm: string;
  public atualizadoEm: string;

  constructor(props: ProdutoProps) {
    if (!props.operacaoId || props.operacaoId.trim().length === 0) {
      throw badRequestError('A operacaoId é obrigatória para vincular o produto.');
    }

    if (!props.nome || props.nome.trim().length === 0) {
      throw badRequestError('O nome do produto é obrigatório.');
    }

    if (!Number.isInteger(props.precoVendaCentavos) || props.precoVendaCentavos <= 0) {
      throw badRequestError('O preço de venda deve ser um valor inteiro positivo em centavos (maior que zero).');
    }

    let custoFinal: number | null = null;
    let provenienciaFinal: ProvenienciaCusto = 'DESCONHECIDO';

    if (props.custoManualCentavos !== undefined && props.custoManualCentavos !== null) {
      const { custoCentavos, provenienciaCusto } = Produto.calcularCusto(props.precoVendaCentavos, {
        custoManualCentavos: props.custoManualCentavos
      });
      custoFinal = custoCentavos;
      provenienciaFinal = provenienciaCusto;
    } else if (props.custoCentavos !== undefined && props.provenienciaCusto !== undefined) {
      if (props.custoCentavos !== null) {
        if (!Number.isInteger(props.custoCentavos) || props.custoCentavos < 0) {
          throw badRequestError('O custo em centavos deve ser um número inteiro maior ou igual a zero.');
        }
      }
      custoFinal = props.custoCentavos;
      provenienciaFinal = props.provenienciaCusto;
    } else if (props.percentualDescontoMarca !== undefined && props.percentualDescontoMarca !== null) {
      const { custoCentavos, provenienciaCusto } = Produto.calcularCusto(props.precoVendaCentavos, {
        percentualDescontoMarca: props.percentualDescontoMarca
      });
      custoFinal = custoCentavos;
      provenienciaFinal = provenienciaCusto;
    } else {
      custoFinal = null;
      provenienciaFinal = 'DESCONHECIDO';
    }

    const agora = new Date().toISOString();
    this.id = props.id ?? gerarUuidV7();
    this.operacaoId = props.operacaoId.trim();
    this.marcaId = props.marcaId && props.marcaId.trim().length > 0 ? props.marcaId.trim() : null;
    this.nome = props.nome.trim();
    this.variante = props.variante && props.variante.trim().length > 0 ? props.variante.trim() : null;
    this.codigoBarras = props.codigoBarras && props.codigoBarras.trim().length > 0 ? props.codigoBarras.trim() : null;
    this.precoVendaCentavos = props.precoVendaCentavos;
    this.custoCentavos = custoFinal;
    this.provenienciaCusto = provenienciaFinal;
    this.criadoEm = props.criadoEm ?? agora;
    this.atualizadoEm = props.atualizadoEm ?? agora;
  }

  public static calcularCusto(
    precoVendaCentavos: number,
    opcoes?: {
      custoManualCentavos?: number | null;
      percentualDescontoMarca?: number | null;
    }
  ): { custoCentavos: number | null; provenienciaCusto: ProvenienciaCusto } {
    if (!Number.isInteger(precoVendaCentavos) || precoVendaCentavos <= 0) {
      throw badRequestError('O preço de venda deve ser um número inteiro positivo em centavos.');
    }

    if (opcoes?.custoManualCentavos !== undefined && opcoes.custoManualCentavos !== null) {
      const custoManual = opcoes.custoManualCentavos;
      if (!Number.isInteger(custoManual) || custoManual < 0) {
        throw badRequestError('O custo informado manualmente deve ser um valor inteiro positivo ou zero em centavos.');
      }
      return {
        custoCentavos: custoManual,
        provenienciaCusto: 'INFORMADO_MANUAL'
      };
    }

    if (opcoes?.percentualDescontoMarca !== undefined && opcoes.percentualDescontoMarca !== null) {
      const percentual = Number(opcoes.percentualDescontoMarca);
      if (isNaN(percentual) || percentual < 0 || percentual > 100) {
        throw badRequestError('O percentual de desconto da marca deve ser um número entre 0 e 100.');
      }
      const custoCalculado = Math.round(precoVendaCentavos * (1 - percentual / 100));
      return {
        custoCentavos: custoCalculado,
        provenienciaCusto: 'ESTIMADO_PERCENTUAL'
      };
    }

    return {
      custoCentavos: null,
      provenienciaCusto: 'DESCONHECIDO'
    };
  }

  public get precoVendaFormatado(): string {
    return Centavos.deInteiro(this.precoVendaCentavos).paraFormatado();
  }

  public get custoFormatado(): string {
    if (this.custoCentavos === null) {
      return 'Desconhecido';
    }
    return Centavos.deInteiro(this.custoCentavos).paraFormatado();
  }

  public atualizar(dados: {
    nome?: string;
    marcaId?: string | null;
    variante?: string | null;
    codigoBarras?: string | null;
    precoVendaCentavos?: number;
    custoManualCentavos?: number | null;
    percentualDescontoMarca?: number | null;
    custoCentavos?: number | null;
    provenienciaCusto?: ProvenienciaCusto;
  }): void {
    if (dados.nome !== undefined) {
      if (!dados.nome || dados.nome.trim().length === 0) {
        throw badRequestError('O nome do produto não pode ser vazio.');
      }
      this.nome = dados.nome.trim();
    }

    if (dados.marcaId !== undefined) {
      this.marcaId = dados.marcaId && dados.marcaId.trim().length > 0 ? dados.marcaId.trim() : null;
    }

    if (dados.variante !== undefined) {
      this.variante = dados.variante && dados.variante.trim().length > 0 ? dados.variante.trim() : null;
    }

    if (dados.codigoBarras !== undefined) {
      this.codigoBarras = dados.codigoBarras && dados.codigoBarras.trim().length > 0 ? dados.codigoBarras.trim() : null;
    }

    const precoAnterior = this.precoVendaCentavos;
    let precoAlterado = false;
    if (dados.precoVendaCentavos !== undefined) {
      if (!Number.isInteger(dados.precoVendaCentavos) || dados.precoVendaCentavos <= 0) {
        throw badRequestError('O preço de venda deve ser um valor inteiro positivo em centavos (maior que zero).');
      }
      precoAlterado = dados.precoVendaCentavos !== precoAnterior;
      this.precoVendaCentavos = dados.precoVendaCentavos;
    }

    if (dados.custoCentavos !== undefined && dados.provenienciaCusto !== undefined) {
      if (dados.custoCentavos !== null) {
        if (!Number.isInteger(dados.custoCentavos) || dados.custoCentavos < 0) {
          throw badRequestError('O custo em centavos deve ser um número inteiro maior ou igual a zero.');
        }
      }
      this.custoCentavos = dados.custoCentavos;
      this.provenienciaCusto = dados.provenienciaCusto;
    } else if (dados.custoManualCentavos !== undefined) {
      if (dados.custoManualCentavos !== null) {
        const { custoCentavos, provenienciaCusto } = Produto.calcularCusto(this.precoVendaCentavos, {
          custoManualCentavos: dados.custoManualCentavos
        });
        this.custoCentavos = custoCentavos;
        this.provenienciaCusto = provenienciaCusto;
      } else {
        if (dados.percentualDescontoMarca !== undefined && dados.percentualDescontoMarca !== null) {
          const { custoCentavos, provenienciaCusto } = Produto.calcularCusto(this.precoVendaCentavos, {
            percentualDescontoMarca: dados.percentualDescontoMarca
          });
          this.custoCentavos = custoCentavos;
          this.provenienciaCusto = provenienciaCusto;
        } else {
          this.custoCentavos = null;
          this.provenienciaCusto = 'DESCONHECIDO';
        }
      }
    } else if (dados.percentualDescontoMarca !== undefined) {
      if (this.provenienciaCusto === 'INFORMADO_MANUAL') {
        // Preserva custo manual existente
      } else if (dados.percentualDescontoMarca !== null) {
        const { custoCentavos, provenienciaCusto } = Produto.calcularCusto(this.precoVendaCentavos, {
          percentualDescontoMarca: dados.percentualDescontoMarca
        });
        this.custoCentavos = custoCentavos;
        this.provenienciaCusto = provenienciaCusto;
      } else {
        this.custoCentavos = null;
        this.provenienciaCusto = 'DESCONHECIDO';
      }
    } else if (precoAlterado) {
      if (this.provenienciaCusto === 'INFORMADO_MANUAL') {
        // Preserva custo manual existente
      } else if (this.provenienciaCusto === 'ESTIMADO_PERCENTUAL') {
        if (this.custoCentavos !== null && precoAnterior > 0) {
          const percentual = (1 - this.custoCentavos / precoAnterior) * 100;
          this.custoCentavos = Math.round(this.precoVendaCentavos * (1 - percentual / 100));
          this.provenienciaCusto = 'ESTIMADO_PERCENTUAL';
        }
      } else {
        this.custoCentavos = null;
        this.provenienciaCusto = 'DESCONHECIDO';
      }
    }

    this.atualizadoEm = new Date().toISOString();
  }

  public toJSON() {
    return {
      id: this.id,
      operacaoId: this.operacaoId,
      marcaId: this.marcaId,
      nome: this.nome,
      variante: this.variante,
      codigoBarras: this.codigoBarras,
      precoVendaCentavos: this.precoVendaCentavos,
      precoVendaFormatado: this.precoVendaFormatado,
      custoCentavos: this.custoCentavos,
      custoFormatado: this.custoFormatado,
      provenienciaCusto: this.provenienciaCusto,
      criadoEm: this.criadoEm,
      atualizadoEm: this.atualizadoEm
    };
  }
}
