import { Business } from '../business.aggregate';
import { Address, BusinessName, BusinessSettings, CUIT, Schedule } from '../../value-objects';

const businessNamed = (name: string) =>
  Business.create(
    'biz-1',
    BusinessName.create(name),
    CUIT.create('20-12345678-6'),
    Address.create({ street: 'Corrientes', number: '1234', city: 'CABA', province: 'Buenos Aires', postalCode: '1043', country: 'Argentina' }),
    Schedule.createClosed(),
    BusinessSettings.create({ tradeName: name, ivaCondition: 'monotributo', salePoint: '0001', currency: 'ARS', timezone: 'America/Argentina/Buenos_Aires', language: 'es' }),
    'owner-1',
  );

describe('Business slug', () => {
  it('keeps the letters of accented names and ñ in the slug, without the accents', () => {
    expect(businessNamed('Café Ñandú').slug).toBe('cafe-nandu');
  });

  it('keeps the slug of plain names unchanged', () => {
    expect(businessNamed('Mi Restaurante & Bar').slug).toBe('mi-restaurante-bar');
  });
});
