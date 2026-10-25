export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface DaySchedule {
  open: string;      // HH:mm format
  close: string;     // HH:mm format
  isClosed: boolean;
}

export interface WeekSchedule {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

export class Schedule {
  public readonly weekSchedule: WeekSchedule;
  public readonly timezone: string;

  private constructor(weekSchedule: WeekSchedule, timezone: string = 'America/Argentina/Buenos_Aires') {
    this.weekSchedule = weekSchedule;
    this.timezone = timezone;
  }

  public static create(weekSchedule: Partial<WeekSchedule>, timezone?: string): Schedule {
    const defaultDay: DaySchedule = { open: '09:00', close: '23:00', isClosed: false };
    const defaultClosed: DaySchedule = { open: '00:00', close: '00:00', isClosed: true };

    const fullSchedule: WeekSchedule = {
      monday: weekSchedule.monday ?? defaultDay,
      tuesday: weekSchedule.tuesday ?? defaultDay,
      wednesday: weekSchedule.wednesday ?? defaultDay,
      thursday: weekSchedule.thursday ?? defaultDay,
      friday: weekSchedule.friday ?? defaultDay,
      saturday: weekSchedule.saturday ?? defaultDay,
      sunday: weekSchedule.sunday ?? defaultClosed,
    };

    // Validate each day
    for (const [day, schedule] of Object.entries(fullSchedule)) {
      if (!schedule.isClosed) {
        if (!schedule.open || !schedule.close) {
          throw new Error(`Horario incompleto para ${day}`);
        }
        if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(schedule.open)) {
          throw new Error(`Formato de hora de apertura inválido para ${day}: ${schedule.open}`);
        }
        if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(schedule.close)) {
          throw new Error(`Formato de hora de cierre inválido para ${day}: ${schedule.close}`);
        }
        if (schedule.open >= schedule.close) {
          throw new Error(`Hora de apertura debe ser anterior a hora de cierre para ${day}`);
        }
      }
    }

    return new Schedule(fullSchedule, timezone ?? 'America/Argentina/Buenos_Aires');
  }

  public static createClosed(): Schedule {
    const closedDay: DaySchedule = { open: '00:00', close: '00:00', isClosed: true };
    return new Schedule({
      monday: closedDay,
      tuesday: closedDay,
      wednesday: closedDay,
      thursday: closedDay,
      friday: closedDay,
      saturday: closedDay,
      sunday: closedDay,
    });
  }

  public isOpenAt(day: DayOfWeek, time: string): boolean {
    const schedule = this.weekSchedule[day];
    if (schedule.isClosed) return false;
    return time >= schedule.open && time < schedule.close;
  }

  public getDaySchedule(day: DayOfWeek): DaySchedule {
    return this.weekSchedule[day];
  }

  public equals(other: Schedule): boolean {
    return JSON.stringify(this.weekSchedule) === JSON.stringify(other.weekSchedule);
  }

  public toJSON(): WeekSchedule {
    return { ...this.weekSchedule };
  }
}