import { badRequestError } from '../errors/problem-details.js';

/**
 * Value Object para manipulação estrita de quantias monetárias em centavos inteiros (INTEGER).
 * Impede terminantemente a representação de dinheiro como números de ponto flutuante (float/double).
 */
export class Centavos {
  public readonly valor: number;

  private constructor(valorEmCentavos: number) {
    if (!Number.isInteger(valorEmCentavos)) {
      throw badRequestError(
        `Valor monetário inválido: '${valorEmCentavos}'. Valores devem ser estritamente inteiros em centavos.`
      );
    }
    this.valor = valorEmCentavos;
  }

  public static deInteiro(centavos: number): Centavos {
    return new Centavos(centavos);
  }

  public static zero(): Centavos {
    return new Centavos(0);
  }

  public somar(outro: Centavos): Centavos {
    return new Centavos(this.valor + outro.valor);
  }

  public subtrair(outro: Centavos): Centavos {
    return new Centavos(this.valor - outro.valor);
  }

  public multiplicarPorQuantidade(quantidade: number): Centavos {
    if (!Number.isInteger(quantidade)) {
      throw badRequestError(
        `Quantidade inválida para multiplicação: '${quantidade}'. Quantidades devem ser inteiras.`
      );
    }
    return new Centavos(this.valor * quantidade);
  }

  /**
   * Converte centavos para formatação em reais (R$ 0,00) exclusivamente para exibição.
   */
  public paraFormatado(): string {
    const reais = (this.valor / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return reais;
  }

  public toJSON(): number {
    return this.valor;
  }
}
