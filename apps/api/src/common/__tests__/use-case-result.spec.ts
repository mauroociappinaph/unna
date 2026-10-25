import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { NotFoundError } from '@unna/domain';
import { unwrap } from '../use-case-result';

describe('unwrap', () => {
  it('maps a failed result with a NotFoundError to 404 with the same message', async () => {
    const pending = unwrap(Promise.resolve({ ok: false, error: new NotFoundError('Pantalla no encontrada') }));

    await expect(pending).rejects.toBeInstanceOf(NotFoundException);
    await expect(pending).rejects.toThrow('Pantalla no encontrada');
  });

  it('maps a thrown NotFoundError to 404 with the same message', async () => {
    const pending = unwrap(Promise.reject(new NotFoundError('Pedido no encontrado')));

    await expect(pending).rejects.toBeInstanceOf(NotFoundException);
    await expect(pending).rejects.toThrow('Pedido no encontrado');
  });

  it('maps a failed result with a plain Error to 400 with the same message', async () => {
    const pending = unwrap(Promise.resolve({ ok: false, error: new Error('Operación inválida') }));

    await expect(pending).rejects.toBeInstanceOf(BadRequestException);
    await expect(pending).rejects.toThrow('Operación inválida');
  });

  it('decides by type, not text: a plain Error saying "no encontrado" is 400', async () => {
    const pending = unwrap(Promise.resolve({ ok: false, error: new Error('Producto no encontrado') }));

    await expect(pending).rejects.toBeInstanceOf(BadRequestException);
    await expect(pending).rejects.toThrow('Producto no encontrado');
  });

  it('decides by type, not text: a thrown plain Error saying "no encontrado" is 400', async () => {
    const pending = unwrap(Promise.reject(new Error('Caja no encontrada')));

    await expect(pending).rejects.toBeInstanceOf(BadRequestException);
    await expect(pending).rejects.toThrow('Caja no encontrada');
  });

  it('passes HttpExceptions through unchanged', async () => {
    const forbidden = new ForbiddenException('No tenés acceso');

    await expect(unwrap(Promise.reject(forbidden))).rejects.toBe(forbidden);
  });

  it('maps a Prisma unique violation to 409', async () => {
    const pending = unwrap(Promise.reject(Object.assign(new Error('Unique constraint'), { code: 'P2002' })));

    await expect(pending).rejects.toBeInstanceOf(ConflictException);
    await expect(pending).rejects.toThrow('Ya existe un registro con ese valor único');
  });

  it('rethrows other Prisma errors so they stay 500', async () => {
    class PrismaClientUnknownRequestError extends Error {}
    const prismaError = new PrismaClientUnknownRequestError('connection lost');

    await expect(unwrap(Promise.reject(prismaError))).rejects.toBe(prismaError);
  });
});
