import { browser } from 'wxt/browser';
import type { Application, JobInfo, Profile, Resume, SavedAnswer, Settings, Status } from './types';
import { DEFAULT_SETTINGS, STATUSES } from './types';
import { norm } from './text';

/**
 * All data lives in extension local storage on this machine. Nothing is sent anywhere.
 * Keys are split so saving a profile doesn't rewrite the (possibly large) resume.
 */
interface Shape {
  profile: Profile;
  resume: Resume | null;
  /** Anschreiben: German applications often require one as a separate upload */
  coverLetter: Resume | null;
  answers: SavedAnswer[];
  applications: Application[];
  settings: Settings;
}

const DEFAULTS: Shape = {
  profile: {},
  resume: null,
  coverLetter: null,
  answers: [],
  applications: [],
  settings: DEFAULT_SETTINGS,
};

async function get<K extends keyof Shape>(key: K): Promise<Shape[K]> {
  const result = await browser.storage.local.get(key);
  const value = result[key] as Shape[K] | undefined;
  if (key === 'settings') return { ...DEFAULT_SETTINGS, ...(value as Settings | undefined) } as Shape[K];
  return value ?? structuredClone(DEFAULTS[key]);
}

async function set<K extends keyof Shape>(key: K, value: Shape[K]): Promise<void> {
  await browser.storage.local.set({ [key]: value });
}

export const id = () => crypto.randomUUID();

export const getProfile = () => get('profile');
export const saveProfile = (p: Profile) => set('profile', p);
export const getResume = () => get('resume');
export const saveResume = (r: Resume | null) => set('resume', r);
export const getCoverLetter = () => get('coverLetter');
export const saveCoverLetter = (r: Resume | null) => set('coverLetter', r);
export const getAnswers = () => get('answers');
export const saveAnswers = (a: SavedAnswer[]) => set('answers', a);
export const getApplications = () => get('applications');
export const saveApplications = (a: Application[]) => set('applications', a);
export const getSettings = () => get('settings');
export const saveSettings = (s: Settings) => set('settings', s);

export async function getAll(): Promise<Shape> {
  const [profile, resume, coverLetter, answers, applications, settings] = await Promise.all([
    getProfile(),
    getResume(),
    getCoverLetter(),
    getAnswers(),
    getApplications(),
    getSettings(),
  ]);
  return { profile, resume, coverLetter, answers, applications, settings };
}

export async function replaceAll(data: Shape): Promise<void> {
  await browser.storage.local.set(data);
}

/** Re-run `fn` whenever any stored key changes (from this page, the popup, or a tab). */
export function onChange(fn: () => void): () => void {
  const listener = (_: unknown, area: string) => {
    if (area === 'local') fn();
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}

function sameJob(a: Application, job: Pick<JobInfo, 'urlKey' | 'company' | 'title'>): boolean {
  if (job.urlKey && a.urlKey === job.urlKey) return true;
  return !!job.company && !!job.title && norm(a.company) === norm(job.company) && norm(a.title) === norm(job.title);
}

export function findApplication(apps: Application[], job: Pick<JobInfo, 'urlKey' | 'company' | 'title'>) {
  return apps.find((a) => sameJob(a, job));
}

const rank = (s: Status) => STATUSES.indexOf(s);

/**
 * Record a job at `status`. An existing record only moves forward (saved -> filled ->
 * applied), so filling a form you already applied to doesn't demote it.
 */
export async function recordJob(job: JobInfo, status: Status): Promise<Application> {
  const apps = await getApplications();
  const now = Date.now();
  const existing = findApplication(apps, job);
  if (existing) {
    const forward = rank(status) > rank(existing.status) && rank(existing.status) < rank('applied');
    if (forward) {
      existing.status = status;
      existing.history.push({ status, at: now });
      if (status === 'applied') existing.appliedAt = now;
    }
    existing.company ||= job.company;
    existing.title ||= job.title;
    existing.location ||= job.location;
    existing.updatedAt = now;
    await saveApplications(apps);
    return existing;
  }
  const app: Application = {
    id: id(),
    ...job,
    status,
    appliedAt: status === 'applied' ? now : undefined,
    createdAt: now,
    updatedAt: now,
    notes: '',
    history: [{ status, at: now }],
  };
  await saveApplications([app, ...apps]);
  return app;
}

export async function updateApplication(appId: string, patch: Partial<Application>): Promise<void> {
  const apps = await getApplications();
  const app = apps.find((a) => a.id === appId);
  if (!app) return;
  const now = Date.now();
  if (patch.status && patch.status !== app.status) {
    app.history.push({ status: patch.status, at: now });
    if (patch.status === 'applied' && !app.appliedAt && !patch.appliedAt) app.appliedAt = now;
  }
  Object.assign(app, patch, { updatedAt: now });
  await saveApplications(apps);
}

export async function deleteApplication(appId: string): Promise<void> {
  await saveApplications((await getApplications()).filter((a) => a.id !== appId));
}

/** Add or update answers by question; the most recent answer to a question wins. */
export async function learnAnswers(found: { question: string; answer: string }[], company: string): Promise<number> {
  if (!found.length) return 0;
  const answers = await getAnswers();
  let changed = 0;
  for (const f of found) {
    const existing = answers.find((a) => norm(a.question) === norm(f.question));
    if (existing) {
      if (existing.answer === f.answer) continue;
      existing.answer = f.answer;
      existing.learnedFrom = company;
      existing.updatedAt = Date.now();
    } else {
      answers.push({ id: id(), question: f.question, answer: f.answer, learnedFrom: company, updatedAt: Date.now() });
    }
    changed++;
  }
  if (changed) await saveAnswers(answers);
  return changed;
}
