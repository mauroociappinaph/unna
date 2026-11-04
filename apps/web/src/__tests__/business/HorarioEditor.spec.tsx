import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HorarioEditor, type ScheduleFormData } from '@/components/business/HorarioEditor';

const day = { open: '09:00', close: '23:00', isClosed: false };
const schedule: ScheduleFormData = {
  monday: day, tuesday: day, wednesday: day, thursday: day, friday: day, saturday: day,
  sunday: { open: '00:00', close: '00:00', isClosed: true },
};

describe('HorarioEditor', () => {
  it('submits the edited schedule through onSubmit', async () => {
    const onSubmit = jest.fn();
    render(<HorarioEditor initialData={schedule} onSubmit={onSubmit} onCancel={jest.fn()} />);

    await userEvent.click(screen.getAllByRole('checkbox')[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Guardar horarios' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({ ...schedule, monday: { ...day, isClosed: true } });
  });

  it('does not submit when cancelled', async () => {
    const onSubmit = jest.fn();
    const onCancel = jest.fn();
    render(<HorarioEditor initialData={schedule} onSubmit={onSubmit} onCancel={onCancel} />);

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
