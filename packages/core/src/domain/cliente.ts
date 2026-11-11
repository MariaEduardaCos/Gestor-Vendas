import { gerarUuidV7 } from '../value-objects/uuid.js';
import { badRequestError } from '../errors/problem-details.js';

export function sanitizarTelefone(tel?: string | null): string | null {
  if (!tel) return null;
  const limpo = tel.replace(/\D/g, '');
  return limpo.length > 0 ? limpo : null;
}

export function formatarTelefone(tel?: string | null): string | null {
  if (!tel) return null;
  const digits = tel.replace(/\D/g, '');
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  const trimmed = tel.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export interface ClienteProps {
  id?: string;
  operacaoId: string;
  nome: string;
  telefone?: string | null;
  endereco?: string | null;
  saldoCreditoCentavos?: number;
  criadoEm?: string;
  atualizadoEm?: string;
}

export class Cliente {
  public readonly id: string;
  public readonly operacaoId: string;
  public nome: string;
  public telefone: string | null;
  public endereco: string | null;
  public saldoCreditoCentavos: number;
  public readonly criadoEm: string;
  public atualizadoEm: string;

  constructor(props: ClienteProps) {
    if (!props.operacaoId || props.operacaoId.trim().length === 0) {
      throw badRequestError('A operacaoId é obrigatória para vincular o cliente.');
    }

    if (!props.nome || props.nome.trim().length === 0) {
      throw badRequestError('O nome do cliente é obrigatório.');
    }

    const saldo = props.saldoCreditoCentavos ?? 0;
    if (!Number.isInteger(saldo) || saldo < 0) {
      throw badRequestError('O saldo de crédito deve ser um valor inteiro positivo em centavos.');
    }

    const agora = new Date().toISOString();
    this.id = props.id ?? gerarUuidV7();
    this.operacaoId = props.operacaoId.trim();
    this.nome = props.nome.trim();
    const tel = props.telefone ? props.telefone.trim() : null;
    this.telefone = tel && tel.length > 0 ? tel : null;
    const end = props.endereco ? props.endereco.trim() : null;
    this.endereco = end && end.length > 0 ? end : null;
    this.saldoCreditoCentavos = saldo;
    this.criadoEm = props.criadoEm ?? agora;
    this.atualizadoEm = props.atualizadoEm ?? agora;
  }

  public get telefoneFormatado(): string | null {
    return formatarTelefone(this.telefone);
  }

  public atualizar(dados: {
    nome?: string;
    telefone?: string | null;
    endereco?: string | null;
  }): void {
    if (dados.nome !== undefined) {
      if (!dados.nome || dados.nome.trim().length === 0) {
        throw badRequestError('O nome do cliente não pode ser vazio.');
      }
      this.nome = dados.nome.trim();
    }

    if (dados.telefone !== undefined) {
      const tel = dados.telefone ? dados.telefone.trim() : null;
      this.telefone = tel && tel.length > 0 ? tel : null;
    }

    if (dados.endereco !== undefined) {
      const end = dados.endereco ? dados.endereco.trim() : null;
      this.endereco = end && end.length > 0 ? end : null;
    }

    this.atualizadoEm = new Date().toISOString();
  }

  public adicionarCredito(centavos: number): void {
    if (!Number.isInteger(centavos) || centavos <= 0) {
      throw badRequestError('O valor a creditar deve ser um número inteiro positivo em centavos.');
    }
    this.saldoCreditoCentavos += centavos;
    this.atualizadoEm = new Date().toISOString();
  }

  public debitarCredito(centavos: number): void {
    if (!Number.isInteger(centavos) || centavos <= 0) {
      throw badRequestError('O valor a debitar deve ser um número inteiro positivo em centavos.');
    }
    if (this.saldoCreditoCentavos < centavos) {
      throw badRequestError('Saldo de crédito insuficiente para realizar o débito.');
    }
    this.saldoCreditoCentavos -= centavos;
    this.atualizadoEm = new Date().toISOString();
  }

  public toJSON() {
    return {
      id: this.id,
      operacaoId: this.operacaoId,
      nome: this.nome,
      telefone: this.telefone,
      telefoneFormatado: this.telefoneFormatado,
      endereco: this.endereco,
      saldoCreditoCentavos: this.saldoCreditoCentavos,
      criadoEm: this.criadoEm,
      atualizadoEm: this.atualizadoEm
    };
  }
}
