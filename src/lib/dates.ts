import type { Application } from './types';

const DAY = 86_400_000;

/** Monday 00:00 local time of the week containing `now`. */
export function startOfWeek(now = new Date()): number {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const offset = (d.getDay() + 6) % 7;
  return d.getTime() - offset * DAY;
}

export function startOfDay(now = new Date()): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

export function sentSince(apps: Application[], since: number): number {
  return apps.filter((a) => a.appliedAt != null && a.appliedAt >= since).length;
}

export function relativeDay(t: number, now = Date.now()): string {
  const days = Math.floor((startOfDay(new Date(now)) - startOfDay(new Date(t))) / DAY);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: days > 300 ? 'numeric' : undefined });
}

export const isStale = (lastBackupAt: number | undefined, days = 7) => !lastBackupAt || Date.now() - lastBackupAt > days * DAY;
