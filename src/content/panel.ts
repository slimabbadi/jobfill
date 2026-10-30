import { FIELD_BY_KEY } from '@/lib/fields';
import type { FieldRow, RowStatus } from '@/lib/fill';
import { revealTarget } from '@/lib/fill';
import { getAll, getAnswers, getProfile, id, saveAnswers, saveCoverLetter, saveProfile, saveResume } from '@/lib/store';
import type { FillReport, Resume } from '@/lib/types';
import { PANEL_CSS } from './panel-css';

export interface PanelDeps {
  /** Describe the fields on the page with the latest saved data */
  describe: (data: Awaited<ReturnType<typeof getAll>>) => FieldRow[];
  fill: () => Promise<FillReport>;
  openDashboard: () => void;
}

const SECTIONS: { status: RowStatus; title: string; note: string }[] = [
  { status: 'missing', title: 'Missing from your profile', note: 'Jobfill knows these fields but has nothing saved for them.' },
  { status: 'unknown', title: 'No saved answer', note: 'Questions your profile doesn’t cover. Answers you add here are reused on later forms.' },
  { status: 'ready', title: 'Ready to fill', note: '' },
  { status: 'onPage', title: 'Already filled on the page', note: '' },
];

const MAX_FILE = 8 * 1024 * 1024;

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | boolean | undefined> = {},
  ...children: (Node | string | null | undefined | false)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k === 'class') el.className = String(v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children) if (c) el.append(c);
  return el;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function sourceLabel(row: FieldRow): string {
  if (row.target.kind === 'file') {
    if (row.document === 'resume') return 'Your resume';
    if (row.document === 'coverLetter') return 'Your cover letter';
    return 'Jobfill doesn’t upload this kind of file';
  }
  if (row.key === 'fullName') return 'Profile: first and last name';
  if (row.key) return `Profile: ${FIELD_BY_KEY.get(row.key)?.label ?? row.key}`;
  if (row.answer) return row.answer.learnedFrom ? `Saved answer, learned from ${row.answer.learnedFrom}` : 'Saved answer';
  return 'Not in your profile';
}

/** Display text for a saved value: enum labels instead of stored codes. */
function shownValue(row: FieldRow): string {
  if (!row.key) return row.value;
  return FIELD_BY_KEY.get(row.key)?.options?.find((o) => o.value === row.value)?.label ?? row.value;
}

/** Side tab on every page, opening a panel that lists the page's fields. */
export function createPanel(deps: PanelDeps) {
  const host = document.createElement('div');
  host.setAttribute('data-jobfill-ui', '');
  host.style.cssText = 'all: initial; position: fixed; z-index: 2147483647; top: 0; right: 0; height: 0; width: 0;';
  const root = host.attachShadow({ mode: 'closed' });
  root.innerHTML = `<style>${PANEL_CSS}</style>`;

  // Keep the page's own keyboard shortcuts from firing while typing in the panel.
  for (const type of ['keydown', 'keyup', 'keypress']) host.addEventListener(type, (e) => e.stopPropagation());

  const tab = h('button', { class: 'tab', type: 'button', 'aria-label': 'Open Jobfill panel', 'aria-expanded': 'false' }, 'Jobfill');
  const panel = h('aside', { class: 'panel', 'aria-label': 'Jobfill', hidden: true });
  root.append(tab, panel);

  let open = false;
  let pending = false;
  let status = '';
  const expanded = new Set<FieldRow['target']['el']>();

  const mount = () => {
    if (!host.isConnected) (document.body ?? document.documentElement).append(host);
  };

  function setOpen(next: boolean) {
    open = next;
    panel.hidden = !open;
    tab.hidden = open;
    tab.setAttribute('aria-expanded', String(open));
    if (open) void render();
    else tab.focus();
  }

  tab.addEventListener('click', () => setOpen(true));

  function flash(text: string) {
    status = text;
    const el = root.querySelector('.status');
    if (el) el.textContent = text;
    setTimeout(() => {
      if (status === text) {
        status = '';
        const s = root.querySelector('.status');
        if (s) s.textContent = '';
      }
    }, 2500);
  }

  async function saveProfileValue(key: string, value: string) {
    await saveProfile({ ...(await getProfile()), [key]: value });
    flash('Saved to your profile');
  }

  async function saveAnswer(row: FieldRow, text: string) {
    const answers = await getAnswers();
    const value = text.trim();
    const existing = row.answer && answers.find((a) => a.id === row.answer!.id);
    if (existing) {
      if (!value) answers.splice(answers.indexOf(existing), 1);
      else Object.assign(existing, { answer: value, updatedAt: Date.now() });
    } else if (value) {
      answers.push({ id: id(), question: row.question, answer: value, updatedAt: Date.now() });
    }
    await saveAnswers(answers);
    flash(value ? 'Answer saved' : 'Answer removed');
  }

  async function saveFile(which: 'resume' | 'coverLetter', file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_FILE) {
      flash('That file is over 8 MB, so it wasn’t saved');
      return;
    }
    const doc: Resume = { name: file.name, type: file.type || 'application/pdf', size: file.size, dataUrl: await readAsDataUrl(file) };
    await (which === 'resume' ? saveResume(doc) : saveCoverLetter(doc));
    flash(which === 'resume' ? 'Resume saved' : 'Cover letter saved');
  }

  function editor(row: FieldRow, profile: Record<string, string>): HTMLElement {
    const label = `Your answer for ${row.question}`;

    if (row.target.kind === 'file') {
      if (!row.document) return h('span');
      const which = row.document;
      const input = h('input', { type: 'file', accept: '.pdf,.doc,.docx,.txt,.rtf,.odt', class: 'sr-only', 'aria-label': label });
      input.addEventListener('change', () => void saveFile(which, input.files?.[0]));
      return h('label', { class: 'btn small' }, row.value ? 'Replace file' : 'Choose file', input);
    }

    if (row.key === 'fullName') {
      const pair = h('div', { class: 'pair' });
      for (const [k, placeholder] of [
        ['firstName', 'First name'],
        ['lastName', 'Last name'],
      ] as const) {
        const input = h('input', { type: 'text', value: profile[k] ?? '', placeholder, 'aria-label': placeholder });
        input.addEventListener('change', () => void saveProfileValue(k, input.value.trim()));
        pair.append(input);
      }
      return pair;
    }

    const options = row.key ? FIELD_BY_KEY.get(row.key)?.options : undefined;
    if (row.key && options) {
      const select = h('select', { 'aria-label': label }, h('option', { value: '' }, 'Leave blank'));
      for (const o of options) select.append(h('option', { value: o.value, selected: profile[row.key] === o.value }, o.label));
      select.addEventListener('change', () => void saveProfileValue(row.key!, select.value));
      return select;
    }

    if (row.key) {
      const type = row.key === 'birthDate' ? 'date' : 'text';
      const input = h('input', { type, value: profile[row.key] ?? '', 'aria-label': label });
      const key = row.key;
      input.addEventListener('change', () => void saveProfileValue(key, input.value.trim()));
      return input;
    }

    // A question the profile doesn't cover: offer the page's own choices when it has them.
    if (row.choices.length) {
      const select = h('select', { 'aria-label': label }, h('option', { value: '' }, 'No saved answer'));
      for (const c of row.choices) select.append(h('option', { value: c, selected: row.answer?.answer === c }, c));
      select.addEventListener('change', () => void saveAnswer(row, select.value));
      return select;
    }
    const long = row.target.el instanceof HTMLTextAreaElement || (row.answer?.answer.length ?? 0) > 80;
    const input = long
      ? h('textarea', { rows: '3', 'aria-label': label, placeholder: 'Type an answer to save it' })
      : h('input', { type: 'text', value: row.answer?.answer ?? '', 'aria-label': label, placeholder: 'Type an answer to save it' });
    if (input instanceof HTMLTextAreaElement) input.value = row.answer?.answer ?? '';
    input.addEventListener('change', () => void saveAnswer(row, input.value));
    return input;
  }

  function rowEl(row: FieldRow, profile: Record<string, string>): HTMLElement {
    const el = row.target.el;
    const editable = row.status === 'missing' || row.status === 'unknown' || expanded.has(el);
    const show = h('button', { type: 'button', class: 'link' }, 'Show');
    show.addEventListener('click', () => revealTarget(row.target));

    const head = h(
      'div',
      { class: 'row-head' },
      h('span', { class: `dot ${row.status}`, 'aria-hidden': 'true' }),
      h('span', { class: 'q' }, row.question || 'Unlabelled field', row.target.required ? h('span', { class: 'req', title: 'Required' }, ' *') : null),
      show,
    );

    const details: (Node | null)[] = [h('p', { class: 'source' }, sourceLabel(row))];
    if (row.status === 'onPage') details.push(h('p', { class: 'value' }, h('span', { class: 'muted' }, 'On the page: '), row.pageValue === 'file' ? 'a file is attached' : row.pageValue));
    // On-page rows only repeat the saved value when it differs from what the page holds.
    const differs = row.status !== 'onPage' || (row.target.kind === 'file' ? false : shownValue(row) !== row.pageValue);
    if (!editable && row.value && differs) details.push(h('p', { class: 'value' }, row.status === 'onPage' ? h('span', { class: 'muted' }, 'Saved: ') : null, shownValue(row)));

    if (editable) {
      details.push(editor(row, profile));
    } else if (row.target.kind !== 'file' || row.document) {
      const edit = h('button', { type: 'button', class: 'link' }, 'Edit');
      edit.addEventListener('click', () => {
        expanded.add(el);
        void render();
      });
      details.push(edit);
    }
    return h('li', { class: 'row' }, head, ...details);
  }

  async function render() {
    if (!open) return;
    // Rebuilding mid-typing would throw the cursor out of the field; wait for blur.
    if (root.activeElement && panel.contains(root.activeElement) && root.activeElement.matches('input, textarea, select')) {
      pending = true;
      return;
    }
    pending = false;
    const data = await getAll();
    const rows = deps.describe(data);
    const count = (s: RowStatus) => rows.filter((r) => r.status === s).length;

    const close = h('button', { type: 'button', class: 'close', 'aria-label': 'Close panel' }, '×');
    close.addEventListener('click', () => setOpen(false));
    const fillBtn = h('button', { type: 'button', class: 'btn primary', disabled: !count('ready') }, 'Fill empty fields');
    fillBtn.addEventListener('click', async () => {
      fillBtn.disabled = true;
      const report = await deps.fill();
      flash(`Filled ${report.filled} ${report.filled === 1 ? 'field' : 'fields'}`);
      void render();
    });
    const dash = h('button', { type: 'button', class: 'btn' }, 'Dashboard');
    dash.addEventListener('click', deps.openDashboard);

    const body = h('div', { class: 'body' });
    if (!rows.length) {
      body.append(
        h(
          'div',
          { class: 'empty' },
          h('p', {}, h('strong', {}, 'No form fields on this page.')),
          h('p', { class: 'muted' }, 'Open a job application and its fields are listed here, with what Jobfill can fill and what’s missing.'),
        ),
      );
    } else {
      for (const section of SECTIONS) {
        const list = rows.filter((r) => r.status === section.status);
        if (!list.length) continue;
        body.append(
          h(
            'section',
            { class: 'section' },
            h('h3', {}, h('span', { class: `dot ${section.status}`, 'aria-hidden': 'true' }), section.title, h('span', { class: 'n' }, String(list.length))),
            section.note ? h('p', { class: 'note' }, section.note) : null,
            h('ul', {}, ...list.map((r) => rowEl(r, data.profile))),
          ),
        );
      }
    }

    const summary = rows.length
      ? h(
          'p',
          { class: 'summary' },
          `${rows.length} ${rows.length === 1 ? 'field' : 'fields'} on this page: ${count('ready')} ready, ${count('missing') + count('unknown')} without an answer, ${count('onPage')} already filled.`,
        )
      : null;

    // Pages re-render often; keep the reader's place in the list across rebuilds.
    const scrollTop = panel.querySelector('.body')?.scrollTop ?? 0;
    panel.replaceChildren(
      h('header', { class: 'head' }, h('strong', {}, 'Jobfill'), h('span', { class: 'status', role: 'status' }, status), close),
      h('div', { class: 'actions' }, fillBtn, dash),
      summary ?? '',
      body,
    );
    body.scrollTop = scrollTop;
  }

  panel.addEventListener('focusout', () => {
    setTimeout(() => pending && void render(), 0);
  });
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setOpen(false);
  });

  return {
    setVisible(visible: boolean) {
      if (visible) mount();
      else host.remove();
    },
    refresh() {
      void render();
    },
    get isOpen() {
      return open;
    },
    destroy() {
      host.remove();
    },
  };
}
