import { gerarUuidV7 } from '../value-objects/uuid.js';
import { badRequestError } from '../errors/problem-details.js';

export interface MarcaProps {
  id?: string;
  operacaoId: string;
  nome: string;
  percentualPadrao?: number | null;
  criadoEm?: string;
  atualizadoEm?: string;
}

export class Marca {
  public readonly id: string;
  public readonly operacaoId: string;
  public nome: string;
  public percentualPadrao: number | null;
  public readonly criadoEm: string;
  public atualizadoEm: string;

  constructor(props: MarcaProps) {
    if (!props.operacaoId || props.operacaoId.trim().length === 0) {
      throw badRequestError('A operacaoId é obrigatória para vincular a marca.');
    }

    if (!props.nome || props.nome.trim().length === 0) {
      throw badRequestError('O nome da marca é obrigatório.');
    }

    let percentual: number | null = null;
    if (props.percentualPadrao !== undefined && props.percentualPadrao !== null) {
      percentual = Number(props.percentualPadrao);
      if (isNaN(percentual) || percentual < 0 || percentual > 100) {
        throw badRequestError('O percentual padrão da marca deve ser um número entre 0 e 100.');
      }
    }

    const agora = new Date().toISOString();
    this.id = props.id ?? gerarUuidV7();
    this.operacaoId = props.operacaoId.trim();
    this.nome = props.nome.trim();
    this.percentualPadrao = percentual;
    this.criadoEm = props.criadoEm ?? agora;
    this.atualizadoEm = props.atualizadoEm ?? agora;
  }

  public atualizar(dados: {
    nome?: string;
    percentualPadrao?: number | null;
  }): void {
    if (dados.nome !== undefined) {
      if (!dados.nome || dados.nome.trim().length === 0) {
        throw badRequestError('O nome da marca não pode ser vazio.');
      }
      this.nome = dados.nome.trim();
    }

    if (dados.percentualPadrao !== undefined) {
      if (dados.percentualPadrao === null) {
        this.percentualPadrao = null;
      } else {
        const percentual = Number(dados.percentualPadrao);
        if (isNaN(percentual) || percentual < 0 || percentual > 100) {
          throw badRequestError('O percentual padrão da marca deve ser um número entre 0 e 100.');
        }
        this.percentualPadrao = percentual;
      }
    }

    this.atualizadoEm = new Date().toISOString();
  }

  public toJSON() {
    return {
      id: this.id,
      operacaoId: this.operacaoId,
      nome: this.nome,
      percentualPadrao: this.percentualPadrao,
      criadoEm: this.criadoEm,
      atualizadoEm: this.atualizadoEm
    };
  }
}
