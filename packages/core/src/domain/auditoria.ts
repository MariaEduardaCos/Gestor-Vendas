import { gerarUuidV7 } from '../value-objects/uuid.js';
import type { SessaoOperacional } from './sessao.js';

export interface RegistroAuditoriaProps {
  id?: string;
  operacaoId: string;
  operadorId: string;
  operadorNome: string;
  acao: string;
  detalhes?: string | null;
  criadoEm?: string;
}

export class RegistroAuditoria {
  public readonly id: string;
  public readonly operacaoId: string;
  public readonly operadorId: string;
  public readonly operadorNome: string;
  public readonly acao: string;
  public readonly detalhes: string | null;
  public readonly criadoEm: string;

  constructor(props: RegistroAuditoriaProps) {
    if (!props.operacaoId) {
      throw new Error('Registro de auditoria requer operacaoId.');
    }
    if (!props.operadorId || !props.operadorNome) {
      throw new Error('Registro de auditoria requer operador nominal (operadorId e operadorNome).');
    }
    if (!props.acao) {
      throw new Error('Registro de auditoria requer descrição da ação.');
    }

    this.id = props.id ?? gerarUuidV7();
    this.operacaoId = props.operacaoId;
    this.operadorId = props.operadorId;
    this.operadorNome = props.operadorNome;
    this.acao = props.acao;
    this.detalhes = props.detalhes ?? null;
    this.criadoEm = props.criadoEm ?? new Date().toISOString();
  }

  public static criarDeSessao(
    sessao: SessaoOperacional,
    acao: string,
    detalhes?: string | null
  ): RegistroAuditoria {
    return new RegistroAuditoria({
      operacaoId: sessao.operacaoId,
      operadorId: sessao.operadorId,
      operadorNome: sessao.operadorNome,
      acao,
      detalhes,
      criadoEm: new Date().toISOString()
    });
  }

  public toJSON() {
    return {
      id: this.id,
      operacaoId: this.operacaoId,
      operadorId: this.operadorId,
      operadorNome: this.operadorNome,
      acao: this.acao,
      detalhes: this.detalhes,
      criadoEm: this.criadoEm
    };
  }
}
