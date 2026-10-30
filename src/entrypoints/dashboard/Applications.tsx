import { useMemo, useState } from 'react';
import type { Application, Status } from '@/lib/types';
import { STATUS_LABEL, STATUSES } from '@/lib/types';
import { relativeDay, sentSince, startOfDay, startOfWeek } from '@/lib/dates';
import { updateApplication } from '@/lib/store';
import { norm } from '@/lib/text';
import { Tally } from '@/ui/Tally';
import { statusColor } from '@/ui/status';
import type { StoreData } from '@/ui/useStore';
import { AppDrawer } from './AppDrawer';

type View = 'board' | 'list';

function matches(a: Application, q: string): boolean {
  if (!q) return true;
  return norm(`${a.company} ${a.title} ${a.location} ${a.source} ${a.notes}`).includes(q);
}

const sortKey = (a: Application) => a.appliedAt ?? a.updatedAt;

export function Applications({ data }: { data: StoreData }) {
  const { applications, settings } = data;
  const [query, setQuery] = useState('');
  const [view, setView] = useState<View>(() => (localStorage.getItem('jobfill:view') as View) || 'board');
  const [openId, setOpenId] = useState<string | 'new' | null>(null);

  const week = sentSince(applications, startOfWeek());
  const today = sentSince(applications, startOfDay());

  const visible = useMemo(() => {
    const q = norm(query);
    return applications.filter((a) => matches(a, q)).sort((a, b) => sortKey(b) - sortKey(a));
  }, [applications, query]);

  const switchView = (v: View) => {
    setView(v);
    localStorage.setItem('jobfill:view', v);
  };

  const open = openId === 'new' ? null : applications.find((a) => a.id === openId);

  return (
    <>
      <header className="week">
        <div>
          <h1>Applications</h1>
          <p className="muted">
            {applications.length
              ? `${applications.length} tracked, ${sentSince(applications, 0)} sent in total.`
              : 'Applications you submit show up here on their own.'}
          </p>
        </div>
        <div className="week-tally">
          <Tally count={week} today={today} />
          <div className="week-numbers">
            <p>
              <strong className="big">{week}</strong> sent this week
            </p>
            <p className="muted small">
              {today} of {settings.dailyGoal} today
            </p>
          </div>
        </div>
      </header>

      <div className="toolbar">
        <input
          type="search"
          placeholder="Search company, role, notes"
          aria-label="Search applications"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="segmented" role="group" aria-label="View">
          {(['board', 'list'] as const).map((v) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => switchView(v)}>
              {v === 'board' ? 'Board' : 'List'}
            </button>
          ))}
        </div>
        <button className="btn primary" type="button" onClick={() => setOpenId('new')}>
          Add job
        </button>
      </div>

      {applications.length === 0 ? (
        <div className="empty">
          <h2>No applications yet</h2>
          <p className="muted">
            Open a job application and click <strong>Fill application</strong> at the bottom right of the page. When you
            submit, Jobfill logs it here. You can also add a job by its link.
          </p>
          <button className="btn" type="button" onClick={() => setOpenId('new')}>
            Add a job by link
          </button>
        </div>
      ) : view === 'board' ? (
        <Board apps={visible} onOpen={setOpenId} />
      ) : (
        <List apps={visible} onOpen={setOpenId} />
      )}

      {openId && <AppDrawer key={openId} app={open ?? null} onClose={() => setOpenId(null)} />}
    </>
  );
}

function Board({ apps, onOpen }: { apps: Application[]; onOpen: (id: string) => void }) {
  const [over, setOver] = useState<Status | null>(null);
  return (
    <div className="board">
      {STATUSES.map((status) => {
        const column = apps.filter((a) => a.status === status);
        return (
          <section
            key={status}
            className="column"
            data-over={over === status || undefined}
            aria-label={STATUS_LABEL[status]}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(status);
            }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => {
              setOver(null);
              const id = e.dataTransfer.getData('text/plain');
              if (id) void updateApplication(id, { status });
            }}
          >
            <h2 className="column-head">
              <span className="dot" style={{ background: statusColor(status) }} />
              {STATUS_LABEL[status]}
              <span className="count">{column.length}</span>
            </h2>
            <ul>
              {column.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    className="card"
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', a.id)}
                    onClick={() => onOpen(a.id)}
                  >
                    <span className="card-company">{a.company || 'Unknown company'}</span>
                    <span className="card-title">{a.title || 'Untitled role'}</span>
                    <span className="card-meta">
                      {relativeDay(a.appliedAt ?? a.createdAt)}
                      {a.source ? `, ${a.source}` : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function List({ apps, onOpen }: { apps: Application[]; onOpen: (id: string) => void }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Company</th>
            <th>Role</th>
            <th>Status</th>
            <th>Applied</th>
            <th>Source</th>
            <th>
              <span className="sr-only">Posting</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {apps.map((a) => (
            <tr key={a.id}>
              <td>
                <button type="button" className="linklike" onClick={() => onOpen(a.id)}>
                  {a.company || 'Unknown company'}
                </button>
              </td>
              <td>{a.title}</td>
              <td>
                <select
                  aria-label={`Status for ${a.company}`}
                  value={a.status}
                  onChange={(e) => void updateApplication(a.id, { status: e.target.value as Status })}
                  style={{ borderLeft: `4px solid ${statusColor(a.status)}` }}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </td>
              <td className="nowrap">{a.appliedAt ? relativeDay(a.appliedAt) : ''}</td>
              <td>{a.source}</td>
              <td>
                {a.url && (
                  <a href={a.url} target="_blank" rel="noreferrer">
                    Posting
                  </a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
