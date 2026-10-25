'use client';

import { Button } from '@/components/ui/Button';

export interface WeekSchedule {
  monday: { open: string; close: string; isClosed: boolean };
  tuesday: { open: string; close: string; isClosed: boolean };
  wednesday: { open: string; close: string; isClosed: boolean };
  thursday: { open: string; close: string; isClosed: boolean };
  friday: { open: string; close: string; isClosed: boolean };
  saturday: { open: string; close: string; isClosed: boolean };
  sunday: { open: string; close: string; isClosed: boolean };
}

export interface Step3HorariosProps {
  data: WeekSchedule;
  onChange: (schedule: WeekSchedule) => void;
}

const days = [
  { key: 'monday', label: 'Lunes' },
  { key: 'tuesday', label: 'Martes' },
  { key: 'wednesday', label: 'Miércoles' },
  { key: 'thursday', label: 'Jueves' },
  { key: 'friday', label: 'Viernes' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
] as const;

const defaultSchedule: WeekSchedule = {
  monday: { open: '09:00', close: '23:00', isClosed: false },
  tuesday: { open: '09:00', close: '23:00', isClosed: false },
  wednesday: { open: '09:00', close: '23:00', isClosed: false },
  thursday: { open: '09:00', close: '23:00', isClosed: false },
  friday: { open: '09:00', close: '23:00', isClosed: false },
  saturday: { open: '09:00', close: '23:00', isClosed: false },
  sunday: { open: '00:00', close: '00:00', isClosed: true },
};

export function Step3Horarios({ data, onChange }: Step3HorariosProps) {
  const handleTimeChange = (day: keyof WeekSchedule, field: 'open' | 'close', value: string) => {
    onChange({
      ...data,
      [day]: { ...data[day], [field]: value },
    });
  };

  const handleClosedChange = (day: keyof WeekSchedule, isClosed: boolean) => {
    onChange({
      ...data,
      [day]: { ...data[day], isClosed },
    });
  };

  const copyToAll = (sourceDay: keyof WeekSchedule) => {
    const source = data[sourceDay];
    const newSchedule = { ...data };
    days.forEach(({ key }) => {
      if (key !== sourceDay) {
        newSchedule[key] = { ...source };
      }
    });
    onChange(newSchedule);
  };

  const resetToDefault = () => {
    onChange(defaultSchedule);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900" data-testid="step3-title">Horarios de atención</h3>
          <p className="text-sm text-gray-500">Configurá los horarios de apertura y cierre para cada día.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={resetToDefault} data-testid="reset-default">
            Restablecer defecto
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {days.map(({ key, label }) => {
          const schedule = data[key];
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
                    data-testid={`day-${key}-closed`}
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
                      data-testid={`day-${key}-open`}
                      type="time"
                      value={schedule.open}
                      onChange={(e) => handleTimeChange(key, 'open', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-unna-green focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Cierre</label>
                    <input
                      data-testid={`day-${key}-close`}
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
          )})}
      </div>

      <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-100">
        <Button variant="secondary" size="sm" onClick={() => copyToAll('monday')} data-testid="copy-monday">
          Copiar Lunes a todos
        </Button>
        <Button variant="secondary" size="sm" onClick={() => copyToAll('saturday')} data-testid="copy-saturday">
          Copiar Sábado a todos
        </Button>
        <Button variant="ghost" size="sm" onClick={resetToDefault} data-testid="reset-default-footer">
          Restablecer horarios por defecto
        </Button>
      </div>
    </div>
  );
}