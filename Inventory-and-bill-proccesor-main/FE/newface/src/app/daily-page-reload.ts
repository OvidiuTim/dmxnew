/**
 * Reîncarcă o pagină de terminal o singură dată pe zi, la ora locală indicată.
 * Returnează o funcție de anulare pentru ngOnDestroy.
 */
export function scheduleDailyPageReload(hour = 3, minute = 0): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const now = new Date();
  const nextReload = new Date(now);
  nextReload.setHours(hour, minute, 0, 0);
  if (nextReload.getTime() <= now.getTime()) {
    nextReload.setDate(nextReload.getDate() + 1);
  }

  const timeoutId = window.setTimeout(() => window.location.reload(), nextReload.getTime() - now.getTime());
  return () => window.clearTimeout(timeoutId);
}
