'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';

export interface SucursalData {
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
  schedule?: Schedule;
  isMain?: boolean;
}

export interface Step2SucursalesProps {
  data: SucursalData[];
  onChange: (sucursales: SucursalData[]) => void;
}

type DaySchedule = {
  open: string;
  close: string;
  isClosed: boolean;
};

type Schedule = {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
};

type DayKey = keyof Schedule;

const days: readonly DayKey[] = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
];

const provinces = [
  'Buenos Aires', 'CABA', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba',
  'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja',
  'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan',
  'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán'
];

const defaultSchedule: Schedule = {
  monday: { open: '09:00', close: '23:00', isClosed: false },
  tuesday: { open: '09:00', close: '23:00', isClosed: false },
  wednesday: { open: '09:00', close: '23:00', isClosed: false },
  thursday: { open: '09:00', close: '23:00', isClosed: false },
  friday: { open: '09:00', close: '23:00', isClosed: false },
  saturday: { open: '09:00', close: '23:00', isClosed: false },
  sunday: { open: '00:00', close: '00:00', isClosed: true },
};

export function Step2Sucursales({ data, onChange }: Step2SucursalesProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [showSchedule, setShowSchedule] = useState<number | null>(null);

  const createEmptySucursal = (): SucursalData => ({
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
    isMain: data.length === 0,
  });

  const updateSucursal = (index: number, field: string, value: any) => {
    const newData = [...data];
    const sucursal = { ...data[index] };

    if (field.startsWith('address.')) {
      sucursal.address = { ...sucursal.address, [field.replace('address.', '')]: value };
    } else if (field.startsWith('schedule.')) {
      const [, day, subField] = field.split('.');
      sucursal.schedule = {
        ...sucursal.schedule!,
        [day as DayKey]: {
          ...sucursal.schedule![day as DayKey],
          [subField as keyof DaySchedule]: value,
        },
      };
    } else {
      (sucursal as Record<string, unknown>)[field] = value;
    }

    newData[index] = sucursal;
    onChange(newData);
  };

  const addSucursal = () => {
    onChange([...data, createEmptySucursal()]);
    setEditingIndex(data.length);
  };

  const removeSucursal = (index: number) => {
    if (data.length <= 1) return;
    const newData = data.filter((_, i) => i !== index);
    if (!newData.some(s => s.isMain)) {
      newData[0] = { ...newData[0], isMain: true };
    }
    onChange(newData);
  };

  const toggleMain = (index: number) => {
    const newData = data.map((s, i) => ({
      ...s,
      isMain: i === index,
    }));
    onChange(newData);
  };

  const handleScheduleToggle = (index: number) => {
    setShowSchedule(showSchedule === index ? null : index);
  };

  const renderSucursalCard = (sucursal: SucursalData, index: number) => {
    const isEditing = editingIndex === index;
    const isMain = sucursal.isMain;
    const isScheduleOpen = showSchedule === index;

    if (isEditing) {
      return (
        <div className="bg-white border-2 border-unna-green rounded-xl p-6 space-y-6 animate-slide-in">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              {isMain ? '🏠 Sucursal Principal' : `Sucursal ${index + 1}`}
            </h3>
            <Button variant="ghost" size="sm" onClick={() => setEditingIndex(null)} data-testid="edit-cancel-top">
              Cancelar
            </Button>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="label-field">Nombre <span className="text-red-500">*</span></label>
              <Input
                data-testid="edit-name"
                value={sucursal.name}
                onChange={(e) => updateSucursal(index, 'name', e.target.value)}
                placeholder="Ej: Sucursal Palermo"
              />
            </div>
            <div>
              <label className="label-field">Teléfono <span className="text-red-500">*</span></label>
              <Input
                data-testid="edit-phone"
                type="tel"
                value={sucursal.phone}
                onChange={(e) => updateSucursal(index, 'phone', e.target.value)}
                placeholder="11 1234 5678"
              />
            </div>
            <div>
              <label className="label-field">Email <span className="text-red-500">*</span></label>
              <Input
                data-testid="edit-email"
                type="email"
                value={sucursal.email}
                onChange={(e) => updateSucursal(index, 'email', e.target.value)}
                placeholder="sucursal@ejemplo.com"
              />
            </div>
            <div>
              <label className="label-field">Sucursal Principal</label>
              <Select
                data-testid="edit-is-main"
                value={String(sucursal.isMain)}
                onChange={(e) => updateSucursal(index, 'isMain', e.target.value === 'true')}
                options={[
                  { value: 'true', label: 'Sí, es la principal' },
                  { value: 'false', label: 'No, es secundaria' },
                ]}
                placeholder="Seleccionar"
              />
            </div>
          </div>

          <div>
            <label className="label-field">Dirección</label>
            <div className="grid md:grid-cols-2 gap-4">
              <Input
                data-testid="edit-street"
                value={sucursal.address.street}
                onChange={(e) => updateSucursal(index, 'address.street', e.target.value)}
                placeholder="Calle"
              />
              <Input
                data-testid="edit-number"
                value={sucursal.address.number}
                onChange={(e) => updateSucursal(index, 'address.number', e.target.value)}
                placeholder="Número"
              />
              <Input
                data-testid="edit-floor"
                value={sucursal.address.floor || ''}
                onChange={(e) => updateSucursal(index, 'address.floor', e.target.value)}
                placeholder="Piso (opcional)"
              />
              <Input
                data-testid="edit-apartment"
                value={sucursal.address.apartment || ''}
                onChange={(e) => updateSucursal(index, 'address.apartment', e.target.value)}
                placeholder="Depto / Oficina (opcional)"
              />
              <Input
                data-testid="edit-neighborhood"
                value={sucursal.address.neighborhood || ''}
                onChange={(e) => updateSucursal(index, 'address.neighborhood', e.target.value)}
                placeholder="Barrio (opcional)"
              />
              <Input
                data-testid="edit-city"
                value={sucursal.address.city}
                onChange={(e) => updateSucursal(index, 'address.city', e.target.value)}
                placeholder="Ciudad"
              />
              <Select
                data-testid="edit-province"
                value={sucursal.address.province}
                onChange={(e) => updateSucursal(index, 'address.province', e.target.value)}
                options={provinces.map(p => ({ value: p, label: p }))}
                placeholder="Provincia"
              />
              <Input
                data-testid="edit-postal-code"
                value={sucursal.address.postalCode}
                onChange={(e) => updateSucursal(index, 'address.postalCode', e.target.value)}
                placeholder="Código Postal"
              />
              <Input
                data-testid="edit-country"
                value={sucursal.address.country}
                onChange={(e) => updateSucursal(index, 'address.country', e.target.value)}
                placeholder="País"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setEditingIndex(null)} data-testid="edit-cancel-bottom">
              Cancelar
            </Button>
            <Button onClick={() => setEditingIndex(null)} data-testid="edit-save">Guardar</Button>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
              isMain ? 'bg-unna-green text-white' : 'bg-gray-100 text-gray-600'
            }`}>
              {isMain ? '🏠' : index + 1}
            </span>
            <div>
              <p className="font-medium text-gray-900">{sucursal.name || 'Sin nombre'}</p>
              <p className="text-sm text-gray-500">{sucursal.address.city}, {sucursal.address.province}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isMain && (
              <span className="px-2 py-1 text-xs font-medium bg-unna-green/10 text-unna-green rounded-full">
                Principal
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={() => setEditingIndex(index)} data-testid="view-edit">
              Editar
            </Button>
            {data.length > 1 && !isMain && (
              <Button variant="ghost" size="sm" onClick={() => toggleMain(index)} data-testid="view-make-main">
                Hacer Principal
              </Button>
            )}
            {data.length > 1 && (
              <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => removeSucursal(index)} data-testid="view-delete">
                Eliminar
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => handleScheduleToggle(index)} data-testid="view-toggle-schedule">
              {isScheduleOpen ? 'Ocultar horarios' : 'Ver horarios'}
            </Button>
          </div>
        </div>

        {isScheduleOpen && (
          <div className="p-4 bg-gray-50 border-t border-gray-100">
            <h4 className="font-medium text-gray-900 mb-3">Horarios de atención</h4>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
              {days.map((day) => {
                const daySchedule = sucursal.schedule?.[day] ?? defaultSchedule[day];
                return (
                  <div key={day} className="bg-white p-3 rounded-lg border border-gray-100">
                    <label className="text-sm font-medium text-gray-700 capitalize">{day}</label>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        data-testid={`schedule-${day}-closed`}
                        type="checkbox"
                        checked={daySchedule.isClosed}
                        onChange={(e) => updateSucursal(index, `schedule.${day}.isClosed`, e.target.checked)}
                        className="w-4 h-4 text-unna-green rounded border-gray-300 focus:ring-unna-green"
                      />
                      <span className="text-sm text-gray-600">Cerrado</span>
                    </div>
                    {!daySchedule.isClosed && (
                      <div className="flex items-center gap-2 mt-2">
                        <input
                          data-testid={`schedule-${day}-open`}
                          type="time"
                          value={daySchedule.open}
                          onChange={(e) => updateSucursal(index, `schedule.${day}.open`, e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-unna-green"
                        />
                        <span className="text-gray-400">a</span>
                        <input
                          data-testid={`schedule-${day}-close`}
                          type="time"
                          value={daySchedule.close}
                          onChange={(e) => updateSucursal(index, `schedule.${day}.close`, e.target.value)}
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
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {data.map((sucursal, index) => (
        <div key={index}>{renderSucursalCard(sucursal, index)}</div>
      ))}
      <Button onClick={addSucursal} className="w-full md:w-auto" data-testid="add-sucursal">
        Agregar sucursal
      </Button>
    </div>
  );
}
