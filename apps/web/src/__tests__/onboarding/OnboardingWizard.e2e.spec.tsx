import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';

const validCuit = '20-12345678-6';

// Create a proper mock response
const createMockResponse = (data: unknown, status = 201) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(data),
  headers: new Headers({ 'Content-Type': 'application/json' }),
});

let mockFetchImpl: jest.Mock;

const mockFetch = (data: unknown, status = 201) => {
  mockFetchImpl = jest.fn().mockResolvedValue(createMockResponse(data, status));
  global.fetch = mockFetchImpl;
};

const restoreFetch = () => {
  delete (global as any).fetch;
};

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
});

afterEach(() => {
  restoreFetch();
});

describe('OnboardingWizard - E2E full flow', () => {
  it('completes full onboarding: fiscal -> sucursales -> horarios -> confirm', async () => {
    jest.useFakeTimers();
    mockFetch(
      {
        id: 'biz-123',
        businessName: 'Mi Restaurante',
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123',
      },
      201
    );

    render(<OnboardingWizard />);

    // Step 1: Datos Fiscales
    expect(screen.getAllByText(/datos fiscales/i)).toHaveLength(2);

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/nombre del negocio/i), { target: { value: 'Mi Restaurante' } });
      fireEvent.change(screen.getByLabelText(/cuit/i), { target: { value: validCuit } });
      fireEvent.change(screen.getByLabelText(/calle/i), { target: { value: 'Av. Corrientes' } });
      fireEvent.change(screen.getByLabelText(/número/i), { target: { value: '1234' } });
      fireEvent.change(screen.getByLabelText(/ciudad/i), { target: { value: 'CABA' } });
      fireEvent.change(screen.getByLabelText(/provincia/i), { target: { value: 'CABA' } });
      fireEvent.change(screen.getByLabelText(/código postal/i), { target: { value: '1043' } });
    });

    await act(async () => {
      fireEvent.click(screen.getByText(/siguiente/i));
    });

    await waitFor(() => {
      expect(screen.getByTestId('view-edit')).toBeInTheDocument();
      expect(screen.getByTestId('add-sucursal')).toBeInTheDocument();
    });

    // Step 2: Sucursales - edit principal
    await act(async () => {
      fireEvent.click(screen.getByTestId('view-edit'));
    });

    await act(async () => {
      fireEvent.change(screen.getByTestId('edit-name'), { target: { value: 'Sucursal Principal' } });
      fireEvent.change(screen.getByTestId('edit-phone'), { target: { value: '11 1234 5678' } });
      fireEvent.change(screen.getByTestId('edit-email'), { target: { value: 'principal@test.com' } });
      fireEvent.change(screen.getByTestId('edit-street'), { target: { value: 'Av. Corrientes' } });
      fireEvent.change(screen.getByTestId('edit-number'), { target: { value: '1234' } });
      fireEvent.change(screen.getByTestId('edit-city'), { target: { value: 'CABA' } });
      fireEvent.change(screen.getByTestId('edit-province'), { target: { value: 'CABA' } });
      fireEvent.change(screen.getByTestId('edit-postal-code'), { target: { value: '1043' } });
      fireEvent.click(screen.getByTestId('edit-save'));
    });

    await act(async () => {
      fireEvent.click(screen.getByText(/siguiente/i));
    });

    await waitFor(() => {
      expect(screen.getByTestId('step3-title')).toBeInTheDocument();
    });

    // Step 3: Horarios
    await act(async () => {
      fireEvent.click(screen.getByText(/siguiente/i));
    });

    await waitFor(() => {
      expect(screen.getByText(/revisá tu información/i)).toBeInTheDocument();
    });

    // Step 4: Confirmación
    expect(screen.getByTestId('fiscal-business-name')).toHaveTextContent('Mi Restaurante');
    expect(screen.getByTestId('fiscal-cuit')).toHaveTextContent(validCuit);
    expect(screen.getByTestId('sucursal-0-name')).toHaveTextContent('Sucursal Principal');
    expect(screen.getByTestId('sucursal-0-email')).toHaveTextContent('principal@test.com');

    await act(async () => {
      fireEvent.click(screen.getByTestId('submit-btn'));
      console.log('[DEBUG] submit button clicked, isSubmitting:', screen.getByTestId('submit-btn').disabled);
    });

    // Advance timers to allow React 18 batching + setTimeout to complete
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });

    // Now check success state
    expect(screen.getByTestId('success-state')).toBeInTheDocument();
    expect(localStorage.getItem('auth_token')).toBe('access-token-123');
    expect(localStorage.getItem('refresh_token')).toBe('refresh-token-123');
    
    jest.useRealTimers();
  });

  it('navigates back and forth between steps', async () => {
    render(<OnboardingWizard />);

    await act(async () => {
      fireEvent.click(screen.getByText(/siguiente/i));
    });
    await waitFor(() => expect(screen.getByTestId('view-edit')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByText(/anterior/i));
    });
    await waitFor(() => expect(screen.getByLabelText(/nombre del negocio/i)).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByText(/siguiente/i));
    });
    await waitFor(() => expect(screen.getByTestId('view-edit')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByText(/siguiente/i));
    });
    await waitFor(() => expect(screen.getByTestId('step3-title')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByText(/anterior/i));
    });
    await waitFor(() => expect(screen.getByTestId('view-edit')).toBeInTheDocument());
  });

  it('shows validation error for invalid CUIT', async () => {
    render(<OnboardingWizard />);

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/nombre del negocio/i), { target: { value: 'Mi Restaurante' } });
      fireEvent.change(screen.getByLabelText(/cuit/i), { target: { value: '20-12345678-1' } });
    });

    await waitFor(() => {
      expect(screen.getByText(/cuit inválido/i)).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/calle/i), { target: { value: 'Av. Corrientes' } });
      fireEvent.change(screen.getByLabelText(/número/i), { target: { value: '1234' } });
      fireEvent.change(screen.getByLabelText(/ciudad/i), { target: { value: 'CABA' } });
      fireEvent.change(screen.getByLabelText(/provincia/i), { target: { value: 'CABA' } });
      fireEvent.change(screen.getByLabelText(/código postal/i), { target: { value: '1043' } });
    });

    await act(async () => {
      fireEvent.click(screen.getByText(/siguiente/i));
    });

    await waitFor(() => {
      expect(screen.getByTestId('view-edit')).toBeInTheDocument();
    });
  });

  it('shows API error when business creation fails', async () => {
    mockFetch(
      { message: 'CUIT ya registrado' },
      400
    );

    render(<OnboardingWizard />);

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/nombre del negocio/i), { target: { value: 'Mi Restaurante' } });
      fireEvent.change(screen.getByLabelText(/cuit/i), { target: { value: validCuit } });
      fireEvent.change(screen.getByLabelText(/calle/i), { target: { value: 'Av. Corrientes' } });
      fireEvent.change(screen.getByLabelText(/número/i), { target: { value: '1234' } });
      fireEvent.change(screen.getByLabelText(/ciudad/i), { target: { value: 'CABA' } });
      fireEvent.change(screen.getByLabelText(/provincia/i), { target: { value: 'CABA' } });
      fireEvent.change(screen.getByLabelText(/código postal/i), { target: { value: '1043' } });
    });

    await act(async () => {
      fireEvent.click(screen.getByText(/siguiente/i));
    });
    await act(async () => {
      fireEvent.click(screen.getByText(/siguiente/i));
    });
    await act(async () => {
      fireEvent.click(screen.getByText(/siguiente/i));
    });

    await waitFor(() => {
      expect(screen.getByText(/revisá tu información/i)).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('submit-btn'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toHaveTextContent(/cuit ya registrado/i);
    });

    expect(localStorage.getItem('auth_token')).toBeNull();
  });

  it('shows multiple sucursales section in step 2', async () => {
    render(<OnboardingWizard />);

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/nombre del negocio/i), { target: { value: 'Mi Restaurante' } });
      fireEvent.change(screen.getByLabelText(/cuit/i), { target: { value: validCuit } });
      fireEvent.change(screen.getByLabelText(/calle/i), { target: { value: 'Av. Corrientes' } });
      fireEvent.change(screen.getByLabelText(/número/i), { target: { value: '1234' } });
      fireEvent.change(screen.getByLabelText(/ciudad/i), { target: { value: 'CABA' } });
      fireEvent.change(screen.getByLabelText(/provincia/i), { target: { value: 'CABA' } });
      fireEvent.change(screen.getByLabelText(/código postal/i), { target: { value: '1043' } });
    });

    await act(async () => {
      fireEvent.click(screen.getByText(/siguiente/i));
    });

    await waitFor(() => {
      expect(screen.getByTestId('view-edit')).toBeInTheDocument();
      expect(screen.getByTestId('add-sucursal')).toBeInTheDocument();
    });
  });

  it('configures schedules in step 3', async () => {
    render(<OnboardingWizard />);

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/nombre del negocio/i), { target: { value: 'Mi Restaurante' } });
      fireEvent.change(screen.getByLabelText(/cuit/i), { target: { value: validCuit } });
      fireEvent.change(screen.getByLabelText(/calle/i), { target: { value: 'Av. Corrientes' } });
      fireEvent.change(screen.getByLabelText(/número/i), { target: { value: '1234' } });
      fireEvent.change(screen.getByLabelText(/ciudad/i), { target: { value: 'CABA' } });
      fireEvent.change(screen.getByLabelText(/provincia/i), { target: { value: 'CABA' } });
      fireEvent.change(screen.getByLabelText(/código postal/i), { target: { value: '1043' } });
    });

    await act(async () => {
      fireEvent.click(screen.getByText(/siguiente/i));
    });
    await act(async () => {
      fireEvent.click(screen.getByText(/siguiente/i));
    });

    await waitFor(() => {
      expect(screen.getByTestId('step3-title')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('day-monday-closed'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('day-monday-closed')).toBeChecked();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('copy-monday'));
    });

    await act(async () => {
      fireEvent.click(screen.getByText(/siguiente/i));
    });

    await waitFor(() => {
      expect(screen.getByText(/revisá tu información/i)).toBeInTheDocument();
    });

    // Check that Monday shows "Cerrado" in the confirmation step
    const dayMonday = screen.getByTestId('day-monday');
    expect(dayMonday).toHaveTextContent(/cerrado/i);
  });
});