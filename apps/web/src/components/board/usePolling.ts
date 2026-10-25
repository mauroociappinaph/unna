import { useEffect, useRef } from 'react';

/**
 * Runs the task now and then every intervalMs until unmount. A tick is skipped
 * while the previous run is still in flight, so slow responses never pile up.
 */
export function usePolling(task: () => Promise<void>, intervalMs: number) {
  const taskRef = useRef(task);
  const inFlight = useRef(false);

  useEffect(() => {
    taskRef.current = task;
  }, [task]);

  useEffect(() => {
    const tick = async () => {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        await taskRef.current();
      } finally {
        inFlight.current = false;
      }
    };
    tick();
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}
