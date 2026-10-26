import { act, render } from '@testing-library/react';
import { usePolling } from '@/components/board/usePolling';

let visibility: DocumentVisibilityState = 'visible';

const setVisibility = async (state: DocumentVisibilityState) => {
  visibility = state;
  await act(async () => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
};

const advance = async (ms: number) => {
  await act(async () => { jest.advanceTimersByTime(ms); });
};

function Poller({ task }: { task: () => Promise<void> }) {
  usePolling(task, 5000);
  return null;
}

beforeAll(() => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
});

beforeEach(() => {
  visibility = 'visible';
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('usePolling (S17)', () => {
  it('pauses while the tab is hidden and refreshes immediately when it is visible again', async () => {
    const task = jest.fn().mockResolvedValue(undefined);
    render(<Poller task={task} />);
    expect(task).toHaveBeenCalledTimes(1);

    await setVisibility('hidden');
    await advance(20000);
    expect(task).toHaveBeenCalledTimes(1);

    await setVisibility('visible');
    expect(task).toHaveBeenCalledTimes(2);
    await advance(5000);
    expect(task).toHaveBeenCalledTimes(3);
  });

  it('does not poll after unmount, even when the tab becomes visible', async () => {
    const task = jest.fn().mockResolvedValue(undefined);
    const { unmount } = render(<Poller task={task} />);

    unmount();
    await setVisibility('hidden');
    await setVisibility('visible');
    await advance(20000);

    expect(task).toHaveBeenCalledTimes(1);
  });

  it('still skips a tick while the previous request is in flight', async () => {
    let finish!: () => void;
    const task = jest.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    render(<Poller task={task} />);

    await advance(10000);
    await setVisibility('hidden');
    await setVisibility('visible');
    expect(task).toHaveBeenCalledTimes(1);

    await act(async () => { finish(); });
    await advance(5000);
    expect(task).toHaveBeenCalledTimes(2);
  });
});
