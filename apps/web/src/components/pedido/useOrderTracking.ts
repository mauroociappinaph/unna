import { useEffect, useState } from 'react';
import { getOrderTracking, PublicOrderError, type OrderTracking, type TrackingStatus } from '@/lib/public-order-api';
import { startVisiblePolling } from '@/lib/visible-polling';

export const TRACKING_POLL_MS = 5000;

/** States that never change again: the page stops asking. */
export const FINAL_STATUSES: ReadonlySet<TrackingStatus> = new Set(['delivered', 'cancelled', 'expired', 'payment_failed']);

/**
 * Polls the tracking of a checkout every 5 s while the tab is visible (S17), and stops for good on
 * a final state or an unknown token. Network and server errors keep the last status on screen;
 * before anything loaded they set loadError, cleared by the next successful load (S21).
 */
export function useOrderTracking(token: string) {
  const [tracking, setTracking] = useState<OrderTracking | null>(null);
  const [notFound, setNotFound] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let stop: () => void = () => undefined;
    const load = async () => {
      try {
        const current = await getOrderTracking(token);
        setTracking(current);
        setLoadError(false);
        if (FINAL_STATUSES.has(current.status)) stop();
      } catch (err) {
        if (err instanceof PublicOrderError && err.status === 404) {
          setNotFound(err.message);
          stop();
        } else {
          setLoadError(true);
        }
      }
    };
    stop = startVisiblePolling(load, TRACKING_POLL_MS);
    return () => stop();
  }, [token]);

  return { tracking, notFound, loadError };
}
