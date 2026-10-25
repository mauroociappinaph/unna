import { FiscalAuthorizationRequest } from '@unna/domain';
import { ArcaSimulatedAdapter } from '../arca-simulated.adapter';

const request = (overrides: Partial<FiscalAuthorizationRequest> = {}): FiscalAuthorizationRequest => ({
  issuerCuit: '30712345671',
  pointOfSale: 3,
  receiptType: 'B',
  number: 1,
  issueDate: new Date('2026-10-25T15:00:00Z'),
  concept: 1,
  docType: 99,
  docNumber: '0',
  netAmount: 1000,
  exemptAmount: 0,
  ivaAmount: 210,
  totalAmount: 1210,
  ivaBreakdown: [{ rate: 21, base: 1000, amount: 210 }],
  currency: 'PES',
  ...overrides,
});

describe('ArcaSimulatedAdapter', () => {
  it('approves the next number with a deterministic 14-digit CAE that expires in 10 days', async () => {
    const arca = new ArcaSimulatedAdapter();

    const first = await arca.authorize(request());
    const again = await new ArcaSimulatedAdapter().authorize(request());

    expect(first).toMatchObject({ approved: true, number: 1, caeExpiration: new Date('2026-11-04T15:00:00Z') });
    expect(first.approved && first.cae).toMatch(/^\d{14}$/);
    expect(again).toEqual(first);
    expect(await arca.lastAuthorizedNumber('30712345671', 3, 'B')).toBe(1);
  });

  it('keeps the last number per issuer, point of sale and type', async () => {
    const arca = new ArcaSimulatedAdapter();
    await arca.authorize(request());
    await arca.authorize(request({ number: 2 }));
    await arca.authorize(request({ receiptType: 'A', docType: 80, docNumber: '20123456786' }));

    expect(await arca.lastAuthorizedNumber('30712345671', 3, 'B')).toBe(2);
    expect(await arca.lastAuthorizedNumber('30712345671', 3, 'A')).toBe(1);
    expect(await arca.lastAuthorizedNumber('30712345671', 4, 'B')).toBe(0);
    expect(await arca.lastAuthorizedNumber('20123456786', 3, 'B')).toBe(0);
  });

  it('rejects a number that is not the last plus one, like ARCA error 10016, without moving the last number', async () => {
    const arca = new ArcaSimulatedAdapter();
    await arca.authorize(request());

    for (const number of [1, 3]) {
      const result = await arca.authorize(request({ number }));
      expect(result).toMatchObject({ approved: false, errors: [{ code: '10016' }] });
    }
    expect(await arca.lastAuthorizedNumber('30712345671', 3, 'B')).toBe(1);
  });

  it('accepts the first number it sees for a sequence, since ARCA keeps history the simulator lost on restart', async () => {
    const arca = new ArcaSimulatedAdapter();
    expect(await arca.authorize(request({ number: 8 }))).toMatchObject({ approved: true, number: 8 });
    expect(await arca.authorize(request({ number: 10 }))).toMatchObject({ approved: false });
  });

  it('can simulate an outage that throws, like a transport failure', async () => {
    const arca = new ArcaSimulatedAdapter();
    arca.simulateOutage(true);

    await expect(arca.authorize(request())).rejects.toThrow('ARCA simulado no disponible');
    await expect(arca.lastAuthorizedNumber('30712345671', 3, 'B')).rejects.toThrow('ARCA simulado no disponible');

    arca.simulateOutage(false);
    expect(await arca.authorize(request())).toMatchObject({ approved: true, number: 1 });
  });

  it('can reject the next request with a given error', async () => {
    const arca = new ArcaSimulatedAdapter();
    arca.rejectNext({ code: '10015', message: 'Documento del receptor inválido' });

    expect(await arca.authorize(request())).toEqual({ approved: false, errors: [{ code: '10015', message: 'Documento del receptor inválido' }] });
    expect(await arca.authorize(request())).toMatchObject({ approved: true, number: 1 });
  });
});
