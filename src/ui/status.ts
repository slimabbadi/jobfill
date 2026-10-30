import type { Status } from '@/lib/types';

export const statusColor = (s: Status) => `var(--s-${s})`;
