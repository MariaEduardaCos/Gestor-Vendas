import { gerarUuidV7 } from '../value-objects/uuid.js';

export interface OperadorProps {
  id?: string;
  operacaoId: string;
  nome: string;
  pinHash?: string | null;
  ativo?: boolean;
  criadoEm?: string;
}

export class Operador {
  public readonly id: string;
  public readonly operacaoId: string;
  public readonly nome: string;
  public readonly pinHash?: string | null;
  public readonly ativo: boolean;
  public readonly criadoEm: string;

  constructor(props: OperadorProps) {
    if (!props.operacaoId) {
      throw new Error('O operador deve pertencer a uma operacaoId obrigatória.');
    }
    if (!props.nome || props.nome.trim().length === 0) {
      throw new Error('O nome do operador é obrigatório.');
    }

    this.id = props.id ?? gerarUuidV7();
    this.operacaoId = props.operacaoId;
    this.nome = props.nome.trim();
    this.pinHash = props.pinHash ?? null;
    this.ativo = props.ativo ?? true;
    this.criadoEm = props.criadoEm ?? new Date().toISOString();
  }

  public toJSON() {
    return {
      id: this.id,
      operacaoId: this.operacaoId,
      nome: this.nome,
      ativo: this.ativo,
      criadoEm: this.criadoEm
    };
  }
}
