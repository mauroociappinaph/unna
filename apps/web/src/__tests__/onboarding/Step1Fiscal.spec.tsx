import { render, screen, fireEvent } from '@testing-library/react';
import { Step1Fiscal } from '@/components/onboarding/steps/Step1Fiscal';

const initialData = {
  businessName: '',
  cuit: '',
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
  settings: {
    tradeName: '',
    legalName: '',
    ivaCondition: 'responsable_inscripto' as const,
    iibbNumber: '',
    salePoint: '0001',
    currency: 'ARS' as const,
    timezone: 'America/Argentina/Buenos_Aires',
    language: 'es-AR',
    logoUrl: '',
  },
};

describe('Step1Fiscal', () => {
  let mockOnChange: jest.Mock;

  beforeEach(() => {
    mockOnChange = jest.fn();
  });

  it('renders all required fields', () => {
    render(<Step1Fiscal data={initialData} onChange={mockOnChange} />);

    expect(screen.getByLabelText(/nombre del negocio/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/cuit/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/calle/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/número/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/ciudad/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/provincia/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/código postal/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/país/i)).toBeInTheDocument();
  });

  it('calls onChange with businessName and tradeName when businessName changes', () => {
    render(<Step1Fiscal data={initialData} onChange={mockOnChange} />);

    const input = screen.getByLabelText(/nombre del negocio/i);
    fireEvent.change(input, { target: { value: 'Mi Restaurante' } });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        businessName: 'Mi Restaurante',
        settings: expect.objectContaining({ tradeName: 'Mi Restaurante' }),
      })
    );
  });

  it('formats CUIT input as user types', () => {
    render(<Step1Fiscal data={initialData} onChange={mockOnChange} />);

    const input = screen.getByLabelText(/cuit/i);
    fireEvent.change(input, { target: { value: '20123456786' } });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ cuit: '20-12345678-6' })
    );
  });

  it('validates CUIT check digit and shows error for invalid CUIT', () => {
    render(<Step1Fiscal data={initialData} onChange={mockOnChange} />);

    const input = screen.getByLabelText(/cuit/i);
    fireEvent.change(input, { target: { value: '20-12345678-1' } });

    expect(screen.getByText(/cuit inválido/i)).toBeInTheDocument();
  });

  it('clears CUIT error when valid CUIT is entered', () => {
    render(<Step1Fiscal data={initialData} onChange={mockOnChange} />);

    const input = screen.getByLabelText(/cuit/i);
    fireEvent.change(input, { target: { value: '20-12345678-1' } });
    expect(screen.getByText(/cuit inválido/i)).toBeInTheDocument();

    fireEvent.change(input, { target: { value: '20-12345678-6' } });
    expect(screen.queryByText(/cuit inválido/i)).not.toBeInTheDocument();
  });

  it('updates address fields individually', () => {
    render(<Step1Fiscal data={initialData} onChange={mockOnChange} />);

    fireEvent.change(screen.getByLabelText(/calle/i), { target: { value: 'Av. Corrientes' } });
    expect(mockOnChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        address: expect.objectContaining({ street: 'Av. Corrientes' }),
      })
    );

    fireEvent.change(screen.getByLabelText(/número/i), { target: { value: '1234' } });
    expect(mockOnChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        address: expect.objectContaining({ number: '1234' }),
      })
    );

    fireEvent.change(screen.getByLabelText(/ciudad/i), { target: { value: 'CABA' } });
    expect(mockOnChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        address: expect.objectContaining({ city: 'CABA' }),
      })
    );
  });

  it('updates settings fields individually', () => {
    render(<Step1Fiscal data={initialData} onChange={mockOnChange} />);

    fireEvent.change(screen.getByLabelText(/razón social/i), { target: { value: 'Mi Restaurante S.A.' } });
    expect(mockOnChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        settings: expect.objectContaining({ legalName: 'Mi Restaurante S.A.' }),
      })
    );

    fireEvent.change(screen.getByLabelText(/condición iva/i), { target: { value: 'monotributo' } });
    expect(mockOnChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        settings: expect.objectContaining({ ivaCondition: 'monotributo' }),
      })
    );

    fireEvent.change(screen.getByLabelText(/punto de venta/i), { target: { value: '0002' } });
    expect(mockOnChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        settings: expect.objectContaining({ salePoint: '0002' }),
      })
    );

    fireEvent.change(screen.getByLabelText(/moneda/i), { target: { value: 'USD' } });
    expect(mockOnChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        settings: expect.objectContaining({ currency: 'USD' }),
      })
    );

    fireEvent.change(screen.getByLabelText(/zona horaria/i), { target: { value: 'America/Argentina/Cordoba' } });
    expect(mockOnChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        settings: expect.objectContaining({ timezone: 'America/Argentina/Cordoba' }),
      })
    );

    fireEvent.change(screen.getByLabelText(/idioma/i), { target: { value: 'en-US' } });
    expect(mockOnChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        settings: expect.objectContaining({ language: 'en-US' }),
      })
    );
  });
});