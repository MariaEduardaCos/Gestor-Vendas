export interface SessaoOperacionalProps {
  operacaoId: string;
  operadorId: string;
  operadorNome: string;
  criadaEm?: string;
}

export class SessaoOperacional {
  public readonly operacaoId: string;
  public readonly operadorId: string;
  public readonly operadorNome: string;
  public readonly criadaEm: string;

  constructor(props: SessaoOperacionalProps) {
    if (!props.operacaoId) {
      throw new Error('Sessão requer operacaoId obrigatório.');
    }
    if (!props.operadorId) {
      throw new Error('Sessão requer operadorId obrigatório.');
    }
    if (!props.operadorNome || props.operadorNome.trim().length === 0) {
      throw new Error('Sessão requer operadorNome obrigatório.');
    }

    this.operacaoId = props.operacaoId;
    this.operadorId = props.operadorId;
    this.operadorNome = props.operadorNome.trim();
    this.criadaEm = props.criadaEm ?? new Date().toISOString();
  }

  public toJSON() {
    return {
      operacaoId: this.operacaoId,
      operadorId: this.operadorId,
      operadorNome: this.operadorNome,
      criadaEm: this.criadaEm
    };
  }
}
