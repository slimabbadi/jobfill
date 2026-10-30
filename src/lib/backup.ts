import type { Application } from './types';
import { STATUS_LABEL, STATUSES } from './types';
import { getAll, getSettings, replaceAll, saveSettings } from './store';

const FORMAT = 'jobfill-backup';

export async function backupJson(): Promise<string> {
  const data = await getAll();
  return JSON.stringify({ format: FORMAT, version: 1, exportedAt: new Date().toISOString(), ...data }, null, 2);
}

export async function markBackedUp(): Promise<void> {
  await saveSettings({ ...(await getSettings()), lastBackupAt: Date.now() });
}

export function backupFileName(date = new Date()): string {
  return `jobfill-backup-${date.toISOString().slice(0, 10)}.json`;
}

/** Replace everything with a backup's contents. Throws with a readable message on bad input. */
export async function restoreJson(text: string): Promise<{ applications: number; answers: number }> {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('This file isn’t valid JSON. Choose a file exported from Jobfill.');
  }
  if (parsed.format !== FORMAT) throw new Error('This file isn’t a Jobfill backup.');
  const applications = Array.isArray(parsed.applications) ? (parsed.applications as Application[]) : [];
  const answers = Array.isArray(parsed.answers) ? parsed.answers : [];
  const valid = applications.every((a) => a && typeof a.id === 'string' && STATUSES.includes(a.status));
  if (!valid) throw new Error('The backup’s application list is damaged, so nothing was changed.');
  const current = await getAll();
  await replaceAll({
    profile: (parsed.profile as typeof current.profile) ?? {},
    resume: (parsed.resume as typeof current.resume) ?? null,
    coverLetter: (parsed.coverLetter as typeof current.coverLetter) ?? null,
    answers,
    applications,
    settings: { ...current.settings, ...(parsed.settings as object), lastBackupAt: current.settings.lastBackupAt },
  });
  return { applications: applications.length, answers: answers.length };
}

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const day = (t?: number) => (t ? new Date(t).toISOString().slice(0, 10) : '');

export function applicationsCsv(apps: Application[]): string {
  const header = ['Company', 'Title', 'Location', 'Status', 'Applied', 'Added', 'Source', 'URL', 'Notes'];
  const rows = apps.map((a) => [
    a.company,
    a.title,
    a.location,
    STATUS_LABEL[a.status],
    day(a.appliedAt),
    day(a.createdAt),
    a.source,
    a.url,
    a.notes,
  ]);
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}

export function downloadText(text: string, filename: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
