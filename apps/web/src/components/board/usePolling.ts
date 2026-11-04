import { useEffect, useRef } from 'react';
import { startVisiblePolling } from '@/lib/visible-polling';

/**
 * Runs the task now and then every intervalMs until unmount. A tick is skipped
 * while the previous run is still in flight, so slow responses never pile up.
 * Paused while the tab is hidden; it refreshes as soon as the tab is visible again (S17).
 */
export function usePolling(task: () => Promise<void>, intervalMs: number) {
  const taskRef = useRef(task);

  useEffect(() => {
    taskRef.current = task;
  }, [task]);

  useEffect(() => startVisiblePolling(() => taskRef.current(), intervalMs), [intervalMs]);
}
