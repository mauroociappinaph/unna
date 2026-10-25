import { render, screen } from '@testing-library/react';
import DashboardPage from '@/app/dashboard/page';

const router = { push: jest.fn() };
jest.mock('next/navigation', () => ({ useRouter: () => router }));

describe('Dashboard home', () => {
  it('links to the barra', () => {
    localStorage.setItem('auth_token', 'token');
    render(<DashboardPage />);

    expect(screen.getByRole('link', { name: /Barra/ })).toHaveAttribute('href', '/dashboard/barra');
  });
});
