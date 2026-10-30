import { defineBackground } from 'wxt/utils/define-background';
import { browser } from 'wxt/browser';
import { backupFileName, backupJson, markBackedUp } from '@/lib/backup';
import { getApplications, getSettings } from '@/lib/store';
import { isStale } from '@/lib/dates';

const BACKUP_ALARM = 'weekly-backup';

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/**
 * Extension storage disappears with the extension, so a weekly copy goes to
 * Downloads/jobfill-backups. Service workers can't make blob URLs; a data URL works.
 */
async function backupIfDue() {
  const settings = await getSettings();
  if (!settings.autoBackup || !isStale(settings.lastBackupAt)) return;
  if (!(await getApplications()).length) return;
  await browser.downloads.download({
    url: `data:application/json;base64,${toBase64(await backupJson())}`,
    filename: `jobfill-backups/${backupFileName()}`,
    conflictAction: 'uniquify',
    saveAs: false,
  });
  await markBackedUp();
}

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(async ({ reason }) => {
    await browser.alarms.create(BACKUP_ALARM, { periodInMinutes: 6 * 60, delayInMinutes: 1 });
    if (reason === 'install') await browser.tabs.create({ url: browser.runtime.getURL('/dashboard.html#profile') });
  });

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === BACKUP_ALARM) void backupIfDue();
  });

  browser.commands.onCommand.addListener(async (command) => {
    if (command !== 'fill-form' || !(await getSettings()).enabled) return;
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.id != null) browser.tabs.sendMessage(tab.id, { type: 'fill' }).catch(() => undefined);
  });

  browser.runtime.onMessage.addListener((raw: unknown) => {
    const msg = raw as { type: string; tab?: string };
    if (msg.type === 'open-dashboard') {
      void browser.tabs.create({ url: browser.runtime.getURL(`/dashboard.html#${msg.tab ?? ''}`) });
    }
    return undefined;
  });
});
