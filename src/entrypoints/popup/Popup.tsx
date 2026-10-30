import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import type { FillReport, Message, PageInfo } from '@/lib/types';
import { STATUS_LABEL } from '@/lib/types';
import { relativeDay, sentSince, startOfDay, startOfWeek } from '@/lib/dates';
import { useStore } from '@/ui/useStore';
import { statusColor } from '@/ui/status';
import { getSettings, saveSettings } from '@/lib/store';

async function activeTabId(): Promise<number | undefined> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

async function send<T>(msg: Message): Promise<T | undefined> {
  const tabId = await activeTabId();
  if (tabId == null) return undefined;
  return (await browser.tabs.sendMessage(tabId, msg)) as T | undefined;
}

const openDashboard = (hash = '') => {
  void browser.tabs.create({ url: browser.runtime.getURL(`/dashboard.html#${hash}`) });
  window.close();
};

export function Popup() {
  const data = useStore();
  const [page, setPage] = useState<PageInfo | null>(null);
  const [unreachable, setUnreachable] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const loadPage = () =>
    send<PageInfo>({ type: 'page-info' })
      .then((info) => setPage(info ?? null))
      .catch(() => setUnreachable(true));

  useEffect(() => {
    void loadPage();
  }, []);

  async function fill() {
    setBusy(true);
    setMessage('');
    try {
      const report = await send<FillReport>({ type: 'fill' });
      if (!report) setMessage('No application form found on this page.');
      else setMessage(`Filled ${report.filled} fields.${report.needsYou ? ` ${report.needsYou} required ones need you.` : ''}`);
    } catch {
      setMessage('No application form found on this page. If you just installed Jobfill, reload the page.');
    } finally {
      setBusy(false);
      void loadPage();
    }
  }

  async function act(type: 'mark-applied' | 'save-job', done: string) {
    try {
      await send({ type });
      setMessage(done);
      void loadPage();
    } catch {
      setMessage('Couldn’t read this page. Reload it and try again.');
    }
  }

  const apps = data?.applications ?? [];
  const existing = page?.existing;

  return (
    <div className="popup">
      <div className="popup-head">
        <strong>Jobfill</strong>
        <button className="btn quiet" type="button" onClick={() => openDashboard()}>
          Open dashboard
        </button>
      </div>

      <label className="check">
        <input type="checkbox" role="switch" checked={data?.settings.enabled ?? true}
          disabled={!data || busy}
          onChange={async (e) => {
            const enabled = e.target.checked;
            setBusy(true);
            try {
              await saveSettings({ ...(await getSettings()), enabled });
              setMessage(enabled ? 'Jobfill is on.' : 'Jobfill is off. Your saved data is kept.');
            } catch {
              setMessage('Could not save the switch. Try again.');
            } finally { setBusy(false); }
          }} />
        <span>Jobfill {data?.settings.enabled === false ? 'off' : 'on'}</span>
      </label>
      {data?.settings.enabled === false && <p className="muted" role="status">Filling and tracking are paused on all tabs.</p>}

      {unreachable ? (
        <div className="popup-job">
          <p className="muted">Jobfill can’t read this tab. Browser pages and the Chrome Web Store are off-limits, and pages opened before installing need a reload.</p>
        </div>
      ) : page ? (
        <div className="popup-job">
          <span className="company">{page.job.company}</span>
          <span>{page.job.title}</span>
          <span className="muted small">{page.job.source}</span>
          {existing && (
            <span className="status-line">
              <span className="dot" style={{ background: statusColor(existing.status) }} />
              {STATUS_LABEL[existing.status]}
              {existing.appliedAt ? `, ${relativeDay(existing.appliedAt).toLowerCase()}` : ''}
            </span>
          )}
        </div>
      ) : null}

      {!unreachable && data?.settings.enabled && (
        <div className="popup-actions">
          <button className="btn primary" type="button" onClick={fill} disabled={busy}>
            {busy ? 'Filling…' : 'Fill this form'}
          </button>
          <div className="pair">
            <button className="btn" type="button" onClick={() => act('mark-applied', 'Marked as applied.')}>
              Mark as applied
            </button>
            <button
              className="btn"
              type="button"
              onClick={() => act('save-job', 'Saved for later.')}
              disabled={!!existing}
            >
              Save for later
            </button>
          </div>
        </div>
      )}

      {message && (
        <p className="popup-message" role="status">
          {message}
        </p>
      )}

      <div className="popup-foot">
        <span>
          {sentSince(apps, startOfWeek())} sent this week, {sentSince(apps, startOfDay())} today
        </span>
        <button className="btn quiet small" type="button" onClick={() => openDashboard('profile')}>
          Edit profile
        </button>
      </div>
    </div>
  );
}
