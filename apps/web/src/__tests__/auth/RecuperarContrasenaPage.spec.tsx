import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from '@/app/login/page';
import RecuperarContrasenaPage from '@/app/recuperar-contrasena/page';
import { api } from '@/lib/api';

let query = '';
const paramsByQuery = new Map<string, URLSearchParams>();
jest.mock('next/navigation', () => ({
  useSearchParams: () => {
    if (!paramsByQuery.has(query)) paramsByQuery.set(query, new URLSearchParams(query));
    return paramsByQuery.get(query);
  },
}));
jest.mock('@/lib/api', () => ({ api: { forgotPassword: jest.fn(), resetPassword: jest.fn() } }));

const mocked = api as jest.Mocked<typeof api>;
const apiError = (message: string | string[]) => ({ response: { status: 400, data: { message } } });

const FORGOT_MESSAGE = 'Si el email existe, recibirás un link para restablecer tu contraseña.';
const RESET_MESSAGE = 'Contraseña actualizada correctamente. Ya podés iniciar sesión.';
const PASSWORD_RULE = 'Debe contener mínimo 8 caracteres, mayúsculas, minúsculas y un número.';

function renderPage(search = '') {
  query = search;
  const user = userEvent.setup();
  render(<RecuperarContrasenaPage />);
  return user;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Recuperar contraseña page', () => {
  it('is linked from the login page', () => {
    render(<LoginPage />);

    expect(screen.getByRole('link', { name: '¿Olvidaste tu contraseña?' })).toHaveAttribute('href', '/recuperar-contrasena');
  });

  describe('without a token', () => {
    it('posts the email and shows the API message', async () => {
      mocked.forgotPassword.mockResolvedValue({ message: FORGOT_MESSAGE });
      const user = renderPage();

      await user.type(screen.getByLabelText(/Email/), 'ana@gmail.com');
      await user.click(screen.getByRole('button', { name: 'Enviar link' }));

      expect(await screen.findByRole('status')).toHaveTextContent(FORGOT_MESSAGE);
      expect(mocked.forgotPassword).toHaveBeenCalledTimes(1);
      expect(mocked.forgotPassword).toHaveBeenCalledWith({ email: 'ana@gmail.com' });
      expect(mocked.resetPassword).not.toHaveBeenCalled();
    });

    it('does not post an invalid email', async () => {
      const user = renderPage();

      await user.type(screen.getByLabelText(/Email/), 'ana');
      await user.click(screen.getByRole('button', { name: 'Enviar link' }));

      expect(await screen.findByText('Ingresá un e-mail válido. Ej.: nombre@gmail.com')).toBeInTheDocument();
      expect(mocked.forgotPassword).not.toHaveBeenCalled();
    });

    it('shows the backend error', async () => {
      mocked.forgotPassword.mockRejectedValue(apiError(['Ingresá un e-mail válido. Ej.: nombre@gmail.com']));
      const user = renderPage();

      await user.type(screen.getByLabelText(/Email/), 'ana@gmail.com');
      await user.click(screen.getByRole('button', { name: 'Enviar link' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Ingresá un e-mail válido. Ej.: nombre@gmail.com');
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });

  describe('with a token', () => {
    it('posts the token and the new password, then links to the login', async () => {
      mocked.resetPassword.mockResolvedValue({ message: RESET_MESSAGE });
      const user = renderPage('?token=tok-123');

      await user.type(screen.getByLabelText(/^Nueva contraseña/), 'NuevaClave1');
      await user.type(screen.getByLabelText(/^Repetí la contraseña/), 'NuevaClave1');
      await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));

      expect(await screen.findByRole('status')).toHaveTextContent(RESET_MESSAGE);
      expect(mocked.resetPassword).toHaveBeenCalledTimes(1);
      expect(mocked.resetPassword).toHaveBeenCalledWith({ token: 'tok-123', password: 'NuevaClave1', confirmPassword: 'NuevaClave1' });
      expect(screen.getByRole('link', { name: 'Ir a iniciar sesión' })).toHaveAttribute('href', '/login');
      expect(screen.queryByRole('button', { name: 'Cambiar contraseña' })).not.toBeInTheDocument();
      expect(mocked.forgotPassword).not.toHaveBeenCalled();
    });

    it('applies the password rules of the registration and does not post', async () => {
      const user = renderPage('?token=tok-123');

      await user.type(screen.getByLabelText(/^Nueva contraseña/), 'corta');
      await user.type(screen.getByLabelText(/^Repetí la contraseña/), 'otra');
      await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));

      expect(await screen.findByText(PASSWORD_RULE)).toBeInTheDocument();
      expect(screen.getByText('Las contraseñas no coinciden.')).toBeInTheDocument();
      expect(mocked.resetPassword).not.toHaveBeenCalled();
    });

    it('shows the backend error for an invalid token', async () => {
      mocked.resetPassword.mockRejectedValue(apiError('Token inválido o expirado'));
      const user = renderPage('?token=vencido');

      await user.type(screen.getByLabelText(/^Nueva contraseña/), 'NuevaClave1');
      await user.type(screen.getByLabelText(/^Repetí la contraseña/), 'NuevaClave1');
      await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Token inválido o expirado');
      await waitFor(() => expect(screen.getByRole('button', { name: 'Cambiar contraseña' })).toBeEnabled());
      expect(screen.queryByRole('link', { name: 'Ir a iniciar sesión' })).not.toBeInTheDocument();
    });
  });
});
