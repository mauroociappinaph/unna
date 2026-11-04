import { render, screen, fireEvent } from '@testing-library/react';
import { Step4Confirmacion } from '@/components/onboarding/steps/Step4Confirmacion';

const completeData = {
  businessName: 'Mi Restaurante',
  cuit: '20-12345678-6',
  address: {
    street: 'Av. Corrientes',
    number: '1234',
    floor: '5',
    apartment: 'A',
    neighborhood: 'Balvanera',
    city: 'CABA',
    province: 'CABA',
    postalCode: '1043',
    country: 'Argentina',
  },
  schedule: {
    monday: { open: '09:00', close: '23:00', isClosed: false },
    tuesday: { open: '09:00', close: '23:00', isClosed: false },
    wednesday: { open: '09:00', close: '23:00', isClosed: false },
    thursday: { open: '09:00', close: '23:00', isClosed: false },
    friday: { open: '09:00', close: '23:00', isClosed: false },
    saturday: { open: '09:00', close: '23:00', isClosed: false },
    sunday: { open: '00:00', close: '00:00', isClosed: true },
  },
  settings: {
    tradeName: 'Mi Restaurante',
    legalName: 'Mi Restaurante S.A.',
    ivaCondition: 'responsable_inscripto' as const,
    iibbNumber: '12345678',
    salePoint: '0001',
    currency: 'ARS' as const,
    timezone: 'America/Argentina/Buenos_Aires',
    language: 'es-AR',
    logoUrl: 'https://example.com/logo.png',
  },
  sucursales: [
    {
      name: 'Sucursal Principal',
      address: {
        street: 'Av. Corrientes',
        number: '1234',
        floor: '5',
        apartment: 'A',
        neighborhood: 'Balvanera',
        city: 'CABA',
        province: 'CABA',
        postalCode: '1043',
        country: 'Argentina',
      },
      phone: '11 1234 5678',
      email: 'principal@test.com',
      isMain: true,
    },
    {
      name: 'Sucursal Palermo',
      address: {
        street: 'Av. Santa Fe',
        number: '2000',
        floor: '',
        apartment: '',
        neighborhood: 'Palermo',
        city: 'CABA',
        province: 'CABA',
        postalCode: '1425',
        country: 'Argentina',
      },
      phone: '11 5555 4444',
      email: 'palermo@test.com',
      isMain: false,
    },
  ],
};

const mockOnSubmit = jest.fn();

describe('Step4Confirmacion', () => {
  it('renders all sections when not submitting', () => {
    render(
      <Step4Confirmacion
        data={completeData}
        onSubmit={mockOnSubmit}
        isSubmitting={false}
        submitError={null}
        submitSuccess={false}
      />
    );

    expect(screen.getByTestId('confirmation-form')).toBeInTheDocument();
    expect(screen.getByTestId('section-fiscal')).toBeInTheDocument();
    expect(screen.getByTestId('section-sucursales')).toBeInTheDocument();
    expect(screen.getByTestId('section-schedule')).toBeInTheDocument();
    expect(screen.getByTestId('section-settings')).toBeInTheDocument();
  });

  it('shows fiscal data correctly', () => {
    render(
      <Step4Confirmacion
        data={completeData}
        onSubmit={mockOnSubmit}
        isSubmitting={false}
        submitError={null}
        submitSuccess={false}
      />
    );

    expect(screen.getByTestId('fiscal-business-name')).toHaveTextContent('Mi Restaurante');
    expect(screen.getByTestId('fiscal-cuit')).toHaveTextContent('20-12345678-6');
    expect(screen.getByTestId('fiscal-address')).toHaveTextContent(/av\. corrientes,?\s*1234/i);
    expect(screen.getByTestId('fiscal-address')).toHaveTextContent(/piso 5/i);
    expect(screen.getByTestId('fiscal-address')).toHaveTextContent(/dpto a/i);
    expect(screen.getByTestId('fiscal-iva')).toHaveTextContent(/responsable inscripto/i);
    expect(screen.getByTestId('fiscal-sale-point')).toHaveTextContent('0001');
    expect(screen.getByTestId('fiscal-currency')).toHaveTextContent('ARS - Peso Argentino');
  });

  it('shows sucursales with correct info', () => {
    render(
      <Step4Confirmacion
        data={completeData}
        onSubmit={mockOnSubmit}
        isSubmitting={false}
        submitError={null}
        submitSuccess={false}
      />
    );

    expect(screen.getByTestId('sucursal-0-name')).toHaveTextContent('Sucursal Principal');
    expect(screen.getByTestId('sucursal-1-name')).toHaveTextContent('Sucursal Palermo');
    expect(screen.getByTestId('sucursal-0-email')).toHaveTextContent('principal@test.com');
    expect(screen.getByTestId('sucursal-1-email')).toHaveTextContent('palermo@test.com');
    expect(screen.getByTestId('sucursal-0-type')).toHaveTextContent(/sucursal principal/i);
    expect(screen.getByTestId('sucursal-1-type')).toHaveTextContent(/sucursal secundaria/i);
  });

  it('shows schedule correctly formatted', () => {
    render(
      <Step4Confirmacion
        data={completeData}
        onSubmit={mockOnSubmit}
        isSubmitting={false}
        submitError={null}
        submitSuccess={false}
      />
    );

    expect(screen.getByTestId('day-monday')).toBeInTheDocument();
    expect(screen.getByTestId('day-monday-status')).toHaveTextContent('Abierto');
    expect(screen.getByTestId('day-monday-hours')).toHaveTextContent('09:00 - 23:00');
    expect(screen.getByTestId('day-sunday')).toBeInTheDocument();
    expect(screen.getByTestId('day-sunday-status')).toHaveTextContent('Cerrado');
  });

  it('shows settings correctly', () => {
    render(
      <Step4Confirmacion
        data={completeData}
        onSubmit={mockOnSubmit}
        isSubmitting={false}
        submitError={null}
        submitSuccess={false}
      />
    );

    expect(screen.getByTestId('setting-currency')).toHaveTextContent('ARS - Peso Argentino');
    expect(screen.getByTestId('setting-timezone')).toHaveTextContent('America/Argentina/Buenos_Aires');
    expect(screen.getByTestId('setting-language')).toHaveTextContent('es-AR');
  });

  it('calls onSubmit when clicking confirm button', () => {
    render(
      <Step4Confirmacion
        data={completeData}
        onSubmit={mockOnSubmit}
        isSubmitting={false}
        submitError={null}
        submitSuccess={false}
      />
    );

    fireEvent.click(screen.getByTestId('submit-btn'));

    expect(mockOnSubmit).toHaveBeenCalledTimes(1);
  });

  it('disables confirm button when submitting', () => {
    render(
      <Step4Confirmacion
        data={completeData}
        onSubmit={mockOnSubmit}
        isSubmitting={true}
        submitError={null}
        submitSuccess={false}
      />
    );

    expect(screen.getByTestId('submit-btn')).toBeDisabled();
  });

  it('shows error message when submitError is provided', () => {
    render(
      <Step4Confirmacion
        data={completeData}
        onSubmit={mockOnSubmit}
        isSubmitting={false}
        submitError="Error al crear el negocio"
        submitSuccess={false}
      />
    );

    expect(screen.getByTestId('error-message')).toHaveTextContent(/error al crear el negocio/i);
  });

  it('shows success state when submitSuccess is true', () => {
    render(
      <Step4Confirmacion
        data={completeData}
        onSubmit={mockOnSubmit}
        isSubmitting={false}
        submitError={null}
        submitSuccess={true}
      />
    );

    expect(screen.getByTestId('success-state')).toBeInTheDocument();
    expect(screen.getByTestId('success-state')).toHaveTextContent(/onboarding completado/i);
  });
});