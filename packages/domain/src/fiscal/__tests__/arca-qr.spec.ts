import { arcaDate, arcaQrPayload, buildArcaQrUrl } from '../arca-qr';

const input = {
  // 01:30 UTC on Oct 14 is still Oct 13 in Argentina (UTC-3).
  issueDate: new Date('2020-10-14T01:30:00Z'),
  issuerCuit: '30000000007',
  pointOfSale: 10,
  receiptType: 'A' as const,
  number: 94,
  totalAmount: 1210050,
  docType: 80 as const,
  docNumber: '20000000001',
  cae: '70417054367476',
};

describe('ARCA QR (RG 4892)', () => {
  it('builds the payload with ARCA field names and types', () => {
    expect(arcaQrPayload(input)).toEqual({
      ver: 1,
      fecha: '2020-10-13',
      cuit: 30000000007,
      ptoVta: 10,
      tipoCmp: 1,
      nroCmp: 94,
      importe: 12100.5,
      moneda: 'PES',
      ctz: 1,
      tipoDocRec: 80,
      nroDocRec: 20000000001,
      tipoCodAut: 'E',
      codAut: 70417054367476,
    });
  });

  it('encodes the payload as base64 JSON in the ARCA URL', () => {
    const expectedJson =
      '{"ver":1,"fecha":"2020-10-13","cuit":30000000007,"ptoVta":10,"tipoCmp":1,"nroCmp":94,"importe":12100.5,"moneda":"PES","ctz":1,' +
      '"tipoDocRec":80,"nroDocRec":20000000001,"tipoCodAut":"E","codAut":70417054367476}';
    expect(buildArcaQrUrl(input)).toBe(`https://www.afip.gob.ar/fe/qr/?p=${Buffer.from(expectedJson).toString('base64')}`);
  });

  it('uses receipt code 6 for B, 11 for C and doc 99 number 0 for an unidentified customer', () => {
    const payload = arcaQrPayload({ ...input, receiptType: 'C', docType: 99, docNumber: '0', totalAmount: 100 });
    expect(payload).toMatchObject({ tipoCmp: 11, tipoDocRec: 99, nroDocRec: 0, importe: 1 });
    expect(arcaQrPayload({ ...input, receiptType: 'B' }).tipoCmp).toBe(6);
  });

  it('formats dates in Argentina time', () => {
    expect(arcaDate(new Date('2026-10-25T02:59:00Z'))).toBe('2026-10-24');
    expect(arcaDate(new Date('2026-10-25T03:00:00Z'))).toBe('2026-10-25');
  });
});
