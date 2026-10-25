import { ArcaFiscalAuthorizerAdapter } from '../arca-fiscal-authorizer.adapter';
import { caeResponse, fiscalRequest, lastAuthorizedResponse, loginCmsResponse, TestCredentials, throwawayCredentials, xmlResponse } from './arca-test-support';

const WSAA_URL = 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms';
const WSFE_URL = 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx';

describe('ArcaFiscalAuthorizerAdapter', () => {
  let credentials: TestCredentials;
  let fetchMock: jest.SpyInstance;

  beforeAll(() => {
    credentials = throwawayCredentials();
  });

  beforeEach(() => {
    fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (url === WSAA_URL) return xmlResponse(loginCmsResponse('UNNA-TOKEN', 'UNNA-SIGN', '2026-10-26T00:00:00.000-03:00'));
      const body = String(fetchMock.mock.calls[fetchMock.mock.calls.length - 1][1].body);
      if (body.includes('FECompUltimoAutorizado')) return xmlResponse(lastAuthorizedResponse(41));
      return xmlResponse(
        caeResponse(
          '<CbteDesde>42</CbteDesde><CbteHasta>42</CbteHasta><Resultado>A</Resultado><CAE>76123456789012</CAE><CAEFchVto>20261104</CAEFchVto>',
        ),
      );
    });
  });

  afterEach(() => fetchMock.mockRestore());

  const adapter = () =>
    ArcaFiscalAuthorizerAdapter.fromConfig(
      { environment: 'homologacion', wsaaUrl: WSAA_URL, wsfeUrl: WSFE_URL, timeoutMs: 15000, ...credentials },
      () => new Date('2026-10-25T15:00:00Z'),
    );

  it("logs in once with UNNA's certificate and calls WSFE on behalf of the café's CUIT", async () => {
    const arca = adapter();

    expect(await arca.lastAuthorizedNumber('30712345671', 3, 'A')).toBe(41);
    const result = await arca.authorize(fiscalRequest({ number: 42 }));

    expect(result).toMatchObject({ approved: true, number: 42, cae: '76123456789012', caeExpiration: new Date('2026-11-04T03:00:00Z') });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([WSAA_URL, WSFE_URL, WSFE_URL]);
    for (const [, init] of fetchMock.mock.calls.slice(1)) {
      expect(init.body).toContain('<ar:Auth><ar:Token>UNNA-TOKEN</ar:Token><ar:Sign>UNNA-SIGN</ar:Sign><ar:Cuit>30712345671</ar:Cuit></ar:Auth>');
    }
  });

  it('keeps the response XML in raw without the token or sign', async () => {
    const result = await adapter().authorize(fiscalRequest());

    expect(result.raw).toContain('<CAE>76123456789012</CAE>');
    expect(result.raw).not.toContain('UNNA-TOKEN');
    expect(result.raw).not.toContain('UNNA-SIGN');
  });

  it('throws when ARCA cannot be reached, so the receipt stays a retriable draft', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    await expect(adapter().authorize(fiscalRequest())).rejects.toThrow('ARCA (WSAA) no respondió: fetch failed');
  });
});
