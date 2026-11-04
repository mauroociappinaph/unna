'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';

export interface FiscalData {
  businessName: string;
  cuit: string;
  address: {
    street: string;
    number: string;
    floor?: string;
    apartment?: string;
    neighborhood?: string;
    city: string;
    province: string;
    postalCode: string;
    country: string;
  };
  settings: {
    tradeName: string;
    legalName?: string;
    ivaCondition: 'responsable_inscripto' | 'monotributo' | 'exento' | 'consumidor_final';
    iibbNumber?: string;
    salePoint: string;
    currency: 'ARS' | 'USD';
    timezone: string;
    language: string;
    logoUrl?: string;
  };
}

export interface Step1FiscalProps {
  data: FiscalData;
  onChange: (data: Partial<FiscalData>) => void;
}

const provinces = [
  'Buenos Aires', 'CABA', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba',
  'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja',
  'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan',
  'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán'
];

const ivaConditions = [
  { value: 'responsable_inscripto', label: 'Responsable Inscripto' },
  { value: 'monotributo', label: 'Monotributo' },
  { value: 'exento', label: 'Exento' },
  { value: 'consumidor_final', label: 'Consumidor Final' },
];

const currencies = [
  { value: 'ARS', label: 'ARS - Peso Argentino' },
  { value: 'USD', label: 'USD - Dólar Estadounidense' },
];

const languages = [
  { value: 'es-AR', label: 'Español (Argentina)' },
  { value: 'en-US', label: 'English (US)' },
  { value: 'pt-BR', label: 'Português (Brasil)' },
];

const timezones = [
  { value: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires (GMT-3)' },
  { value: 'America/Argentina/Cordoba', label: 'Córdoba (GMT-3)' },
  { value: 'America/Argentina/Mendoza', label: 'Mendoza (GMT-3)' },
  { value: 'America/Argentina/Salta', label: 'Salta (GMT-3)' },
  { value: 'America/Argentina/Tucuman', label: 'Tucumán (GMT-3)' },
];

export function Step1Fiscal({ data, onChange }: Step1FiscalProps) {
  const [cuitError, setCuitError] = useState<string | undefined>(undefined);

  const validateCUIT = (cuit: string): boolean => {
    const cleaned = cuit.replace(/[-\s]/g, '');
    if (!/^\d{11}$/.test(cleaned)) return false;
    
    const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cleaned[i], 10) * weights[i];
    }
    const remainder = sum % 11;
    const checkDigit = remainder === 0 ? 0 : remainder === 1 ? 9 : 11 - remainder;
    return checkDigit === parseInt(cleaned[10], 10);
  };

  const handleCUITChange = (value: string) => {
    const cleaned = value.replace(/[^\d]/g, '').slice(0, 11);
    const formatted = cleaned.length > 2 ? `${cleaned.slice(0, 2)}-${cleaned.slice(2, 10)}-${cleaned.slice(10)}` : cleaned;
    
    onChange({
      cuit: formatted,
    });

    if (cleaned.length === 11 && !validateCUIT(cleaned)) {
      setCuitError('CUIT inválido (dígito verificador incorrecto)');
    } else {
      setCuitError(undefined);
    }
  };

  const handleAddressChange = (field: keyof FiscalData['address'], value: string) => {
    onChange({
      address: { ...data.address, [field]: value },
    });
  };

  const handleSettingsChange = (field: keyof FiscalData['settings'], value: string) => {
    onChange({
      settings: { ...data.settings, [field]: value },
    });
  };

  const handleBusinessNameChange = (value: string) => {
    onChange({ businessName: value, settings: { ...data.settings, tradeName: value } });
  };

  return (
    <div className="space-y-6">
      {/* Nombre del negocio */}
      <div>
        <label htmlFor="businessName" className="label-field">
          Nombre del negocio <span className="text-red-500" aria-hidden="true">*</span>
        </label>
        <Input
          id="businessName"
          value={data.businessName}
          onChange={(e) => handleBusinessNameChange(e.target.value)}
          placeholder="Ej: Café del Centro"
          maxLength={45}
          autoComplete="organization"
        />
        <p className="mt-1.5 text-sm text-gray-500">Se usará como nombre comercial y nombre legal por defecto.</p>
      </div>

      {/* CUIT */}
      <div>
        <label htmlFor="cuit" className="label-field">
          CUIT <span className="text-red-500" aria-hidden="true">*</span>
        </label>
        <Input
          id="cuit"
          value={data.cuit}
          onChange={(e) => handleCUITChange(e.target.value)}
          placeholder="20-12345678-9"
          maxLength={13}
          autoComplete="off"
          error={cuitError}
        />
        <p className="mt-1.5 text-sm text-gray-500">Formato: 20-12345678-9 (11 dígitos con guiones).</p>
      </div>

      {/* Domicilio Fiscal */}
      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold text-gray-900">Domicilio Fiscal</legend>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="street" className="label-field">
              Calle <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <Input
              id="street"
              value={data.address.street}
              onChange={(e) => handleAddressChange('street', e.target.value)}
              placeholder="Ej: Av. Corrientes"
            />
          </div>
          <div>
            <label htmlFor="number" className="label-field">
              Número <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <Input
              id="number"
              type="text"
              value={data.address.number}
              onChange={(e) => handleAddressChange('number', e.target.value)}
              placeholder="1234"
            />
          </div>
          <div>
            <label htmlFor="floor" className="label-field">Piso</label>
            <Input
              id="floor"
              value={data.address.floor || ''}
              onChange={(e) => handleAddressChange('floor', e.target.value)}
              placeholder="Ej: 5"
            />
          </div>
          <div>
            <label htmlFor="apartment" className="label-field">Depto / Oficina</label>
            <Input
              id="apartment"
              value={data.address.apartment || ''}
              onChange={(e) => handleAddressChange('apartment', e.target.value)}
              placeholder="Ej: A"
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="neighborhood" className="label-field">Barrio / Localidad</label>
            <Input
              id="neighborhood"
              value={data.address.neighborhood || ''}
              onChange={(e) => handleAddressChange('neighborhood', e.target.value)}
              placeholder="Ej: Balvanera"
            />
          </div>
          <div>
            <label htmlFor="city" className="label-field">
              Ciudad <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <Input
              id="city"
              value={data.address.city}
              onChange={(e) => handleAddressChange('city', e.target.value)}
              placeholder="Ej: CABA"
            />
          </div>
          <div>
            <label htmlFor="province" className="label-field">
              Provincia <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <Select
              id="province"
              value={data.address.province}
              onChange={(e) => handleAddressChange('province', e.target.value)}
              options={provinces.map(p => ({ value: p, label: p }))}
              placeholder="Seleccionar provincia"
            />
          </div>
          <div>
            <label htmlFor="postalCode" className="label-field">
              Código Postal <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <Input
              id="postalCode"
              value={data.address.postalCode}
              onChange={(e) => handleAddressChange('postalCode', e.target.value)}
              placeholder="Ej: 1043"
            />
          </div>
          <div>
            <label htmlFor="country" className="label-field">
              País <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <Input
              id="country"
              value={data.address.country}
              onChange={(e) => handleAddressChange('country', e.target.value)}
              placeholder="Argentina"
            />
          </div>
        </div>
      </fieldset>

      {/* Configuración del Negocio */}
      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold text-gray-900">Configuración del Negocio</legend>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="legalName" className="label-field">Razón Social</label>
            <Input
              id="legalName"
              value={data.settings.legalName || ''}
              onChange={(e) => handleSettingsChange('legalName', e.target.value)}
              placeholder="Igual al nombre comercial si es igual"
            />
          </div>
          <div>
            <label htmlFor="ivaCondition" className="label-field">
              Condición IVA <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <Select
              id="ivaCondition"
              value={data.settings.ivaCondition}
              onChange={(e) => handleSettingsChange('ivaCondition', e.target.value)}
              options={ivaConditions}
            />
          </div>
          <div>
            <label htmlFor="iibbNumber" className="label-field">IIBB (Ingresos Brutos)</label>
            <Input
              id="iibbNumber"
              value={data.settings.iibbNumber || ''}
              onChange={(e) => handleSettingsChange('iibbNumber', e.target.value)}
              placeholder="Ej: 12345678"
            />
          </div>
          <div>
            <label htmlFor="salePoint" className="label-field">
              Punto de Venta <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <Input
              id="salePoint"
              value={data.settings.salePoint}
              onChange={(e) => handleSettingsChange('salePoint', e.target.value)}
              placeholder="0001"
              maxLength={4}
            />
          </div>
          <div>
            <label htmlFor="currency" className="label-field">
              Moneda <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <Select
              id="currency"
              value={data.settings.currency}
              onChange={(e) => handleSettingsChange('currency', e.target.value)}
              options={currencies}
            />
          </div>
          <div>
            <label htmlFor="timezone" className="label-field">
              Zona Horaria <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <Select
              id="timezone"
              value={data.settings.timezone}
              onChange={(e) => handleSettingsChange('timezone', e.target.value)}
              options={timezones}
            />
          </div>
          <div>
            <label htmlFor="language" className="label-field">
              Idioma <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <Select
              id="language"
              value={data.settings.language}
              onChange={(e) => handleSettingsChange('language', e.target.value)}
              options={languages}
            />
          </div>
          <div>
            <label htmlFor="logoUrl" className="label-field">Logo (URL)</label>
            <Input
              id="logoUrl"
              value={data.settings.logoUrl || ''}
              onChange={(e) => handleSettingsChange('logoUrl', e.target.value)}
              placeholder="https://..."
            />
          </div>
        </div>
      </fieldset>
    </div>
  );
}