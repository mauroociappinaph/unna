'use client';

import { Button } from '@/components/ui/Button';

export interface OnboardingData {
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
  schedule: {
    monday: { open: string; close: string; isClosed: boolean };
    tuesday: { open: string; close: string; isClosed: boolean };
    wednesday: { open: string; close: string; isClosed: boolean };
    thursday: { open: string; close: string; isClosed: boolean };
    friday: { open: string; close: string; isClosed: boolean };
    saturday: { open: string; close: string; isClosed: boolean };
    sunday: { open: string; close: string; isClosed: boolean };
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
  sucursales: Array<{
    name: string;
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
    phone: string;
    email: string;
    schedule?: {
      monday: { open: string; close: string; isClosed: boolean };
      tuesday: { open: string; close: string; isClosed: boolean };
      wednesday: { open: string; close: string; isClosed: boolean };
      thursday: { open: string; close: string; isClosed: boolean };
      friday: { open: string; close: string; isClosed: boolean };
      saturday: { open: string; close: string; isClosed: boolean };
      sunday: { open: string; close: string; isClosed: boolean };
    };
    isMain?: boolean;
  }>;
}

export interface Step4ConfirmacionProps {
  data: OnboardingData;
  onSubmit: () => void;
  isSubmitting: boolean;
  submitError: string | null;
  submitSuccess: boolean;
}

const ivaLabels: Record<string, string> = {
  responsable_inscripto: 'Responsable Inscripto',
  monotributo: 'Monotributo',
  exento: 'Exento',
  consumidor_final: 'Consumidor Final',
};

const currencyLabels: Record<string, string> = {
  ARS: 'ARS - Peso Argentino',
  USD: 'USD - Dólar Estadounidense',
};

export function Step4Confirmacion({ data, onSubmit, isSubmitting, submitError, submitSuccess }: Step4ConfirmacionProps) {
  if (submitSuccess) {
    return (
      <div className="text-center py-12" data-testid="success-state">
        <div className="w-20 h-20 mx-auto mb-6 bg-unna-green/10 rounded-full flex items-center justify-center">
          <svg className="w-10 h-10 text-unna-green" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">¡Onboarding completado!</h3>
        <p className="text-gray-600 mb-6">Tu negocio ha sido creado exitosamente. Redirigiendo al dashboard...</p>
        <div className="w-64 mx-auto h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-unna-green animate-pulse" style={{ width: '100%' }} />
        </div>
      </div>
    );
  }

  const formatAddress = (addr: OnboardingData['address']) => {
    const parts = [addr.street, addr.number];
    if (addr.floor) parts.push(`Piso ${addr.floor}`);
    if (addr.apartment) parts.push(`Dpto ${addr.apartment}`);
    if (addr.neighborhood) parts.push(addr.neighborhood);
    parts.push(addr.city, addr.province, addr.postalCode, addr.country);
    return parts.join(', ');
  };

  return (
    <div className="space-y-6" data-testid="confirmation-form">
      <div className="bg-unna-green/5 border border-unna-green/20 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-unna-green/10 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-unna-green" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Revisá tu información</h3>
            <p className="text-sm text-gray-600">Verificá que todos los datos sean correctos antes de confirmar.</p>
          </div>
        </div>
      </div>

      {submitError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700" data-testid="error-message">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>{submitError}</span>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Datos Fiscales */}
        <section className="bg-white border border-gray-100 rounded-xl p-6" data-testid="section-fiscal">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-unna-green" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Datos Fiscales
          </h3>
          <dl className="space-y-3 text-sm">
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
              <dt className="text-gray-500">Nombre del negocio</dt>
              <dd className="font-medium text-gray-900" data-testid="fiscal-business-name">{data.businessName}</dd>
              <dt className="text-gray-500">CUIT</dt>
              <dd className="font-medium text-gray-900 font-mono" data-testid="fiscal-cuit">{data.cuit}</dd>
              <dt className="text-gray-500">Domicilio</dt>
              <dd className="text-gray-900" data-testid="fiscal-address">{formatAddress(data.address)}</dd>
              <dt className="text-gray-500">Condición IVA</dt>
              <dd className="font-medium text-gray-900" data-testid="fiscal-iva">{ivaLabels[data.settings.ivaCondition]}</dd>
              <dt className="text-gray-500">Punto de Venta</dt>
              <dd className="font-medium text-gray-900 font-mono" data-testid="fiscal-sale-point">{data.settings.salePoint}</dd>
              <dt className="text-gray-500">Moneda</dt>
              <dd className="font-medium text-gray-900" data-testid="fiscal-currency">{currencyLabels[data.settings.currency]}</dd>
              <dt className="text-gray-500">Zona Horaria</dt>
              <dd className="text-gray-900" data-testid="fiscal-timezone">{data.settings.timezone}</dd>
              <dt className="text-gray-500">Idioma</dt>
              <dd className="text-gray-900" data-testid="fiscal-language">{data.settings.language}</dd>
            </div>
          </dl>
        </section>

        {/* Sucursales */}
        <section className="bg-white border border-gray-100 rounded-xl p-6" data-testid="section-sucursales">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-unna-green" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            Sucursales ({data.sucursales.length})
          </h3>
          <div className="space-y-3">
            {data.sucursales.map((sucursal, index) => (
              <div key={index} className="bg-gray-50 rounded-lg p-4" data-testid={`sucursal-${index}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                      sucursal.isMain ? 'bg-unna-green text-white' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {sucursal.isMain ? '🏠' : index + 1}
                    </span>
                    <span className="font-medium text-gray-900" data-testid={`sucursal-${index}-name`}>{sucursal.name || 'Sin nombre'}</span>
                    {sucursal.isMain && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-unna-green/10 text-unna-green rounded-full">
                        Principal
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-gray-500">{sucursal.address.city}, {sucursal.address.province}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                  <span data-testid={`sucursal-${index}-address`}>{sucursal.address.street} {sucursal.address.number}</span>
                  <span data-testid={`sucursal-${index}-phone`}>{sucursal.phone}</span>
                  <span data-testid={`sucursal-${index}-email`}>{sucursal.email}</span>
                  <span data-testid={`sucursal-${index}-type`}>{sucursal.isMain ? 'Sucursal Principal' : 'Sucursal Secundaria'}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Horarios */}
      <section className="bg-white border border-gray-100 rounded-xl p-6" data-testid="section-schedule">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-unna-green" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Horarios de Atención
        </h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { key: 'monday', label: 'Lunes' },
            { key: 'tuesday', label: 'Martes' },
            { key: 'wednesday', label: 'Miércoles' },
            { key: 'thursday', label: 'Jueves' },
            { key: 'friday', label: 'Viernes' },
            { key: 'saturday', label: 'Sábado' },
            { key: 'sunday', label: 'Domingo' },
          ].map(({ key, label }) => {
            const schedule = data.schedule[key as keyof typeof data.schedule];
            return (
              <div key={key} className={`p-3 rounded-lg ${schedule.isClosed ? 'bg-gray-50' : 'bg-white border border-gray-200'}`} data-testid={`day-${key}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-gray-900 capitalize">{label}</span>
                  <span className={schedule.isClosed ? 'text-gray-500' : 'text-unna-green text-sm font-medium'} data-testid={`day-${key}-status`}>
                    {schedule.isClosed ? 'Cerrado' : 'Abierto'}
                  </span>
                </div>
                {!schedule.isClosed && (
                  <p className="text-sm text-gray-600" data-testid={`day-${key}-hours`}>{schedule.open} - {schedule.close}</p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Configuración */}
      <section className="bg-white border border-gray-100 rounded-xl p-6" data-testid="section-settings">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-unna-green" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Configuración
        </h3>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-gray-500">Moneda</dt>
          <dd className="font-medium text-gray-900" data-testid="setting-currency">{currencyLabels[data.settings.currency]}</dd>
          <dt className="text-gray-500">Zona Horaria</dt>
          <dd className="font-medium text-gray-900" data-testid="setting-timezone">{data.settings.timezone}</dd>
          <dt className="text-gray-500">Idioma</dt>
          <dd className="font-medium text-gray-900" data-testid="setting-language">{data.settings.language}</dd>
        </dl>
      </section>
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
        <Button variant="secondary" onClick={onSubmit} disabled={isSubmitting} data-testid="submit-btn">
          Confirmar y crear negocio
        </Button>
      </div>
    </div>
  );
}