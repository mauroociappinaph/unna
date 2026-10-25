import { render, screen } from '@testing-library/react';
import { BarTicketCard } from '@/components/bar/BarTicketCard';
import type { BarTicket } from '@/lib/order-board-api';
import shapes from '../fixtures/api-shapes.json';

const ticket = shapes['GET bar-queue (preparing + ready)'].body.preparing[0] as BarTicket;
const created = new Date(ticket.createdAt).getTime();
const minutes = (n: number) => created + n * 60_000;

const renderAt = (now: number) => render(<BarTicketCard ticket={ticket} now={now} actionLabel="Listo" busy={false} onAction={jest.fn()} />);

describe('BarTicketCard elapsed time', () => {
  it('shows the minutes since the order was created', () => {
    renderAt(minutes(4) + 30_000);

    expect(screen.getByText('hace 4 min')).toBeInTheDocument();
    expect(screen.queryByText('Demorado')).not.toBeInTheDocument();
  });

  it('does not flag a ticket at exactly 10 minutes', () => {
    renderAt(minutes(10));

    expect(screen.getByText('hace 10 min')).toBeInTheDocument();
    expect(screen.queryByText('Demorado')).not.toBeInTheDocument();
  });

  it('flags a ticket older than 10 minutes', () => {
    renderAt(minutes(12));

    expect(screen.getByText('hace 12 min')).toBeInTheDocument();
    expect(screen.getByText('Demorado')).toBeInTheDocument();
  });

  it('says "recién" during the first minute', () => {
    renderAt(minutes(0) + 20_000);

    expect(screen.getByText('recién')).toBeInTheDocument();
  });
});
