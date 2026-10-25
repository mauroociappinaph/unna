import { useState } from 'react';
import { apiErrorMessage } from '@/lib/api-errors';

/** Busy flag and error banner shared by every POS action. */
export function usePosTask() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (task: () => Promise<void>, fallback: string) => {
    setBusy(true);
    setError(null);
    try {
      await task();
    } catch (err) {
      setError(apiErrorMessage(err, fallback));
    } finally {
      setBusy(false);
    }
  };

  return { error, setError, busy, setBusy, run };
}

export type PosTask = ReturnType<typeof usePosTask>;
