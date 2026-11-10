import { gerarUuidV7 } from '../value-objects/uuid.js';

export interface OperacaoProps {
  id?: string;
  nome: string;
  criadoEm?: string;
}

export class Operacao {
  public readonly id: string;
  public readonly nome: string;
  public readonly criadoEm: string;

  constructor(props: OperacaoProps) {
    if (!props?.nome || typeof props.nome !== 'string' || props.nome.trim().length === 0) {
      throw new Error('O nome da operação é obrigatório.');
    }

    this.id = props.id ?? gerarUuidV7();
    this.nome = props.nome.trim();
    this.criadoEm = props.criadoEm ?? new Date().toISOString();
  }

  public toJSON() {
    return {
      id: this.id,
      nome: this.nome,
      criadoEm: this.criadoEm
    };
  }
}
