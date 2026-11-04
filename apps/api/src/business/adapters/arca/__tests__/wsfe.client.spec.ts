import {
  argentineDate,
  buildFECAESolicitarEnvelope,
  buildFECompUltimoAutorizadoEnvelope,
  formatPesos,
  parseFECAESolicitarResponse,
  parseFECompUltimoAutorizadoResponse,
  WsfeClient,
} from '../wsfe.client';
import { caeResponse, fiscalRequest, lastAuthorizedResponse, soapFault, wsfeEnvelope, xmlResponse } from './arca-test-support';

const WSFE_URL = 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx';
const AUTH = { token: 'TOKEN', sign: 'SIGN', cuit: '30712345671' };
const ENVELOPE_START =
  '<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/"><soap:Body>';
const ENVELOPE_END = '</soap:Body></soap:Envelope>';
const AUTH_XML = '<ar:Auth><ar:Token>TOKEN</ar:Token><ar:Sign>SIGN</ar:Sign><ar:Cuit>30712345671</ar:Cuit></ar:Auth>';

const approvedDetail =
  '<Concepto>1</Concepto><DocTipo>80</DocTipo><DocNro>20123456786</DocNro><CbteDesde>42</CbteDesde><CbteHasta>42</CbteHasta>' +
  '<CbteFch>20261025</CbteFch><Resultado>A</Resultado><CAE>76123456789012</CAE><CAEFchVto>20261104</CAEFchVto>';

describe('WSFEv1', () => {
  it('formats cents as pesos with exactly two decimals', () => {
    expect(formatPesos(0)).toBe('0.00');
    expect(formatPesos(5)).toBe('0.05');
    expect(formatPesos(120)).toBe('1.20');
    expect(formatPesos(231500)).toBe('2315.00');
    expect(formatPesos(123456789)).toBe('1234567.89');
    expect(() => formatPesos(10.5)).toThrow('Importe inválido para ARCA: 10.5 centavos');
    expect(() => formatPesos(-1)).toThrow('Importe inválido para ARCA: -1 centavos');
  });

  it('formats the receipt date as yyyymmdd in Argentine time', () => {
    expect(argentineDate(new Date('2026-10-26T01:30:00Z'))).toBe('20261025');
    expect(argentineDate(new Date('2026-10-26T03:00:00Z'))).toBe('20261026');
    expect(argentineDate(new Date('2027-01-01T02:59:59Z'))).toBe('20261231');
  });

  it('builds FECompUltimoAutorizado for the issuer, point of sale and receipt code', () => {
    expect(buildFECompUltimoAutorizadoEnvelope(AUTH, 3, 'B')).toBe(
      `${ENVELOPE_START}<ar:FECompUltimoAutorizado>${AUTH_XML}<ar:PtoVta>3</ar:PtoVta><ar:CbteTipo>6</ar:CbteTipo></ar:FECompUltimoAutorizado>${ENVELOPE_END}`,
    );
  });

  it('builds FECAESolicitar for an A receipt with 21% and 10.5% IVA lines', () => {
    expect(buildFECAESolicitarEnvelope(AUTH, fiscalRequest())).toBe(
      `${ENVELOPE_START}<ar:FECAESolicitar>${AUTH_XML}<ar:FeCAEReq>` +
        '<ar:FeCabReq><ar:CantReg>1</ar:CantReg><ar:PtoVta>3</ar:PtoVta><ar:CbteTipo>1</ar:CbteTipo></ar:FeCabReq>' +
        '<ar:FeDetReq><ar:FECAEDetRequest><ar:Concepto>1</ar:Concepto><ar:DocTipo>80</ar:DocTipo><ar:DocNro>20123456786</ar:DocNro>' +
        '<ar:CbteDesde>42</ar:CbteDesde><ar:CbteHasta>42</ar:CbteHasta><ar:CbteFch>20261025</ar:CbteFch>' +
        '<ar:ImpTotal>2315.00</ar:ImpTotal><ar:ImpTotConc>0.00</ar:ImpTotConc><ar:ImpNeto>2000.00</ar:ImpNeto><ar:ImpOpEx>0.00</ar:ImpOpEx>' +
        '<ar:ImpTrib>0.00</ar:ImpTrib><ar:ImpIVA>315.00</ar:ImpIVA><ar:MonId>PES</ar:MonId><ar:MonCotiz>1</ar:MonCotiz><ar:CondicionIVAReceptorId>1</ar:CondicionIVAReceptorId>' +
        '<ar:Iva><ar:AlicIva><ar:Id>5</ar:Id><ar:BaseImp>1000.00</ar:BaseImp><ar:Importe>210.00</ar:Importe></ar:AlicIva>' +
        '<ar:AlicIva><ar:Id>4</ar:Id><ar:BaseImp>1000.00</ar:BaseImp><ar:Importe>105.00</ar:Importe></ar:AlicIva></ar:Iva>' +
        `</ar:FECAEDetRequest></ar:FeDetReq></ar:FeCAEReq></ar:FECAESolicitar>${ENVELOPE_END}`,
    );
  });

  it('builds FECAESolicitar for a C receipt without an Iva block', () => {
    const request = fiscalRequest({
      receiptType: 'C',
      docType: 99,
      docNumber: '0',
      netAmount: 150050,
      ivaAmount: 0,
      totalAmount: 150050,
      ivaBreakdown: [],
      receiverVatCondition: 5,
    });
    expect(buildFECAESolicitarEnvelope(AUTH, request)).toBe(
      `${ENVELOPE_START}<ar:FECAESolicitar>${AUTH_XML}<ar:FeCAEReq>` +
        '<ar:FeCabReq><ar:CantReg>1</ar:CantReg><ar:PtoVta>3</ar:PtoVta><ar:CbteTipo>11</ar:CbteTipo></ar:FeCabReq>' +
        '<ar:FeDetReq><ar:FECAEDetRequest><ar:Concepto>1</ar:Concepto><ar:DocTipo>99</ar:DocTipo><ar:DocNro>0</ar:DocNro>' +
        '<ar:CbteDesde>42</ar:CbteDesde><ar:CbteHasta>42</ar:CbteHasta><ar:CbteFch>20261025</ar:CbteFch>' +
        '<ar:ImpTotal>1500.50</ar:ImpTotal><ar:ImpTotConc>0.00</ar:ImpTotConc><ar:ImpNeto>1500.50</ar:ImpNeto><ar:ImpOpEx>0.00</ar:ImpOpEx>' +
        '<ar:ImpTrib>0.00</ar:ImpTrib><ar:ImpIVA>0.00</ar:ImpIVA><ar:MonId>PES</ar:MonId><ar:MonCotiz>1</ar:MonCotiz><ar:CondicionIVAReceptorId>5</ar:CondicionIVAReceptorId>' +
        `</ar:FECAEDetRequest></ar:FeDetReq></ar:FeCAEReq></ar:FECAESolicitar>${ENVELOPE_END}`,
    );
  });

  it('maps every supported IVA rate to its ARCA code and refuses unknown ones', () => {
    const rates: Array<[number, number]> = [[0, 3], [2.5, 9], [5, 8], [10.5, 4], [21, 5], [27, 6]];
    const xml = buildFECAESolicitarEnvelope(
      AUTH,
      fiscalRequest({ receiptType: 'B', ivaBreakdown: rates.map(([rate]) => ({ rate, base: 100, amount: 0 })) }),
    );
    expect([...xml.matchAll(/<ar:Id>(\d+)<\/ar:Id>/g)].map((m) => Number(m[1]))).toEqual(rates.map(([, code]) => code));
    expect(() => buildFECAESolicitarEnvelope(AUTH, fiscalRequest({ ivaBreakdown: [{ rate: 19, base: 100, amount: 19 }] }))).toThrow(
      'Alícuota de IVA no soportada por ARCA: 19%',
    );
  });

  it('escapes text values', () => {
    expect(buildFECompUltimoAutorizadoEnvelope({ token: 'a<b&c', sign: 's"ig', cuit: '30712345671' }, 3, 'A')).toContain(
      '<ar:Token>a&lt;b&amp;c</ar:Token><ar:Sign>s&quot;ig</ar:Sign>',
    );
  });

  it('parses the last authorized number and throws on WSFE errors', () => {
    expect(parseFECompUltimoAutorizadoResponse(lastAuthorizedResponse(41))).toBe(41);
    expect(parseFECompUltimoAutorizadoResponse(lastAuthorizedResponse(0))).toBe(0);
    const withErrors = wsfeEnvelope(
      '<FECompUltimoAutorizadoResponse xmlns="http://ar.gov.afip.dif.FEV1/"><FECompUltimoAutorizadoResult><PtoVta>3</PtoVta><CbteTipo>6</CbteTipo>' +
        '<Errors><Err><Code>600</Code><Msg>ValidacionDeToken: No validaron las firmas digitales</Msg></Err></Errors></FECompUltimoAutorizadoResult></FECompUltimoAutorizadoResponse>',
    );
    expect(() => parseFECompUltimoAutorizadoResponse(withErrors)).toThrow(
      'ARCA (WSFEv1) FECompUltimoAutorizado devolvió errores: 600 - ValidacionDeToken: No validaron las firmas digitales',
    );
    expect(() => parseFECompUltimoAutorizadoResponse(wsfeEnvelope('<Other/>'))).toThrow(
      'ARCA (WSFEv1) FECompUltimoAutorizado: respuesta inesperada',
    );
  });

  it('parses an approval with CAE and its expiration date', () => {
    const xml = caeResponse(approvedDetail);
    expect(parseFECAESolicitarResponse(xml, 42)).toEqual({
      approved: true,
      number: 42,
      cae: '76123456789012',
      caeExpiration: new Date('2026-11-04T03:00:00Z'),
      raw: xml,
    });
  });

  it('parses a rejection with observations', () => {
    const detail =
      '<CbteDesde>42</CbteDesde><CbteHasta>42</CbteHasta><Resultado>R</Resultado>' +
      '<Observaciones><Obs><Code>10016</Code><Msg>El numero o fecha del comprobante no se corresponde con el proximo a autorizar</Msg></Obs>' +
      '<Obs><Code>10242</Code><Msg>El campo Condicion Frente al IVA del receptor resulta obligatorio</Msg></Obs></Observaciones><CAE/><CAEFchVto/>';
    const xml = caeResponse(detail, '', 'R');
    expect(parseFECAESolicitarResponse(xml, 42)).toEqual({
      approved: false,
      errors: [
        { code: '10016', message: 'El numero o fecha del comprobante no se corresponde con el proximo a autorizar' },
        { code: '10242', message: 'El campo Condicion Frente al IVA del receptor resulta obligatorio' },
      ],
      raw: xml,
    });
  });

  it('parses request-level Errors as a rejection', () => {
    const xml = wsfeEnvelope(
      '<FECAESolicitarResponse xmlns="http://ar.gov.afip.dif.FEV1/"><FECAESolicitarResult>' +
        '<Errors><Err><Code>10007</Code><Msg>Campo CbteTipo invalido &amp; fuera de rango</Msg></Err></Errors>' +
        '</FECAESolicitarResult></FECAESolicitarResponse>',
    );
    expect(parseFECAESolicitarResponse(xml, 42)).toEqual({
      approved: false,
      errors: [{ code: '10007', message: 'Campo CbteTipo invalido & fuera de rango' }],
      raw: xml,
    });
  });

  it('throws on a response without a result', () => {
    expect(() => parseFECAESolicitarResponse(wsfeEnvelope('<Nothing/>'), 42)).toThrow('ARCA (WSFEv1) FECAESolicitar: respuesta inesperada');
  });

  describe('client', () => {
    let fetchMock: jest.SpyInstance;
    beforeEach(() => {
      fetchMock = jest.spyOn(globalThis, 'fetch');
    });
    afterEach(() => fetchMock.mockRestore());

    const client = (timeoutMs = 15000) => new WsfeClient({ url: WSFE_URL, timeoutMs });

    it('posts with the operation SOAPAction and returns parsed results', async () => {
      fetchMock.mockResolvedValueOnce(xmlResponse(lastAuthorizedResponse(41)));
      expect(await client().lastAuthorized(AUTH, 3, 'B')).toBe(41);
      expect(fetchMock.mock.calls[0][0]).toBe(WSFE_URL);
      expect(fetchMock.mock.calls[0][1].headers).toEqual({
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: '"http://ar.gov.afip.dif.FEV1/FECompUltimoAutorizado"',
      });

      fetchMock.mockResolvedValueOnce(xmlResponse(caeResponse(approvedDetail)));
      expect(await client().requestCae(AUTH, fiscalRequest())).toMatchObject({ approved: true, number: 42, cae: '76123456789012' });
      expect(fetchMock.mock.calls[1][1].headers.SOAPAction).toBe('"http://ar.gov.afip.dif.FEV1/FECAESolicitar"');
      expect(fetchMock.mock.calls[1][1].body).toBe(buildFECAESolicitarEnvelope(AUTH, fiscalRequest()));
    });

    it('throws on a SOAP fault, a non-200 response and a timeout', async () => {
      fetchMock.mockResolvedValueOnce(xmlResponse(soapFault('soap:Server', 'Server was unable to process request.'), 500));
      await expect(client().requestCae(AUTH, fiscalRequest())).rejects.toThrow(
        'ARCA (WSFEv1) devolvió un error SOAP: soap:Server - Server was unable to process request.',
      );

      fetchMock.mockResolvedValueOnce(xmlResponse('Service Unavailable', 503));
      await expect(client().requestCae(AUTH, fiscalRequest())).rejects.toThrow('ARCA (WSFEv1) respondió HTTP 503');

      fetchMock.mockImplementationOnce(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
          }),
      );
      await expect(client(20).lastAuthorized(AUTH, 3, 'B')).rejects.toThrow('ARCA (WSFEv1) no respondió en 20 ms');
    });
  });
});
