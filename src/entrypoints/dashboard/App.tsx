import { useEffect, useState } from 'react';
import { useStore } from '@/ui/useStore';
import { isStale } from '@/lib/dates';
import { backupFileName, backupJson, downloadText, markBackedUp } from '@/lib/backup';
import { Applications } from './Applications';
import { ProfilePage } from './ProfilePage';
import { AnswersPage } from './AnswersPage';
import { SettingsPage } from './SettingsPage';

const PAGES = [
  { id: 'applications', label: 'Applications' },
  { id: 'profile', label: 'Profile' },
  { id: 'answers', label: 'Saved answers' },
  { id: 'settings', label: 'Backup and settings' },
] as const;
type PageId = (typeof PAGES)[number]['id'];

function pageFromHash(): PageId {
  const id = location.hash.slice(1);
  return PAGES.some((p) => p.id === id) ? (id as PageId) : 'applications';
}

export async function exportBackup() {
  downloadText(await backupJson(), backupFileName(), 'application/json');
  await markBackedUp();
}

export function App() {
  const data = useStore();
  const [page, setPage] = useState<PageId>(pageFromHash);

  useEffect(() => {
    const onHash = () => setPage(pageFromHash());
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    document.title = `${PAGES.find((p) => p.id === page)?.label} – Jobfill`;
  }, [page]);

  if (!data) return null;

  const counts: Partial<Record<PageId, number>> = {
    applications: data.applications.length,
    answers: data.answers.length,
  };
  const backupDue = data.applications.length > 0 && isStale(data.settings.lastBackupAt);

  return (
    <div className="shell">
      <nav className="rail" aria-label="Sections">
        <div className="wordmark">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="2" y="2" width="20" height="20" rx="5" />
            <path d="M7 8h10M7 12h7M7 16h4" />
          </svg>
          Jobfill
        </div>
        <ul>
          {PAGES.map((p) => (
            <li key={p.id}>
              <a href={`#${p.id}`} aria-current={page === p.id ? 'page' : undefined}>
                {p.label}
                {counts[p.id] ? <span className="count">{counts[p.id]}</span> : null}
              </a>
            </li>
          ))}
        </ul>
        <p className="rail-note small">Everything stays in this browser. No account, no limits.</p>
      </nav>
      <main className="main">
        {backupDue && page !== 'settings' && (
          <div className="notice" role="status">
            <p>
              {data.settings.lastBackupAt
                ? 'Your last backup is more than a week old.'
                : 'You haven’t backed up yet.'}{' '}
              Your applications live only in this browser, and uninstalling Jobfill deletes them.
            </p>
            <button className="btn" type="button" onClick={exportBackup}>
              Export backup
            </button>
          </div>
        )}
        {page === 'applications' && <Applications data={data} />}
        {page === 'profile' && <ProfilePage data={data} />}
        {page === 'answers' && <AnswersPage answers={data.answers} />}
        {page === 'settings' && <SettingsPage data={data} />}
      </main>
    </div>
  );
}
