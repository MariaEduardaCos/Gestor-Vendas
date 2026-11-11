export interface ResultadoProcessamentoScanner {
  aceito: boolean;
  codigo: string;
  motivo?: 'DEBOUNCE' | 'CODIGO_INVALIDO';
}

export interface OpcoesFiltroAntiDuplicacao {
  janelaDebounceMs?: number;
  obterTempo?: () => number;
}

/**
 * FiltroAntiDuplicacao — Serviço de Domínio Puro
 *
 * Governa a aceitação temporal de leituras de códigos de barras (FR-009, UX-DR2).
 * Impede duplicações acidentais ao manter o produto em frente à lente ou passar
 * repetidamente o mesmo código em um intervalo menor que 1,5 segundos (1500ms).
 * A leitura de um código diferente reseta o bloqueio imediatamente.
 */
export class FiltroAntiDuplicacao {
  private readonly janelaDebounceMs: number;
  private readonly obterTempo: () => number;
  private ultimoCodigo: string | null = null;
  private ultimoTimestamp: number = 0;

  constructor(opcoes?: OpcoesFiltroAntiDuplicacao) {
    this.janelaDebounceMs = opcoes?.janelaDebounceMs ?? 1500;
    this.obterTempo = opcoes?.obterTempo ?? (() => Date.now());
  }

  /**
   * Sanitiza o código lido removendo espaços e quebras de linha acidentais.
   */
  public sanitizarCodigo(codigo: string | null | undefined): string {
    if (!codigo) return '';
    return codigo.trim();
  }

  /**
   * Processa uma leitura de código de barras e informa se foi aceita ou bloqueada.
   * Se aceita, registra o timestamp e o código atual.
   */
  public processar(codigoBruto: string | null | undefined, agoraTimestamp?: number): ResultadoProcessamentoScanner {
    const codigo = this.sanitizarCodigo(codigoBruto);

    if (!codigo || codigo.length === 0) {
      return {
        aceito: false,
        codigo: '',
        motivo: 'CODIGO_INVALIDO'
      };
    }

    const agora = agoraTimestamp ?? this.obterTempo();

    // Se for o mesmo código dentro do período de debounce, rejeita sem atualizar o timestamp
    if (this.ultimoCodigo === codigo && agora - this.ultimoTimestamp < this.janelaDebounceMs) {
      return {
        aceito: false,
        codigo,
        motivo: 'DEBOUNCE'
      };
    }

    // Leitura válida: atualiza o último código e timestamp
    this.ultimoCodigo = codigo;
    this.ultimoTimestamp = agora;

    return {
      aceito: true,
      codigo
    };
  }

  /**
   * Consulta pura que verifica se um código seria aceito sem mutar o estado interno (idempotente).
   */
  public podeProcessar(codigoBruto: string | null | undefined, agoraTimestamp?: number): boolean {
    const codigo = this.sanitizarCodigo(codigoBruto);
    if (!codigo || codigo.length === 0) {
      return false;
    }

    const agora = agoraTimestamp ?? this.obterTempo();
    if (this.ultimoCodigo === codigo && agora - this.ultimoTimestamp < this.janelaDebounceMs) {
      return false;
    }

    return true;
  }

  /**
   * Limpa o histórico de leituras.
   */
  public resetar(): void {
    this.ultimoCodigo = null;
    this.ultimoTimestamp = 0;
  }

  public getJanelaMs(): number {
    return this.janelaDebounceMs;
  }

  public getUltimoCodigo(): string | null {
    return this.ultimoCodigo;
  }

  public getUltimoTimestamp(): number {
    return this.ultimoTimestamp;
  }
}
