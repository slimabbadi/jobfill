import { useState } from 'react';
import { browser } from 'wxt/browser';
import type { Settings } from '@/lib/types';
import { saveSettings } from '@/lib/store';
import { applicationsCsv, downloadText, restoreJson } from '@/lib/backup';
import type { StoreData } from '@/ui/useStore';
import { exportBackup } from './App';

export function SettingsPage({ data }: { data: StoreData }) {
  const { settings } = data;
  const [message, setMessage] = useState('');
  const set = (patch: Partial<Settings>) => saveSettings({ ...settings, ...patch });

  async function restore(file: File | undefined) {
    setMessage('');
    if (!file) return;
    if (!confirm('Restoring replaces your profile, saved answers and applications with the backup’s. Continue?')) return;
    try {
      const result = await restoreJson(await file.text());
      setMessage(`Restored ${result.applications} applications and ${result.answers} saved answers.`);
    } catch (e) {
      setMessage((e as Error).message);
    }
  }

  const last = settings.lastBackupAt ? new Date(settings.lastBackupAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : null;

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Backup and settings</h1>
        </div>
      </header>

      <section className="panel">
        <h2>Backup</h2>
        <p className="muted">
          Everything Jobfill knows is stored in this browser only. Uninstalling the extension or clearing browser data
          deletes it, so keep a backup file somewhere safe.
        </p>
        <p className="small">{last ? `Last backup: ${last}` : 'No backup yet.'}</p>
        <div className="actions">
          <button className="btn primary" type="button" onClick={exportBackup}>
            Export backup
          </button>
          <label className="btn">
            Restore from backup
            <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => void restore(e.target.files?.[0])} />
          </label>
          <button
            className="btn"
            type="button"
            onClick={() => downloadText(applicationsCsv(data.applications), 'jobfill-applications.csv', 'text/csv')}
            disabled={!data.applications.length}
          >
            Export spreadsheet (CSV)
          </button>
        </div>
        {message && (
          <p className="form-message" role="status">
            {message}
          </p>
        )}
        <label className="check">
          <input type="checkbox" checked={settings.autoBackup} onChange={(e) => void set({ autoBackup: e.target.checked })} />
          <span>
            Save a backup every week automatically
            <br />
            <span className="muted small">Goes to your Downloads folder, under jobfill-backups.</span>
          </span>
        </label>
      </section>

      <section className="panel">
        <h2>Filling forms</h2>
        <label className="check">
          <input
            type="checkbox"
            checked={settings.showFloatingButton}
            onChange={(e) => void set({ showFloatingButton: e.target.checked })}
          />
          <span>
            Show the Fill application button on application forms
            <br />
            <span className="muted small">You can always fill from the toolbar icon or with the keyboard shortcut.</span>
          </span>
        </label>
        <label className="check">
          <input type="checkbox" checked={settings.showSideTab} onChange={(e) => void set({ showSideTab: e.target.checked })} />
          <span>
            Show the Jobfill tab on the side of every page
            <br />
            <span className="muted small">Opens a panel listing the page’s fields, what Jobfill can fill and what’s missing.</span>
          </span>
        </label>
        <label className="check">
          <input type="checkbox" checked={settings.overwriteFilled} onChange={(e) => void set({ overwriteFilled: e.target.checked })} />
          <span>
            Replace answers already in a form
            <br />
            <span className="muted small">Off by default, so whatever a site pre-filled from your account stays.</span>
          </span>
        </label>
        <label className="check">
          <input type="checkbox" checked={settings.learnAnswers} onChange={(e) => void set({ learnAnswers: e.target.checked })} />
          <span>
            Save new answers when I submit an application
            <br />
            <span className="muted small">Passwords and ID numbers are never saved.</span>
          </span>
        </label>
        <div className="row narrow">
          <label className="field">
            <span>Daily goal</span>
            <input
              type="number"
              min={0}
              max={200}
              value={settings.dailyGoal}
              onChange={(e) => void set({ dailyGoal: Math.max(0, Number(e.target.value) || 0) })}
            />
          </label>
        </div>
        <p className="small">
          Keyboard shortcut: <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd>.{' '}
          <button
            className="btn quiet"
            type="button"
            onClick={() => void browser.tabs.create({ url: 'chrome://extensions/shortcuts' })}
          >
            Change shortcut
          </button>
        </p>
      </section>
    </>
  );
}
