import { render, screen, fireEvent } from '@testing-library/react';
import { Step2Sucursales } from '@/components/onboarding/steps/Step2Sucursales';

const initialSucursales = [
  {
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
    isMain: true,
  },
];

describe('Step2Sucursales', () => {
  let mockOnChange: jest.Mock;

  beforeEach(() => {
    mockOnChange = jest.fn();
  });

  it('renders initial sucursal card with empty state', () => {
    render(<Step2Sucursales data={initialSucursales} onChange={mockOnChange} />);

    expect(screen.getByText(/sin nombre/i)).toBeInTheDocument();
    expect(screen.getByTestId('add-sucursal')).toBeInTheDocument();
  });

  it('enters edit mode when clicking Editar', () => {
    render(<Step2Sucursales data={initialSucursales} onChange={mockOnChange} />);

    fireEvent.click(screen.getByTestId('view-edit'));

    expect(screen.getByTestId('edit-name')).toBeInTheDocument();
    expect(screen.getByTestId('edit-phone')).toBeInTheDocument();
    expect(screen.getByTestId('edit-email')).toBeInTheDocument();
    expect(screen.getByTestId('edit-save')).toBeInTheDocument();
    expect(screen.getByTestId('edit-cancel-top')).toBeInTheDocument();
  });

  it('updates sucursal fields in edit mode', () => {
    render(<Step2Sucursales data={initialSucursales} onChange={mockOnChange} />);

    fireEvent.click(screen.getByTestId('view-edit'));

    fireEvent.change(screen.getByTestId('edit-name'), { target: { value: 'Sucursal Palermo' } });
    expect(mockOnChange).toHaveBeenLastCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Sucursal Palermo' }),
      ])
    );

    fireEvent.change(screen.getByTestId('edit-phone'), { target: { value: '11 5555 4444' } });
    expect(mockOnChange).toHaveBeenLastCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ phone: '11 5555 4444' }),
      ])
    );

    fireEvent.change(screen.getByTestId('edit-email'), { target: { value: 'palermo@test.com' } });
    expect(mockOnChange).toHaveBeenLastCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ email: 'palermo@test.com' }),
      ])
    );

    fireEvent.click(screen.getByTestId('edit-save'));
  });

  it('updates address fields in edit mode', () => {
    render(<Step2Sucursales data={initialSucursales} onChange={mockOnChange} />);

    fireEvent.click(screen.getByTestId('view-edit'));

    fireEvent.change(screen.getByTestId('edit-street'), { target: { value: 'Av. Santa Fe' } });
    expect(mockOnChange).toHaveBeenLastCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          address: expect.objectContaining({ street: 'Av. Santa Fe' }),
        }),
      ])
    );

    fireEvent.change(screen.getByTestId('edit-number'), { target: { value: '2000' } });
    expect(mockOnChange).toHaveBeenLastCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          address: expect.objectContaining({ number: '2000' }),
        }),
      ])
    );

    fireEvent.change(screen.getByTestId('edit-floor'), { target: { value: '5' } });
    expect(mockOnChange).toHaveBeenLastCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          address: expect.objectContaining({ floor: '5' }),
        }),
      ])
    );

    fireEvent.change(screen.getByTestId('edit-city'), { target: { value: 'CABA' } });
    expect(mockOnChange).toHaveBeenLastCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          address: expect.objectContaining({ city: 'CABA' }),
        }),
      ])
    );

    fireEvent.change(screen.getByTestId('edit-province'), { target: { value: 'CABA' } });
    expect(mockOnChange).toHaveBeenLastCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          address: expect.objectContaining({ province: 'CABA' }),
        }),
      ])
    );

    fireEvent.change(screen.getByTestId('edit-postal-code'), { target: { value: '1425' } });
    expect(mockOnChange).toHaveBeenLastCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          address: expect.objectContaining({ postalCode: '1425' }),
        }),
      ])
    );

    fireEvent.click(screen.getByTestId('edit-save'));
  });

  it('adds a new sucursal when clicking Agregar sucursal', () => {
    render(<Step2Sucursales data={initialSucursales} onChange={mockOnChange} />);

    fireEvent.click(screen.getByTestId('add-sucursal'));

    expect(mockOnChange).toHaveBeenCalledWith([
      expect.objectContaining({ isMain: true }),
      expect.objectContaining({ isMain: false }),
    ]);
  });

  it('removes a sucursal when there are multiple', () => {
    const twoSucursales = [
      { ...initialSucursales[0], name: 'Principal', isMain: true },
      { ...initialSucursales[0], name: 'Secundaria', isMain: false },
    ];

    render(<Step2Sucursales data={twoSucursales} onChange={mockOnChange} />);

    fireEvent.click(screen.getAllByTestId('view-delete')[0]);

    expect(mockOnChange).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'Secundaria', isMain: true }),
    ]);
  });

  it('toggles main sucursal', () => {
    const twoSucursales = [
      { ...initialSucursales[0], name: 'Principal', isMain: true },
      { ...initialSucursales[0], name: 'Secundaria', isMain: false },
    ];

    render(<Step2Sucursales data={twoSucursales} onChange={mockOnChange} />);

    fireEvent.click(screen.getAllByTestId('view-make-main')[0]);

    expect(mockOnChange).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'Principal', isMain: false }),
      expect.objectContaining({ name: 'Secundaria', isMain: true }),
    ]);
  });

  it('shows and hides schedule when clicking Ver/Ocultar horarios', () => {
    render(<Step2Sucursales data={initialSucursales} onChange={mockOnChange} />);

    expect(screen.queryByText(/horarios de atención/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('view-toggle-schedule'));

    expect(screen.getByText(/horarios de atención/i)).toBeInTheDocument();
    expect(screen.getByTestId('schedule-monday-closed')).toBeInTheDocument();
    expect(screen.getByTestId('schedule-sunday-closed')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('view-toggle-schedule'));

    expect(screen.queryByText(/horarios de atención/i)).not.toBeInTheDocument();
  });

  it('updates schedule when editing in view mode', () => {
    const sucursalWithSchedule = [{
      ...initialSucursales[0],
      schedule: {
        monday: { open: '09:00', close: '23:00', isClosed: false },
        tuesday: { open: '09:00', close: '23:00', isClosed: false },
        wednesday: { open: '09:00', close: '23:00', isClosed: false },
        thursday: { open: '09:00', close: '23:00', isClosed: false },
        friday: { open: '09:00', close: '23:00', isClosed: false },
        saturday: { open: '09:00', close: '23:00', isClosed: false },
        sunday: { open: '00:00', close: '00:00', isClosed: true },
      },
    }];

    render(<Step2Sucursales data={sucursalWithSchedule} onChange={mockOnChange} />);

    fireEvent.click(screen.getByTestId('view-toggle-schedule'));

    const mondayCheckbox = screen.getByTestId('schedule-monday-closed');
    fireEvent.click(mondayCheckbox);

    expect(mockOnChange).toHaveBeenCalledWith([
      expect.objectContaining({
        schedule: expect.objectContaining({
          monday: expect.objectContaining({ isClosed: true }),
        }),
      }),
    ]);
  });
});