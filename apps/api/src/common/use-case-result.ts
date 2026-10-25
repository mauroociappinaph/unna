import { BadRequestException, ConflictException, HttpException, NotFoundException } from '@nestjs/common';

export interface UseCaseResult<T> {
  ok: boolean;
  value?: T;
  error?: Error;
}

/**
 * Runs a use case and maps its outcome to HTTP: failed results and domain errors become
 * 404 (when the message says something was not found) or 400, never a 500.
 */
export async function unwrap<T>(pending: Promise<UseCaseResult<T>>): Promise<T> {
  let result: UseCaseResult<T>;
  try {
    result = await pending;
  } catch (error) {
    if (error instanceof HttpException) throw error;
    const conflict = toConflict(error);
    if (conflict) throw conflict;
    // Other infrastructure errors (Prisma, network) stay 500 so internals are not exposed.
    if (error?.constructor?.name?.startsWith('PrismaClient')) throw error;
    throw toHttpError((error as Error).message);
  }
  if (!result.ok) throw toHttpError(result.error?.message ?? 'Operación inválida');
  return result.value as T;
}

/** Prisma unique (P2002) and foreign-key (P2003) violations are client conflicts, not server faults. */
export function toConflict(error: unknown): ConflictException | null {
  switch ((error as { code?: string })?.code) {
    case 'P2002':
      return new ConflictException('Ya existe un registro con ese valor único');
    case 'P2003':
      return new ConflictException('El registro está en uso por otros datos y no se puede eliminar');
    default:
      return null;
  }
}

function toHttpError(message: string): HttpException {
  return /no encontrad/i.test(message) ? new NotFoundException(message) : new BadRequestException(message);
}
