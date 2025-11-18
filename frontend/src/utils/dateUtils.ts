/**
 * Normalizes various timestamp formats from the blockchain to Unix seconds
 * Handles: number (seconds or milliseconds), ISO string, TimePointSec object
 */
export function normalizeTimestamp(value: any): number {
  if (typeof value === 'number') {
    // If it's a large number (> 1e12), it's likely milliseconds
    return value > 1e12 ? Math.floor(value / 1000) : value;
  } else if (typeof value === 'string') {
    // ISO string format
    return Math.floor(new Date(value + 'Z').getTime() / 1000);
  } else if (value?.seconds) {
    // TimePointSec object with seconds field
    return value.seconds;
  } else if (value?.sec_since_epoch) {
    // TimePointSec object with sec_since_epoch field
    return value.sec_since_epoch;
  }
  return 0;
}

/**
 * Formats a Unix timestamp (seconds) to a Date object
 * Returns null if timestamp is invalid
 */
export function timestampToDate(seconds: number): Date | null {
  if (!seconds || seconds <= 0) return null;
  return new Date(seconds * 1000);
}

/**
 * Gets the expiry label for a market
 */
export function getExpiryLabel(resolved: boolean, expireSeconds: number): string {
  if (resolved) return 'Resolved';
  const date = timestampToDate(expireSeconds);
  if (!date) return 'Unknown';
  return date.getTime() < Date.now() ? 'Expired' : 'Expires';
}

/**
 * Formats a Unix timestamp (seconds) to a localized date string
 * Returns '—' if timestamp is invalid
 */
export function formatDate(seconds: number, includeTime: boolean = false): string {
  const date = timestampToDate(seconds);
  if (!date) return '—';
  return includeTime ? date.toLocaleString() : date.toLocaleDateString();
}
