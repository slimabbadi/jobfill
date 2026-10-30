import { defineContentScript } from 'wxt/utils/define-content-script';
import { browser } from 'wxt/browser';
import { captureAnswers, describePage, fillPage, looksLikeApplication } from '@/lib/fill';
import { createPanel } from '@/content/panel';
import { extractJob, looksLikeConfirmation } from '@/lib/job';
import {
  findApplication,
  getAll,
  getApplications,
  getSettings,
  learnAnswers,
  onChange,
  recordJob,
  updateApplication,
} from '@/lib/store';
import type { FillReport, Message, PageInfo } from '@/lib/types';
import { relativeDay } from '@/lib/dates';
import { norm } from '@/lib/text';

/** Final submit buttons, in English and German (matched after norm(), so "Bewerbung absenden"). */
const SUBMIT_TEXT =
  /^(submit|send|apply|apply now|finish|complete)( (my |your )?application)?$|^submit\b|^(jetzt )?(bewerbung )?(jetzt )?(absenden|abschicken|senden|versenden|einreichen|uebermitteln)( bewerbung)?$|^(jetzt )?bewerben$/;

export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: true,
  runAt: 'document_idle',
  main(ctx) {
    const isTop = window === window.top;
    let hasForm = false;
    let filledHere = false;
    let lastSubmitAt = 0;
    let dismissed = false;
    const ui = createUi();
    // The side panel lives in the top page only; one per tab, not one per embedded frame.
    const panel = isTop
      ? createPanel({
          describe: (data) =>
            describePage(document, {
              profile: data.profile,
              answers: data.answers,
              resume: data.resume ?? undefined,
              coverLetter: data.coverLetter ?? undefined,
              overwrite: false,
            }),
          fill: () => fill(),
          openDashboard: () => void browser.runtime.sendMessage({ type: 'open-dashboard' }),
        })
      : null;

    const job = () => extractJob(document, location.href);

    async function refresh() {
      const settings = await getSettings();
      hasForm = settings.enabled && looksLikeApplication(document);
      ui.setButtonVisible(hasForm && settings.showFloatingButton && !dismissed);
      panel?.setVisible(settings.enabled && settings.showSideTab);
      ui.setEnabled(settings.enabled);
      if (settings.enabled && panel?.isOpen) panel.refresh();
    }

    async function fill(): Promise<FillReport> {
      const data = await getAll();
      if (!data.settings.enabled) return { filled: 0, needsYou: 0 };
      const report = await fillPage(document, {
        profile: data.profile,
        answers: data.answers,
        resume: data.resume ?? undefined,
        coverLetter: data.coverLetter ?? undefined,
        overwrite: data.settings.overwriteFilled,
      });
      filledHere = true;
      if (report.filled) await recordJob(job(), 'filled');
      const profileEmpty = !Object.values(data.profile).some((v) => v?.trim());
      if (profileEmpty) {
        ui.toast('Your profile is empty, so there was nothing to fill.', {
          label: 'Add your details',
          run: () => browser.runtime.sendMessage({ type: 'open-dashboard', tab: 'profile' }),
        });
      } else {
        const attention = report.needsYou ? ` ${report.needsYou} required ${report.needsYou === 1 ? 'field needs' : 'fields need'} you, outlined in amber.` : '';
        ui.toast(`Filled ${report.filled} ${report.filled === 1 ? 'field' : 'fields'}.${attention} Check them, then submit.`, {
          label: 'Mark as applied',
          run: () => submitted(true),
        });
      }
      return report;
    }

    /** Called when the applicant submits, or says they did. */
    async function submitted(manual = false) {
      if (Date.now() - lastSubmitAt < 10_000) return;
      lastSubmitAt = Date.now();
      const settings = await getSettings();
      if (!settings.enabled) return;
      // Read answers now; the page may navigate away as soon as the submit goes through.
      const answers = settings.learnAnswers ? captureAnswers(document) : [];
      const info = job();
      const app = await recordJob(info, 'applied');
      const learned = await learnAnswers(answers, info.company);
      const extra = learned ? ` Saved ${learned} new ${learned === 1 ? 'answer' : 'answers'} for next time.` : '';
      ui.toast(`${manual ? 'Marked' : 'Logged'} as applied: ${app.title || 'this job'} at ${app.company}.${extra}`);
    }

    async function checkConfirmation() {
      if (!(await getSettings()).enabled || !looksLikeConfirmation(document)) return;
      const apps = await getApplications();
      const app = findApplication(apps, job());
      if (app?.status === 'filled') {
        await updateApplication(app.id, { status: 'applied' });
        ui.toast(`Logged as applied: ${app.title} at ${app.company}.`);
      }
    }

    async function warnIfApplied() {
      if (!isTop || !(await getSettings()).enabled) return;
      const app = findApplication(await getApplications(), job());
      if (app?.appliedAt && app.status !== 'saved' && app.status !== 'filled') {
        ui.banner(`You applied to this job ${relativeDay(app.appliedAt).toLowerCase()}.`);
      }
    }

    // Only real user actions count: pages fire synthetic clicks and submits of their own.
    function onClick(e: Event) {
      if (!e.isTrusted) return;
      const target = (e.target as Element | null)?.closest('button, [role="button"], input[type="submit"], a');
      if (!target || target.closest('[data-jobfill-ui]')) return;
      const text = norm((target as HTMLInputElement).value || target.textContent || '');
      if (!SUBMIT_TEXT.test(text)) return;
      // "Apply" on a job description just opens the form; only count it where a form is.
      if (filledHere || looksLikeApplication(document)) void submitted();
    }

    function onSubmit(e: Event) {
      const form = e.target;
      if (!e.isTrusted || !(form instanceof HTMLFormElement)) return;
      // A search box or newsletter signup elsewhere on the page is a form too.
      if (form.querySelectorAll('input, select, textarea').length < 3) return;
      if (filledHere || looksLikeApplication(document)) void submitted();
    }

    document.addEventListener('click', onClick, true);
    document.addEventListener('submit', onSubmit, true);

    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        void refresh();
        void checkConfirmation();
      }, 700);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    ctx.onInvalidated(() => {
      observer.disconnect();
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('submit', onSubmit, true);
      ui.destroy();
      panel?.destroy();
    });
    const stopWatching = onChange(() => void refresh());
    ctx.onInvalidated(stopWatching);

    ui.onFill(() => void fill());
    ui.onDismiss(() => {
      dismissed = true;
      ui.setButtonVisible(false);
    });

    void refresh();
    void checkConfirmation();
    void warnIfApplied();

    browser.runtime.onMessage.addListener((raw: unknown) => {
      const msg = raw as Message;
      switch (msg.type) {
        case 'fill':
          // Every frame gets the message; only frames with a form answer, so the popup
          // hears from the one that did the work.
          hasForm = looksLikeApplication(document);
          return hasForm ? fill() : undefined;
        case 'page-info': {
          if (!isTop) return undefined;
          return getApplications().then((apps): PageInfo => {
            const info = job();
            return { job: info, hasForm: looksLikeApplication(document), existing: findApplication(apps, info) };
          });
        }
        case 'mark-applied':
          if (!isTop) return undefined;
          lastSubmitAt = 0;
          return submitted(true).then(() => true);
        case 'save-job':
          if (!isTop) return undefined;
          return getSettings().then((settings) => settings.enabled ? recordJob(job(), 'saved') : undefined);
      }
      return undefined;
    });
  },
});

interface ToastAction {
  label: string;
  run: () => unknown;
}

/** Floating button and messages, in a shadow root so page styles can't reach them. */
function createUi() {
  const host = document.createElement('div');
  host.setAttribute('data-jobfill-ui', '');
  host.style.cssText = 'all: initial; position: fixed; z-index: 2147483646; right: 20px; bottom: 96px;';
  const root = host.attachShadow({ mode: 'closed' });
  root.innerHTML = `
    <style>
      .stack, button { font: 14px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; color: #17233A; }
      .stack { display: flex; flex-direction: column; align-items: flex-end; gap: 10px; }
      .fill { display: none; align-items: center; gap: 2px; background: #17233A; border-radius: 999px;
        box-shadow: 0 6px 20px rgba(23, 35, 58, 0.28); }
      .fill.show { display: inline-flex; }
      button { font: inherit; cursor: pointer; border: 0; background: none; color: inherit; }
      .go { color: #fff; font-weight: 600; padding: 10px 6px 10px 16px; display: inline-flex; align-items: center; gap: 8px; }
      .go svg { width: 16px; height: 16px; }
      .x { color: #9AA6BC; padding: 10px 14px 10px 8px; font-size: 16px; line-height: 1; }
      .go:focus-visible, .x:focus-visible, .act:focus-visible { outline: 2px solid #8FB0FF; outline-offset: 2px; border-radius: 999px; }
      .toast { max-width: 340px; background: #fff; border: 1px solid #D3DAE4; border-left: 4px solid #2450C8;
        border-radius: 8px; padding: 12px 14px; box-shadow: 0 8px 24px rgba(23, 35, 58, 0.16); }
      .act { margin-top: 8px; color: #2450C8; font-weight: 600; padding: 0; }
      .banner { max-width: 340px; background: #FFF6DE; border: 1px solid #E9C979; border-radius: 8px; padding: 10px 14px; }
      @media (prefers-reduced-motion: no-preference) { .toast { animation: rise 160ms ease-out; } }
      @keyframes rise { from { transform: translateY(6px); opacity: 0; } }
    </style>
    <div class="stack">
      <div class="msgs"></div>
      <div class="fill" role="group" aria-label="Jobfill">
        <button class="go" type="button" title="Fill this application (Alt+Shift+F)">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <path d="M3 4.5h10M3 8h7M3 11.5h4" stroke-linecap="round"/><path d="m10 12 1.6 1.6L15 10" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>Fill application</button>
        <button class="x" type="button" aria-label="Hide on this page">×</button>
      </div>
    </div>`;
  const fillBox = root.querySelector('.fill')!;
  const msgs = root.querySelector('.msgs')!;
  // Sites that render the whole document with React (Greenhouse, for one) throw away
  // nodes they didn't create when they hydrate, so re-attach whenever it goes missing.
  const mount = () => {
    if (!host.isConnected) (document.body ?? document.documentElement).append(host);
  };

  function show(el: HTMLElement, ms: number) {
    mount();
    msgs.replaceChildren(el);
    setTimeout(() => el.remove(), ms);
  }

  return {
    setEnabled(enabled: boolean) {
      host.hidden = !enabled;
      if (!enabled) msgs.replaceChildren();
    },
    setButtonVisible(visible: boolean) {
      if (visible) mount();
      fillBox.classList.toggle('show', visible);
    },
    onFill(fn: () => void) {
      root.querySelector('.go')!.addEventListener('click', fn);
    },
    onDismiss(fn: () => void) {
      root.querySelector('.x')!.addEventListener('click', fn);
    },
    toast(text: string, action?: ToastAction) {
      const el = document.createElement('div');
      el.className = 'toast';
      el.setAttribute('role', 'status');
      el.textContent = text;
      if (action) {
        const btn = document.createElement('button');
        btn.className = 'act';
        btn.type = 'button';
        btn.textContent = action.label;
        btn.addEventListener('click', () => {
          el.remove();
          action.run();
        });
        el.append(document.createElement('br'), btn);
      }
      show(el, action ? 12_000 : 6_000);
    },
    banner(text: string) {
      const el = document.createElement('div');
      el.className = 'banner';
      el.setAttribute('role', 'status');
      el.textContent = text;
      show(el, 10_000);
    },
    destroy() {
      host.remove();
    },
  };
}
