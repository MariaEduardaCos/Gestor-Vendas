/**
 * Representação padronizada de erro conforme RFC 7807 (Problem Details for HTTP APIs).
 * https://datatracker.ietf.org/doc/html/rfc7807
 */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  code: string;
  instance?: string;
  invalidParams?: Array<{ name: string; reason: string }>;
}

export class DomainError extends Error {
  public readonly problem: ProblemDetails;

  constructor(problem: ProblemDetails) {
    super(problem.detail);
    this.name = 'DomainError';
    this.problem = problem;
  }
}

export function createProblemDetails(
  status: number,
  code: string,
  title: string,
  detail: string,
  options?: { instance?: string; invalidParams?: Array<{ name: string; reason: string }> }
): ProblemDetails {
  return {
    type: `https://consultorasync.app/errors/${code.toLowerCase()}`,
    title,
    status,
    detail,
    code,
    ...(options?.instance ? { instance: options.instance } : {}),
    ...(options?.invalidParams ? { invalidParams: options.invalidParams } : {})
  };
}

export function unauthorizedError(detail = 'Sessão operacional ausente ou inválida.'): DomainError {
  return new DomainError(
    createProblemDetails(401, 'UNAUTHORIZED', 'Não Autorizado', detail)
  );
}

export function forbiddenError(detail = 'Acesso não permitido aos recursos desta operação.'): DomainError {
  return new DomainError(
    createProblemDetails(403, 'FORBIDDEN', 'Acesso Proibido', detail)
  );
}

export function notFoundError(detail = 'Recurso não encontrado nesta operação.'): DomainError {
  return new DomainError(
    createProblemDetails(404, 'NOT_FOUND', 'Não Encontrado', detail)
  );
}

export function badRequestError(detail: string, invalidParams?: Array<{ name: string; reason: string }>): DomainError {
  return new DomainError(
    createProblemDetails(400, 'BAD_REQUEST', 'Requisição Inválida', detail, { invalidParams })
  );
}
