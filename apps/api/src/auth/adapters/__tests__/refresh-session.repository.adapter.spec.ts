import { RefreshSessionRecord } from '@unna/domain';
import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaRefreshSessionRepository } from '../refresh-session.repository.adapter';

const at = new Date('2026-10-27T12:00:00Z');
const record = (id: string, familyId: string): RefreshSessionRecord => ({
  id, userId: 'user-1', familyId, createdAt: at, expiresAt: new Date('2026-11-26T12:00:00Z'), usedAt: null, revokedAt: null, replacedById: null,
});
const head = record('fam-1', 'fam-1');
const current = record('jti-2', 'fam-1');

/** Records, in order, the calls made inside the interactive transaction. */
const fakePrisma = (stored: RefreshSessionRecord[]) => {
  const calls: string[] = [];
  const tx = {
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      calls.push(strings.reduce((text, part, i) => text + part + (i < values.length ? `<${String(values[i])}>` : ''), ''));
      return [];
    },
    refreshSession: {
      findMany: async (args: unknown) => { calls.push(`read ${JSON.stringify(args)}`); return stored; },
      update: async (args: unknown) => { calls.push(`update ${JSON.stringify(args)}`); },
      create: async (args: { data: RefreshSessionRecord }) => { calls.push(`create ${args.data.id}`); },
      updateMany: async (args: unknown) => { calls.push(`updateMany ${JSON.stringify(args)}`); },
    },
  };
  const prisma = { $transaction: async (work: (client: typeof tx) => Promise<unknown>) => work(tx), refreshSession: tx.refreshSession };
  return { repository: new PrismaRefreshSessionRepository(prisma as unknown as PrismaService), calls };
};

describe('PrismaRefreshSessionRepository', () => {
  it('locks the family head, then the presented session, reads both and writes the rotation in the same transaction', async () => {
    const { repository, calls } = fakePrisma([head, current]);

    const seen = await repository.withFamilyLock('fam-1', 'jti-2', async (family, writes) => {
      await writes.markUsed('jti-2', 'jti-3', at);
      await writes.create(record('jti-3', 'fam-1'));
      return [family.head?.id, family.session?.id];
    });

    expect(seen).toEqual(['fam-1', 'jti-2']);
    expect(calls).toEqual([
      'SELECT id FROM refresh_sessions WHERE id = <fam-1> FOR UPDATE',
      'SELECT id FROM refresh_sessions WHERE id = <jti-2> FOR UPDATE',
      'read {"where":{"id":{"in":["fam-1","jti-2"]},"familyId":"fam-1"}}',
      `update {"where":{"id":"jti-2"},"data":{"usedAt":"${at.toISOString()}","replacedById":"jti-3"}}`,
      'create jti-3',
    ]);
  });

  it('takes a single lock when the presented session is the family head', async () => {
    const { repository, calls } = fakePrisma([head]);

    const seen = await repository.withFamilyLock('fam-1', 'fam-1', async (family) => [family.head?.id, family.session?.id]);

    expect(seen).toEqual(['fam-1', 'fam-1']);
    expect(calls.filter((call) => call.includes('FOR UPDATE'))).toEqual(['SELECT id FROM refresh_sessions WHERE id = <fam-1> FOR UPDATE']);
  });

  it('hands the work null sessions when they are not stored in that family', async () => {
    const { repository } = fakePrisma([]);

    expect(await repository.withFamilyLock('fam-1', 'jti-2', async (family) => family)).toEqual({ head: null, session: null });
  });

  it('revokes only the sessions of the family still unrevoked, under the lock', async () => {
    const { repository, calls } = fakePrisma([head, current]);

    await repository.withFamilyLock('fam-1', 'jti-2', (_family, writes) => writes.revokeFamily('fam-1', at));

    expect(calls[calls.length - 1]).toBe(`updateMany {"where":{"familyId":"fam-1","revokedAt":null},"data":{"revokedAt":"${at.toISOString()}"}}`);
  });

  it('revokes every unrevoked session of a user', async () => {
    const { repository, calls } = fakePrisma([]);

    await repository.revokeAllOfUser('user-1', at);

    expect(calls).toEqual([`updateMany {"where":{"userId":"user-1","revokedAt":null},"data":{"revokedAt":"${at.toISOString()}"}}`]);
  });
});
