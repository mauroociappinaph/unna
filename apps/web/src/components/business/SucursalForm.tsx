'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';

const provinces = [
  'Buenos Aires', 'CABA', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba',
  'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja',
  'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan',
  'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán'
];

const defaultSchedule = {
  monday: { open: '09:00', close: '23:00', isClosed: false },
  tuesday: { open: '09:00', close: '23:00', isClosed: false },
  wednesday: { open: '09:00', close: '23:00', isClosed: false },
  thursday: { open: '09:00', close: '23:00', isClosed: false },
  friday: { open: '09:00', close: '23:00', isClosed: false },
  saturday: { open: '09:00', close: '23:00', isClosed: false },
  sunday: { open: '00:00', close: '00:00', isClosed: true },
};

export interface SucursalFormData {
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
  isActive?: boolean;
}

export interface SucursalFormProps {
  initialData?: Partial<SucursalFormData>;
  onSubmit: (data: SucursalFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
  title?: string;
}

export function SucursalForm({ initialData, onSubmit, onCancel, isLoading, title = 'Sucursal' }: SucursalFormProps) {
  const [editingSchedule, setEditingSchedule] = useState<string | null>(null);
  const [formData, setFormData] = useState<SucursalFormData>({
    name: '',
    address: {
      street: '',
      number: '',
      floor: '',
      apartment: '',
      neighborhood: '',
      city: '',
      province: '',
      postalCode: '',
      country: 'Argentina',
    },
    phone: '',
    email: '',
    schedule: defaultSchedule,
    isMain: false,
    isActive: true,
    ...initialData,
  });

  const handleChange = (field: string, value: any) => {
    if (field.startsWith('address.')) {
      setFormData(prev => ({
        ...prev,
        address: { ...prev.address, [field.replace('address.', '')]: value },
      }));
    } else if (field.startsWith('schedule.')) {
      const [, day, subField] = field.split('.');
      setFormData(prev => ({
        ...prev,
        schedule: {
          ...prev.schedule!,
          [day as keyof typeof defaultSchedule]: { ...prev.schedule![day as keyof typeof defaultSchedule], [subField]: value },
        },
      }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const days: readonly (keyof typeof defaultSchedule)[] = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
] as const;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <input type="hidden" name="action" value={initialData?.schedule ? 'update' : 'create'} />

      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="label-field">Nombre <span className="text-red-500">*</span></label>
            <Input
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Ej: Sucursal Palermo"
              required
            />
          </div>
          <div>
            <label className="label-field">Teléfono <span className="text-red-500">*</span></label>
            <Input
              type="tel"
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              placeholder="11 1234 5678"
              required
            />
          </div>
          <div>
            <label className="label-field">Email <span className="text-red-500">*</span></label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="sucursal@ejemplo.com"
              required
            />
          </div>
          <div>
            <label className="label-field">Sucursal Principal</label>
            <Select
              value={String(formData.isMain)}
              onChange={(e) => handleChange('isMain', e.target.value === 'true')}
              options={[
                { value: 'true', label: 'Sí, es la principal' },
                { value: 'false', label: 'No, es secundaria' },
              ]}
            />
          </div>
        </div>

        <div>
          <label className="label-field">Dirección</label>
          <div className="grid md:grid-cols-2 gap-4">
            <Input
              value={formData.address.street}
              onChange={(e) => handleChange('address.street', e.target.value)}
              placeholder="Calle"
              required
            />
            <Input
              value={formData.address.number}
              onChange={(e) => handleChange('address.number', e.target.value)}
              placeholder="Número"
              required
            />
            <Input
              value={formData.address.floor || ''}
              onChange={(e) => handleChange('address.floor', e.target.value)}
              placeholder="Piso (opcional)"
            />
            <Input
              value={formData.address.apartment || ''}
              onChange={(e) => handleChange('address.apartment', e.target.value)}
              placeholder="Depto / Oficina (opcional)"
            />
            <Input
              value={formData.address.neighborhood || ''}
              onChange={(e) => handleChange('address.neighborhood', e.target.value)}
              placeholder="Barrio (opcional)"
            />
            <Input
              value={formData.address.city}
              onChange={(e) => handleChange('address.city', e.target.value)}
              placeholder="Ciudad"
              required
            />
            <Select
              value={formData.address.province}
              onChange={(e) => handleChange('address.province', e.target.value)}
              options={provinces.map(p => ({ value: p, label: p }))}
              placeholder="Provincia"
              required
            />
            <Input
              value={formData.address.postalCode}
              onChange={(e) => handleChange('address.postalCode', e.target.value)}
              placeholder="Código Postal"
              required
            />
            <Input
              value={formData.address.country}
              onChange={(e) => handleChange('address.country', e.target.value)}
              placeholder="País"
              required
            />
          </div>
        </div>

        <div>
          <label className="label-field">Horarios de atención</label>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
            {days.map((day) => {
              const daySchedule = formData.schedule?.[day] ?? defaultSchedule[day];
              return (
                <div key={day} className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <label className="text-sm font-medium text-gray-700 capitalize">{day}</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="checkbox"
                      checked={daySchedule.isClosed}
                      onChange={(e) => handleChange(`schedule.${day}.isClosed`, e.target.checked)}
                      className="w-4 h-4 text-unna-green rounded border-gray-300 focus:ring-unna-green"
                    />
                    <span className="text-sm text-gray-600">Cerrado</span>
                  </div>
                  {!daySchedule.isClosed && (
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="time"
                        value={daySchedule.open}
                        onChange={(e) => handleChange(`schedule.${day}.open`, e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-unna-green"
                      />
                      <span className="text-gray-400">a</span>
                      <input
                        type="time"
                        value={daySchedule.close}
                        onChange={(e) => handleChange(`schedule.${day}.close`, e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-unna-green"
                      />
                    </div>
                  )}
                  {daySchedule.isClosed && (
                    <p className="mt-3 text-sm text-gray-500 text-center">Cerrado todo el día</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isLoading}>
          Cancelar
        </Button>
        <Button type="submit" loading={isLoading}>
          {initialData?.schedule ? 'Guardar cambios' : 'Crear sucursal'}
        </Button>
      </div>
    </form>
  );
}