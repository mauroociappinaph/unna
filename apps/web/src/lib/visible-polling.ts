interface Options {
  /** Run the task right away instead of waiting for the first interval. */
  immediate?: boolean;
}

/**
 * Runs the task every intervalMs while the tab is visible (S17). Hiding the tab pauses
 * the polling; showing it again runs the task at once and restarts the interval. A tick
 * is skipped while the previous run is still in flight, so slow responses never pile up.
 * Returns the function that stops the polling.
 */
export function startVisiblePolling(task: () => Promise<void>, intervalMs: number, { immediate = true }: Options = {}): () => void {
  let inFlight = false;
  let timer: ReturnType<typeof setInterval> | null = null;

  const tick = async () => {
    if (inFlight) return;
    inFlight = true;
    try {
      await task();
    } finally {
      inFlight = false;
    }
  };
  const resume = () => {
    if (timer === null) timer = setInterval(tick, intervalMs);
  };
  const pause = () => {
    if (timer === null) return;
    clearInterval(timer);
    timer = null;
  };
  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') return pause();
    if (timer !== null) return;
    tick();
    resume();
  };

  if (document.visibilityState !== 'hidden') {
    if (immediate) tick();
    resume();
  }
  document.addEventListener('visibilitychange', onVisibilityChange);
  return () => {
    pause();
    document.removeEventListener('visibilitychange', onVisibilityChange);
  };
}
