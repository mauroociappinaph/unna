'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';

const defaultSchedule = {
  monday: { open: '09:00', close: '23:00', isClosed: false },
  tuesday: { open: '09:00', close: '23:00', isClosed: false },
  wednesday: { open: '09:00', close: '23:00', isClosed: false },
  thursday: { open: '09:00', close: '23:00', isClosed: false },
  friday: { open: '09:00', close: '23:00', isClosed: false },
  saturday: { open: '09:00', close: '23:00', isClosed: false },
  sunday: { open: '00:00', close: '00:00', isClosed: true },
};

const days: readonly { key: keyof ScheduleFormData; label: string }[] = [
  { key: 'monday', label: 'Lunes' },
  { key: 'tuesday', label: 'Martes' },
  { key: 'wednesday', label: 'Miércoles' },
  { key: 'thursday', label: 'Jueves' },
  { key: 'friday', label: 'Viernes' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
] as const;

export interface ScheduleFormData {
  monday: { open: string; close: string; isClosed: boolean };
  tuesday: { open: string; close: string; isClosed: boolean };
  wednesday: { open: string; close: string; isClosed: boolean };
  thursday: { open: string; close: string; isClosed: boolean };
  friday: { open: string; close: string; isClosed: boolean };
  saturday: { open: string; close: string; isClosed: boolean };
  sunday: { open: string; close: string; isClosed: boolean };
}

export interface HorarioEditorProps {
  initialData: ScheduleFormData;
  onSubmit: (data: ScheduleFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
  title?: string;
  targetName?: string; // 'Negocio principal' or sucursal name
}

export function HorarioEditor({ initialData, onSubmit, onCancel, isLoading, title = 'Horarios', targetName }: HorarioEditorProps) {
  const [copiedFrom, setCopiedFrom] = useState<string | null>(null);
  const [formData, setFormData] = useState<ScheduleFormData>(initialData);

  const handleTimeChange = (day: keyof ScheduleFormData, field: 'open' | 'close', value: string) => {
    setFormData(prev => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  };

  const handleClosedChange = (day: keyof ScheduleFormData, isClosed: boolean) => {
    setFormData(prev => ({
      ...prev,
      [day]: { ...prev[day], isClosed },
    }));
  };

  const copyToAll = (sourceDay: keyof ScheduleFormData) => {
    const source = formData[sourceDay];
    const newSchedule = { ...formData };
    days.forEach(({ key }) => {
      if (key !== sourceDay) {
        newSchedule[key] = { ...source };
      }
    });
    setFormData(newSchedule);
    setCopiedFrom(sourceDay);
    setTimeout(() => setCopiedFrom(null), 2000);
  };

  const resetToDefault = () => {
    setFormData(defaultSchedule);
  };

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(formData);
      }}
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          {targetName && <p className="text-sm text-gray-500">{targetName}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" type="button" onClick={resetToDefault}>
            Restablecer defecto
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {days.map(({ key, label }) => {
          const schedule = formData[key];
          return (
            <div
              key={key}
              className={`bg-white border rounded-xl p-4 transition-all ${
                schedule.isClosed ? 'border-gray-200 bg-gray-50' : 'border-unna-green/30 bg-white'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <label className="font-semibold text-gray-900 capitalize">{label}</label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={schedule.isClosed}
                    onChange={(e) => handleClosedChange(key, e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-unna-green focus:ring-unna-green"
                  />
                  <span className="text-sm text-gray-600">Cerrado</span>
                </label>
              </div>

              {!schedule.isClosed && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Apertura</label>
                    <input
                      type="time"
                      value={schedule.open}
                      onChange={(e) => handleTimeChange(key, 'open', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-unna-green focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Cierre</label>
                    <input
                      type="time"
                      value={schedule.close}
                      onChange={(e) => handleTimeChange(key, 'close', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-unna-green focus:border-transparent"
                    />
                  </div>
                </div>
              )}
              {schedule.isClosed && (
                <p className="mt-3 text-sm text-gray-500 text-center">Cerrado todo el día</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-100">
        <Button variant="secondary" size="sm" type="button" onClick={() => copyToAll('monday')}>
          {copiedFrom === 'monday' ? '✓ Copiado' : 'Copiar Lunes a todos'}
        </Button>
        <Button variant="secondary" size="sm" type="button" onClick={() => copyToAll('saturday')}>
          {copiedFrom === 'saturday' ? '✓ Copiado' : 'Copiar Sábado a todos'}
        </Button>
        <Button variant="ghost" size="sm" type="button" onClick={resetToDefault}>
          Restablecer horarios por defecto
        </Button>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isLoading}>
          Cancelar
        </Button>
        <Button type="submit" loading={isLoading}>
          Guardar horarios
        </Button>
      </div>
    </form>
  );
}