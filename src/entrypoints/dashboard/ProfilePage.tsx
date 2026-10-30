import { useEffect, useRef, useState } from 'react';
import { PROFILE_FIELDS } from '@/lib/fields';
import type { Profile, Resume } from '@/lib/types';
import { saveCoverLetter, saveProfile, saveResume } from '@/lib/store';
import type { StoreData } from '@/ui/useStore';

const GROUPS = [...new Set(PROFILE_FIELDS.map((f) => f.group))];
const MAX_FILE = 8 * 1024 * 1024;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function ProfilePage({ data }: { data: StoreData }) {
  // Local copy so typing isn't interrupted by the storage round trip.
  const [profile, setProfile] = useState<Profile>(data.profile);
  const [status, setStatus] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  function update(key: string, value: string) {
    const next = { ...profile, [key]: value };
    setProfile(next);
    setStatus('Saving…');
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      await saveProfile(next);
      setStatus('Saved');
    }, 400);
  }

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Profile</h1>
          <p className="muted">
            What you fill in here goes into application forms. Leave anything blank that you’d rather answer by hand.
          </p>
        </div>
        <p className="save-status small muted" aria-live="polite">
          {status}
        </p>
      </header>

      <section className="panel">
        <h2>Documents</h2>
        <p className="muted small">Attached to the matching upload field of each form you fill.</p>
        <DocumentSlot label="Resume (Lebenslauf)" file={data.resume} onSave={saveResume} />
        <DocumentSlot label="Cover letter (Anschreiben)" file={data.coverLetter} onSave={saveCoverLetter} />
      </section>

      {GROUPS.map((group) => (
        <section className="panel" key={group}>
          <h2>{group}</h2>
          {group === 'Voluntary self-identification' && (
            <p className="muted small">
              US employers ask these for equal-opportunity reporting. Answering is optional; leave them blank to answer
              case by case.
            </p>
          )}
          <div className="grid">
            {PROFILE_FIELDS.filter((f) => f.group === group).map((f) => (
              <label className="field" key={f.key}>
                <span>{f.label}</span>
                {f.options ? (
                  <select value={profile[f.key] ?? ''} onChange={(e) => update(f.key, e.target.value)}>
                    <option value="">Leave blank</option>
                    {f.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={f.kind ?? 'text'}
                    value={profile[f.key] ?? ''}
                    onChange={(e) => update(f.key, e.target.value)}
                    autoComplete="off"
                  />
                )}
                {f.hint && <small>{f.hint}</small>}
              </label>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

function DocumentSlot({ label, file, onSave }: { label: string; file: Resume | null; onSave: (r: Resume | null) => Promise<void> }) {
  const [error, setError] = useState('');

  async function choose(chosen: File | undefined) {
    setError('');
    if (!chosen) return;
    if (chosen.size > MAX_FILE) {
      setError('That file is over 8 MB. Most application forms reject files that large.');
      return;
    }
    await onSave({ name: chosen.name, type: chosen.type || 'application/pdf', size: chosen.size, dataUrl: await readAsDataUrl(chosen) });
  }

  return (
    <div>
      <div className="resume">
        <p>
          <span className="doc-label">{label}</span>
          {file ? (
            <>
              <strong>{file.name}</strong> <span className="muted">({Math.max(1, Math.round(file.size / 1024))} KB)</span>
            </>
          ) : (
            <span className="muted">None added</span>
          )}
        </p>
        <label className="btn">
          {file ? 'Replace file' : 'Choose file'}
          <input type="file" accept=".pdf,.doc,.docx,.txt,.rtf,.odt" className="sr-only" aria-label={label} onChange={(e) => void choose(e.target.files?.[0])} />
        </label>
        {file && (
          <button className="btn quiet danger" type="button" onClick={() => void onSave(null)}>
            Remove
          </button>
        )}
      </div>
      {error && <p className="form-message">{error}</p>}
    </div>
  );
}
