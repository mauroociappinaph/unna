import { resolveFiscalDocument } from '../receipt-rules';

// 20-12345678-6 and 30-71234567-1 have valid check digits.
const CUIT_RI = '20123456786';
const CUIT_COMPANY = '30-71234567-1';

describe('resolveFiscalDocument', () => {
  describe('responsable inscripto', () => {
    it('issues A to a customer with a valid CUIT, documented as CUIT (80)', () => {
      expect(resolveFiscalDocument('responsable_inscripto', 'A', { taxId: CUIT_COMPANY, condition: 'responsable_inscripto' })).toEqual({
        docType: 80,
        docNumber: '30712345671',
      });
    });

    it('issues A to a monotributista customer', () => {
      expect(resolveFiscalDocument('responsable_inscripto', 'A', { taxId: CUIT_RI, condition: 'monotributo' }).docType).toBe(80);
    });

    it('rejects A without the customer CUIT', () => {
      expect(() => resolveFiscalDocument('responsable_inscripto', 'A', {})).toThrow('La factura A requiere el CUIT del cliente');
    });

    it('rejects A with an invalid CUIT', () => {
      expect(() => resolveFiscalDocument('responsable_inscripto', 'A', { taxId: '20123456780' })).toThrow(
        'CUIT inválido (dígito verificador incorrecto)',
      );
    });

    it('rejects A with a DNI instead of a CUIT', () => {
      expect(() => resolveFiscalDocument('responsable_inscripto', 'A', { taxId: '12345678' })).toThrow('CUIT debe tener 11 dígitos numéricos');
    });

    it('rejects A to a consumidor final or exento customer', () => {
      for (const condition of ['consumidor_final', 'exento']) {
        expect(() => resolveFiscalDocument('responsable_inscripto', 'A', { taxId: CUIT_RI, condition })).toThrow(
          'La factura A es para clientes responsables inscriptos o monotributistas; a un consumidor final o exento corresponde factura B',
        );
      }
    });

    it('issues B to an unidentified consumidor final as doc 99 number "0"', () => {
      expect(resolveFiscalDocument('responsable_inscripto', 'B', {})).toEqual({ docType: 99, docNumber: '0' });
    });

    it('issues B with a CUIT as doc 80 and with a 7-8 digit DNI as doc 96', () => {
      expect(resolveFiscalDocument('responsable_inscripto', 'B', { taxId: CUIT_RI, condition: 'exento' })).toEqual({ docType: 80, docNumber: CUIT_RI });
      expect(resolveFiscalDocument('responsable_inscripto', 'B', { taxId: '12.345.678' })).toEqual({ docType: 96, docNumber: '12345678' });
      expect(resolveFiscalDocument('responsable_inscripto', 'B', { taxId: '1234567' })).toEqual({ docType: 96, docNumber: '1234567' });
    });

    it('rejects B to a responsable inscripto or monotributista customer', () => {
      for (const condition of ['responsable_inscripto', 'monotributo']) {
        expect(() => resolveFiscalDocument('responsable_inscripto', 'B', { taxId: CUIT_RI, condition })).toThrow(
          'A un cliente responsable inscripto o monotributista corresponde factura A',
        );
      }
    });

    it('rejects C', () => {
      expect(() => resolveFiscalDocument('responsable_inscripto', 'C', {})).toThrow('Un responsable inscripto emite factura A o B, no C');
    });
  });

  describe('monotributo and exento', () => {
    it('issue C only', () => {
      expect(resolveFiscalDocument('monotributo', 'C', {})).toEqual({ docType: 99, docNumber: '0' });
      expect(resolveFiscalDocument('exento', 'C', { taxId: CUIT_RI })).toEqual({ docType: 80, docNumber: CUIT_RI });
    });

    it('reject A and B with a clear message', () => {
      for (const type of ['A', 'B'] as const) {
        expect(() => resolveFiscalDocument('monotributo', type, { taxId: CUIT_RI })).toThrow('Un monotributista solo puede emitir factura C');
        expect(() => resolveFiscalDocument('exento', type, { taxId: CUIT_RI })).toThrow('Un exento solo puede emitir factura C');
      }
    });
  });

  it('rejects any invoice from a business registered as consumidor final', () => {
    expect(() => resolveFiscalDocument('consumidor_final', 'C', {})).toThrow(
      'Un negocio registrado como consumidor final no puede emitir facturas; actualizá su condición de IVA',
    );
  });

  it('rejects an unknown customer IVA condition', () => {
    expect(() => resolveFiscalDocument('monotributo', 'C', { condition: 'otro' })).toThrow('Condición de IVA del cliente inválida');
  });

  it('rejects a document that is neither a CUIT nor a DNI', () => {
    expect(() => resolveFiscalDocument('monotributo', 'C', { taxId: '12345' })).toThrow(
      'Documento del cliente inválido: ingresá un CUIT de 11 dígitos o un DNI de 7 u 8',
    );
  });

  it('validates the check digit of a CUIT given on B or C', () => {
    expect(() => resolveFiscalDocument('monotributo', 'C', { taxId: '20123456780' })).toThrow('CUIT inválido (dígito verificador incorrecto)');
  });
});
