import { useEffect, useRef, useState } from 'react';
import type { Application, Status } from '@/lib/types';
import { STATUS_LABEL, STATUSES } from '@/lib/types';
import { extractJob, urlKey } from '@/lib/job';
import { deleteApplication, findApplication, getApplications, id, saveApplications, updateApplication } from '@/lib/store';

interface Draft {
  url: string;
  company: string;
  title: string;
  location: string;
  status: Status;
  appliedDate: string;
  notes: string;
  source: string;
}

const toDateInput = (t?: number) => {
  if (!t) return '';
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Noon local time, so the date doesn't slip a day across time zones. */
const fromDateInput = (s: string) => (s ? new Date(`${s}T12:00:00`).getTime() : undefined);

function draftOf(app: Application | null): Draft {
  return {
    url: app?.url ?? '',
    company: app?.company ?? '',
    title: app?.title ?? '',
    location: app?.location ?? '',
    status: app?.status ?? 'applied',
    appliedDate: toDateInput(app?.appliedAt ?? (app ? undefined : Date.now())),
    notes: app?.notes ?? '',
    source: app?.source ?? '',
  };
}

export function AppDrawer({ app, onClose }: { app: Application | null; onClose: () => void }) {
  const [draft, setDraft] = useState<Draft>(() => draftOf(app));
  const [reading, setReading] = useState(false);
  const [message, setMessage] = useState('');
  const panel = useRef<HTMLDivElement>(null);
  const isNew = !app;

  useEffect(() => {
    panel.current?.querySelector<HTMLElement>('input, textarea')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  async function readLink() {
    setMessage('');
    let url: URL;
    try {
      url = new URL(draft.url.trim());
    } catch {
      setMessage('That doesn’t look like a full link. Paste it including https://');
      return;
    }
    setReading(true);
    try {
      const res = await fetch(url, { credentials: 'omit' });
      if (!res.ok) throw new Error(String(res.status));
      const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
      const job = extractJob(doc, url.href);
      setDraft((d) => ({
        ...d,
        company: job.company || d.company,
        title: job.title || d.title,
        location: job.location || d.location,
        source: job.source,
      }));
      setMessage(job.title ? 'Filled in from the posting. Check it before saving.' : 'The page didn’t say much. Fill in the rest yourself.');
    } catch {
      setMessage('Couldn’t load that page. Fill in the details yourself.');
    } finally {
      setReading(false);
    }
  }

  async function save() {
    const appliedAt = fromDateInput(draft.appliedDate);
    const fields = {
      url: draft.url.trim(),
      urlKey: draft.url.trim() ? urlKey(draft.url.trim()) : '',
      company: draft.company.trim(),
      title: draft.title.trim(),
      location: draft.location.trim(),
      status: draft.status,
      notes: draft.notes,
      source: draft.source,
      // Not sent yet means no applied date, or it would count toward this week's tally.
      appliedAt: draft.status === 'saved' || draft.status === 'filled' ? undefined : appliedAt,
    };
    if (app) {
      await updateApplication(app.id, fields);
      onClose();
      return;
    }
    if (!fields.company && !fields.title) {
      setMessage('Add at least a company or a role.');
      return;
    }
    const apps = await getApplications();
    const existing = findApplication(apps, fields);
    if (existing) {
      setMessage(`You already track this job (${STATUS_LABEL[existing.status]}). Search for ${existing.company} to open it.`);
      return;
    }
    const now = Date.now();
    await saveApplications([
      { id: id(), ...fields, createdAt: now, updatedAt: now, history: [{ status: fields.status, at: now }] },
      ...apps,
    ]);
    onClose();
  }

  async function remove() {
    if (!app || !confirm(`Delete ${app.title || 'this job'} at ${app.company}? This can’t be undone.`)) return;
    await deleteApplication(app.id);
    onClose();
  }

  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title" ref={panel}>
        <div className="drawer-head">
          <h2 id="drawer-title">{isNew ? 'Add a job' : draft.company || 'Job'}</h2>
          <button className="btn quiet" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <form
          className="drawer-body"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <label className="field">
            <span>Link to the posting</span>
            <div className="row">
              <input type="url" value={draft.url} onChange={(e) => set('url', e.target.value)} placeholder="https://" />
              <button className="btn" type="button" onClick={readLink} disabled={!draft.url || reading}>
                {reading ? 'Reading…' : 'Read details'}
              </button>
            </div>
          </label>
          <label className="field">
            <span>Company</span>
            <input type="text" value={draft.company} onChange={(e) => set('company', e.target.value)} />
          </label>
          <label className="field">
            <span>Role</span>
            <input type="text" value={draft.title} onChange={(e) => set('title', e.target.value)} />
          </label>
          <label className="field">
            <span>Location</span>
            <input type="text" value={draft.location} onChange={(e) => set('location', e.target.value)} />
          </label>
          <div className="row">
            <label className="field">
              <span>Status</span>
              <select value={draft.status} onChange={(e) => set('status', e.target.value as Status)}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Applied on</span>
              <input type="date" value={draft.appliedDate} onChange={(e) => set('appliedDate', e.target.value)} />
            </label>
          </div>
          <label className="field">
            <span>Notes</span>
            <textarea
              rows={5}
              value={draft.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Recruiter name, salary range, follow-up dates"
            />
          </label>

          {message && (
            <p className="form-message" role="status">
              {message}
            </p>
          )}

          <div className="drawer-actions">
            <button className="btn primary" type="submit">
              {isNew ? 'Add job' : 'Save changes'}
            </button>
            {app && (
              <button className="btn quiet danger" type="button" onClick={remove}>
                Delete
              </button>
            )}
          </div>

          {app && app.history.length > 0 && (
            <section className="history">
              <h3>History</h3>
              <ol>
                {[...app.history].reverse().map((h, i) => (
                  <li key={i}>
                    <span>{STATUS_LABEL[h.status]}</span>
                    <time className="muted">{new Date(h.at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</time>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </form>
      </div>
    </div>
  );
}
