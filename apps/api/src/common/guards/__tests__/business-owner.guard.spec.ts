import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { BusinessRepositoryPort } from '@unna/domain';
import { BusinessOwnerGuard } from '../business-owner.guard';
import { fake } from '../../../business/use-cases/__tests__/test-doubles';

const contextFor = (params: Record<string, string> | undefined, sub = 'user-1') =>
  fake<ExecutionContext>({ switchToHttp: () => ({ getRequest: () => ({ params, user: { sub } }) }) });

// S17: the guard reads only the owner of the business, never the whole business.
const guardFor = (ownerId: string | null) => {
  const findOwnerId = jest.fn(async () => ownerId);
  const findById = jest.fn(async () => {
    throw new Error('the guard must not load the whole business');
  });
  return { guard: new BusinessOwnerGuard(fake<BusinessRepositoryPort>({ findOwnerId, findById })), findOwnerId, findById };
};

describe('BusinessOwnerGuard', () => {
  it('lets the owner through, reading only the owner id', async () => {
    const { guard, findOwnerId, findById } = guardFor('user-1');

    await expect(guard.canActivate(contextFor({ businessId: 'biz-A' }))).resolves.toBe(true);
    expect(findOwnerId).toHaveBeenCalledWith('biz-A');
    expect(findById).not.toHaveBeenCalled();
  });

  it('answers 404 "Negocio no encontrado" for an unknown business', async () => {
    const { guard } = guardFor(null);

    const denied = guard.canActivate(contextFor({ businessId: 'nope' }));

    await expect(denied).rejects.toBeInstanceOf(NotFoundException);
    await expect(denied).rejects.toThrow('Negocio no encontrado');
  });

  it('answers 403 "No tenés permisos sobre este negocio" for another owner', async () => {
    const { guard } = guardFor('someone-else');

    const denied = guard.canActivate(contextFor({ businessId: 'biz-A' }));

    await expect(denied).rejects.toBeInstanceOf(ForbiddenException);
    await expect(denied).rejects.toThrow('No tenés permisos sobre este negocio');
  });

  it.each([[{}], [undefined]])('lets the request through without a :businessId param (%p), reading nothing', async (params) => {
    const { guard, findOwnerId } = guardFor(null);

    await expect(guard.canActivate(contextFor(params))).resolves.toBe(true);
    expect(findOwnerId).not.toHaveBeenCalled();
  });
});
