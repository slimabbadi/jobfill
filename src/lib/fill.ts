import type { FillData, FillReport, SavedAnswer } from './types';
import { classify, displayValue, enumMatcher, formatDate, profileValue } from './fields';
import { chooseOption, cleanLabel, isPlaceholderOption, norm, similarity, splitIdentifier } from './text';

type Kind = 'text' | 'select' | 'radio' | 'checkgroup' | 'combobox' | 'file';

export interface Target {
  kind: Kind;
  /** The control, or the first control of a radio/checkbox group */
  el: HTMLElement;
  /** All controls of a radio/checkbox group */
  group: HTMLInputElement[];
  question: string;
  hints: string;
  autocomplete: string;
  inputType: string;
  required: boolean;
}

export interface EngineOptions {
  /** Injected so tests can run in jsdom, which has no layout. */
  isVisible?: (el: Element) => boolean;
  /** How long to wait for a custom dropdown's options to appear. */
  optionTimeoutMs?: number;
}

const SKIP_TYPES = new Set(['hidden', 'submit', 'button', 'reset', 'image', 'password', 'search', 'range', 'color']);
const LABELISH = 'label, legend, [class*="label" i], [data-automation-id*="label" i], [id*="label" i]';
const CONTROLS = 'input, select, textarea, [role="combobox"], button[aria-haspopup="listbox"]';
const SENSITIVE = /password|social security|\bssn\b|date of birth|\bdob\b|credit card|bank|passport number|captcha/;

export function defaultIsVisible(el: Element): boolean {
  const rects = el.getClientRects();
  if (!rects.length) return false;
  const style = getComputedStyle(el);
  return style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity) > 0.05;
}

/** Text content with form controls and their option lists removed. */
function textOf(node: Element | null): string {
  if (!node) return '';
  const clone = node.cloneNode(true) as Element;
  clone.querySelectorAll('select, option, input, textarea, button, script, style, [role="listbox"]').forEach((n) => n.remove());
  return cleanLabel(clone.textContent ?? '');
}

function byIds(doc: Document, ids: string | null): string {
  if (!ids) return '';
  return cleanLabel(
    ids
      .split(/\s+/)
      .map((id) => textOf(doc.getElementById(id)))
      .join(' '),
  );
}

/** Nearest label-like element above `el` with no other control between them. */
function containerLabel(el: Element, exclude: Element[]): string {
  let node: Element | null = el.parentElement;
  for (let depth = 0; node && depth < 6; depth++, node = node.parentElement) {
    const controls = Array.from(node.querySelectorAll(CONTROLS)).filter((c) => !exclude.includes(c));
    const candidates = Array.from(node.querySelectorAll(LABELISH)).filter(
      (c) =>
        !exclude.includes(c) &&
        !c.contains(el) &&
        el.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_PRECEDING &&
        !(c instanceof HTMLLabelElement && c.htmlFor && !exclude.some((x) => x.id === c.htmlFor)),
    );
    for (let i = candidates.length - 1; i >= 0; i--) {
      const label = candidates[i]!;
      const between = controls.some(
        (c) =>
          label.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING &&
          el.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_PRECEDING,
      );
      if (between) break;
      const text = textOf(label);
      if (text) return text;
    }
  }
  return '';
}

function ownLabel(el: HTMLElement): string {
  const doc = el.ownerDocument;
  const labels = (el as HTMLInputElement).labels;
  if (labels?.length) {
    const text = cleanLabel(Array.from(labels).map(textOf).join(' '));
    if (text) return text;
  }
  return byIds(doc, el.getAttribute('aria-labelledby')) || cleanLabel(el.getAttribute('aria-label') ?? '');
}

function questionFor(el: HTMLElement): string {
  return (
    ownLabel(el) ||
    containerLabel(el, [el]) ||
    cleanLabel((el as HTMLInputElement).placeholder ?? '') ||
    cleanLabel(el.title ?? '')
  );
}

/** Group question for radios/checkboxes: the legend or heading, not each option's label. */
function groupQuestion(group: HTMLInputElement[]): string {
  const first = group[0]!;
  const doc = first.ownerDocument;
  const fieldset = first.closest('fieldset');
  const legend = fieldset?.querySelector('legend');
  if (legend && textOf(legend)) return textOf(legend);
  const roleGroup = first.closest('[role="radiogroup"], [role="group"]');
  if (roleGroup) {
    const text = byIds(doc, roleGroup.getAttribute('aria-labelledby')) || cleanLabel(roleGroup.getAttribute('aria-label') ?? '');
    if (text) return text;
  }
  // Skip the option labels themselves when searching upward.
  const optionLabels = group.flatMap((r) => Array.from(r.labels ?? []));
  return containerLabel(first, [...group, ...optionLabels]);
}

export function optionText(input: HTMLInputElement): string {
  const label = ownLabel(input);
  if (label) return label;
  const parent = input.parentElement;
  return parent ? textOf(parent) : input.value;
}

function isRequired(el: HTMLElement, question: string): boolean {
  return (
    (el as HTMLInputElement).required ||
    el.getAttribute('aria-required') === 'true' ||
    /\*\s*$/.test(question) ||
    el.closest('[class*="required" i]') !== null
  );
}

function hintsOf(el: HTMLElement): string {
  return splitIdentifier(`${el.getAttribute('name') ?? ''} ${el.id}`);
}

export function collectTargets(doc: Document, opts: EngineOptions = {}): Target[] {
  const visible = opts.isVisible ?? defaultIsVisible;
  const targets: Target[] = [];
  const groups = new Map<string, HTMLInputElement[]>();

  const base = (el: HTMLElement, kind: Kind, question: string): Target => ({
    kind,
    el,
    group: [],
    question,
    hints: hintsOf(el),
    autocomplete: el.getAttribute('autocomplete') ?? '',
    inputType: (el as HTMLInputElement).type ?? '',
    required: isRequired(el, question),
  });

  for (const el of Array.from(doc.querySelectorAll<HTMLElement>(CONTROLS))) {
    if ((el as HTMLInputElement).disabled || el.getAttribute('aria-disabled') === 'true') continue;
    if (el.closest('[data-jobfill-ui]')) continue;

    if (el instanceof HTMLInputElement) {
      const type = el.type.toLowerCase();
      if (type === 'file') {
        targets.push(base(el, 'file', questionFor(el)));
        continue;
      }
      if (type === 'radio' || type === 'checkbox') {
        // Styled radios hide the real input; what matters is whether its label shows.
        const shown = visible(el) || Array.from(el.labels ?? []).some(visible) || (el.parentElement && visible(el.parentElement));
        if (!shown) continue;
        const key = `${type}:${el.name || el.closest('fieldset, [role="radiogroup"], [role="group"]')?.id || Math.random()}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(el);
        continue;
      }
      if (SKIP_TYPES.has(type) || el.readOnly || !visible(el)) continue;
      if (el.getAttribute('role') === 'combobox') {
        targets.push(base(el, 'combobox', questionFor(el)));
        continue;
      }
      targets.push(base(el, 'text', questionFor(el)));
    } else if (el instanceof HTMLTextAreaElement) {
      if (el.readOnly || !visible(el)) continue;
      targets.push(base(el, 'text', questionFor(el)));
    } else if (el instanceof HTMLSelectElement) {
      // Many custom dropdowns hide the native select behind their own widget; fill it anyway.
      targets.push(base(el, 'select', questionFor(el)));
    } else if (visible(el)) {
      targets.push(base(el, 'combobox', questionFor(el)));
    }
  }

  for (const [key, group] of groups) {
    const kind: Kind = key.startsWith('radio') ? 'radio' : 'checkgroup';
    // A lone checkbox is almost always a consent box; ticking those is the applicant's call.
    if (kind === 'checkgroup' && group.length < 2) continue;
    const question = groupQuestion(group);
    targets.push({ ...base(group[0]!, kind, question), group });
  }

  return targets;
}

export interface Resolved {
  value: string;
  key?: string;
  matcher?: RegExp;
}

function findAnswer(answers: SavedAnswer[], question: string): SavedAnswer | undefined {
  const q = norm(question);
  if (!q) return undefined;
  let best: SavedAnswer | undefined;
  let bestScore = 0.7;
  for (const a of answers) {
    if (norm(a.question) === q) return a;
    const score = similarity(a.question, question);
    if (score > bestScore) {
      best = a;
      bestScore = score;
    }
  }
  return best;
}

export function profileKeyFor(t: Target): string | null {
  return classify({
    question: t.question,
    hints: t.hints,
    autocomplete: t.autocomplete,
    inputType: t.inputType,
    choice: t.kind !== 'text' && t.kind !== 'file',
  });
}

interface Page {
  targets: Target[];
  keyOf: Map<Target, string | null>;
  german: boolean;
}

const GERMAN_LABEL = /\b(vorname|nachname|strasse|anschrift|plz|ort|telefon|lebenslauf|anschreiben|bitte|ihre?|deine?|bewerbung)\b/;

/** Fields plus what each one is, with page-level context single fields can't give. */
export function analyse(doc: Document, opts: EngineOptions = {}): Page {
  const targets = collectTargets(doc, opts);
  const keyOf = new Map(targets.map((t) => [t, profileKeyFor(t)] as const));
  // German forms often pair "Vorname" with a plain "Name", which then means surname.
  const keys = new Set(keyOf.values());
  if (keys.has('firstName') && !keys.has('lastName')) {
    for (const [t, key] of keyOf) {
      if (key === 'fullName' && /^((ihr|dein|your) )?name$/.test(norm(t.question))) keyOf.set(t, 'lastName');
    }
  }
  const lang = doc.documentElement.lang.toLowerCase();
  const german = lang ? lang.startsWith('de') : targets.some((t) => GERMAN_LABEL.test(norm(t.question)));
  return { targets, keyOf, german };
}

export function resolve(t: Target, data: FillData, key = profileKeyFor(t), german = false): Resolved | null {
  if (key) {
    const raw = profileValue(data.profile, key);
    if (raw) {
      const value =
        key === 'birthDate' && t.inputType !== 'date'
          ? formatDate(raw, (t.el as HTMLInputElement).placeholder ?? '', german)
          : displayValue(key, raw, german);
      return { key, value, matcher: enumMatcher(key, raw) };
    }
  }
  // A field the profile could have answered but is blank stays blank, rather than
  // being filled by a loosely similar saved answer.
  if (key) return null;
  const answer = findAnswer(data.answers, t.question);
  return answer ? { value: answer.answer } : null;
}

function fire(el: Element, type: string) {
  const event =
    type.startsWith('mouse') || type === 'click'
      ? new MouseEvent(type, { bubbles: true, cancelable: true, view: el.ownerDocument.defaultView })
      : new Event(type, { bubbles: true });
  el.dispatchEvent(event);
}

/** Set a value through the native setter so React/Vue-controlled inputs register it. */
function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  el.focus();
  if (setter) setter.call(el, value);
  else el.value = value;
  fire(el, 'input');
  fire(el, 'change');
  el.blur();
}

/** Input types that take free text, where typing key by key is safe. Date and number pickers aren't. */
const TYPEABLE = new Set(['text', 'email', 'tel', 'url', '']);

export function isTypeable(el: Element): el is HTMLInputElement | HTMLTextAreaElement {
  return el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && TYPEABLE.has(el.type));
}

function keyCode(ch: string): string {
  if (/[a-z]/i.test(ch)) return `Key${ch.toUpperCase()}`;
  if (/\d/.test(ch)) return `Digit${ch}`;
  return ch === ' ' ? 'Space' : '';
}

function focusEvents(el: HTMLElement, kind: 'focus' | 'blur') {
  // In a background tab focus()/blur() change nothing and fire no events, so send them.
  const doc = el.ownerDocument;
  if (kind === 'focus') {
    el.focus();
    if (doc.activeElement !== el) {
      el.dispatchEvent(new FocusEvent('focus'));
      el.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    }
  } else {
    const wasActive = doc.activeElement === el;
    el.blur();
    if (!wasActive) {
      el.dispatchEvent(new FocusEvent('blur'));
      el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    }
  }
}

/**
 * Type `value` one character at a time with the events a keyboard produces, for sites
 * that only notice text arriving through key and input events (validation on keyup,
 * frameworks reading InputEvent.data). Runs synchronously, so it's as fast as setting
 * the value. Falls back to setting it outright if the page swallowed every keystroke.
 */
export function typeText(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  const set = (v: string) => (setter ? setter.call(el, v) : (el.value = v));

  focusEvents(el, 'focus');
  // Keep a prefix the field already holds when the value starts with it, e.g. the "+49"
  // a phone widget puts in; clearing it would make some widgets add it right back.
  if (el.value && !value.startsWith(el.value)) {
    el.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'deleteContentBackward' }));
    set('');
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
    if (el.value && !value.startsWith(el.value)) set('');
  }

  for (const ch of value.slice(el.value.length)) {
    const key = ch === '\n' ? 'Enter' : ch;
    const keyInit = { key, code: keyCode(ch), bubbles: true, cancelable: true };
    const down = el.dispatchEvent(new KeyboardEvent('keydown', keyInit));
    el.dispatchEvent(new KeyboardEvent('keypress', { ...keyInit, charCode: ch.charCodeAt(0) }));
    const inputType = ch === '\n' ? 'insertLineBreak' : 'insertText';
    const before = el.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType, data: ch }));
    // A page that cancels the keystroke handles insertion itself (input masks do).
    if (down && before) {
      set(el.value + ch);
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType, data: ch }));
    }
    el.dispatchEvent(new KeyboardEvent('keyup', keyInit));
  }

  if (!el.value && value) {
    set(value);
    fire(el, 'input');
  }
  fire(el, 'change');
  focusEvents(el, 'blur');
}

function currentValue(t: Target): string {
  const el = t.el;
  switch (t.kind) {
    case 'text': {
      const v = (el as HTMLInputElement).value.trim();
      // Phone widgets pre-fill the dialling code ("+49"); that isn't an answer yet.
      return /^\+\d{1,4}$/.test(v) ? '' : v;
    }
    case 'select': {
      const s = el as HTMLSelectElement;
      const opt = s.selectedOptions[0];
      return opt && !isPlaceholderOption(opt.text) && s.value ? opt.text.trim() : '';
    }
    case 'radio':
    case 'checkgroup':
      return t.group
        .filter((r) => r.checked)
        .map(optionText)
        .join(', ');
    case 'combobox':
      return comboboxValue(el);
    case 'file':
      return (el as HTMLInputElement).files?.length ? 'file' : '';
  }
}

function comboboxValue(el: HTMLElement): string {
  if (el instanceof HTMLButtonElement) {
    const text = textOf(el);
    return isPlaceholderOption(text) ? '' : text;
  }
  // react-select style widgets render the chosen value next to the input.
  let node: Element | null = el.parentElement;
  for (let i = 0; node && i < 4; i++, node = node.parentElement) {
    const single = node.querySelector('[class*="singleValue" i], [class*="single-value" i]');
    if (single?.textContent?.trim()) return single.textContent.trim();
  }
  return (el as HTMLInputElement).value?.trim() ?? '';
}

const FILLED_STYLE = '2px solid #2F9461';
const ATTENTION_STYLE = '2px solid #D99A1E';

function mark(t: Target, outline: string) {
  const el = t.el;
  // A radio group has no single box to outline, so outline its group instead.
  const group = t.kind === 'radio' || t.kind === 'checkgroup';
  const box = (group && (el.closest('fieldset, [role="radiogroup"], [role="group"]') as HTMLElement | null)) || el;
  box.style.setProperty('outline', outline, 'important');
  box.style.setProperty('outline-offset', '2px', 'important');
  const clear = () => {
    box.style.removeProperty('outline');
    box.style.removeProperty('outline-offset');
  };
  el.addEventListener('input', clear, { once: true });
  el.addEventListener('change', clear, { once: true });
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Options of the popup this combobox opened. Pages keep other option lists around (a
 * phone field's hidden country picker, for one), so prefer the listbox the combobox
 * points at and otherwise take only options that are on screen.
 */
function openOptions(el: HTMLElement, visible: (el: Element) => boolean): HTMLElement[] {
  const doc = el.ownerDocument;
  const ids = `${el.getAttribute('aria-controls') ?? ''} ${el.getAttribute('aria-owns') ?? ''}`.trim();
  const lists = ids
    .split(/\s+/)
    .map((i) => (i ? doc.getElementById(i) : null))
    .filter((n): n is HTMLElement => !!n);
  const scope: ParentNode[] = lists.length ? lists : [doc];
  return scope
    .flatMap((root) => Array.from(root.querySelectorAll<HTMLElement>('[role="option"]')))
    .filter((o) => o.getAttribute('aria-disabled') !== 'true' && !o.closest('[data-jobfill-ui]') && visible(o));
}

async function waitForOptions(el: HTMLElement, visible: (el: Element) => boolean, timeoutMs: number): Promise<HTMLElement[]> {
  const deadline = Date.now() + timeoutMs;
  do {
    const options = openOptions(el, visible);
    if (options.length) return options;
    await wait(80);
  } while (Date.now() < deadline);
  return [];
}

async function fillCombobox(t: Target, r: Resolved, timeoutMs: number, visible: (el: Element) => boolean): Promise<boolean> {
  const el = t.el;
  el.focus();
  fire(el, 'mousedown');
  fire(el, 'mouseup');
  fire(el, 'click');
  if (el instanceof HTMLInputElement) {
    // Typing filters long lists (countries, schools) down to a handful of options.
    setTypedValue(el, r.value);
  }
  let options = await waitForOptions(el, visible, timeoutMs);
  if (!options.length) {
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    options = await waitForOptions(el, visible, timeoutMs / 2);
  }
  const index = chooseOption(options.map((o) => o.textContent ?? ''), r.value, r.matcher);
  if (index < 0) {
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    if (el instanceof HTMLInputElement) setTypedValue(el, '');
    return false;
  }
  const option = options[index]!;
  option.scrollIntoView?.({ block: 'nearest' });
  fire(option, 'mousedown');
  fire(option, 'mouseup');
  fire(option, 'click');
  await wait(60);
  return true;
}

function setTypedValue(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(el, value);
  fire(el, 'input');
}

function dataUrlToFile(dataUrl: string, name: string, type: string): File {
  const [, b64] = dataUrl.split(',');
  const bytes = Uint8Array.from(atob(b64 ?? ''), (c) => c.charCodeAt(0));
  return new File([bytes], name, { type });
}

/** Which saved document an upload field wants, if any. */
export function documentFor(t: Target, all: Target[]): 'resume' | 'coverLetter' | null {
  const text = norm(`${t.question} ${t.hints}`);
  const resume = /resume|\bcv\b|lebenslauf|curriculum/.test(text);
  if (/cover|anschreiben|motivationsschreiben|motivation letter|begleitschreiben/.test(text) && !resume) return 'coverLetter';
  if (resume) return 'resume';
  if (/letter|transcript|zeugnis|certificate|zertifikat|photo|picture|avatar|foto|\bbild\b|portfolio|sonstige|weitere|other|additional|anlage/.test(text)) {
    return null;
  }
  return all.filter((x) => x.kind === 'file').length === 1 ? 'resume' : null;
}

function fillSync(t: Target, r: Resolved): boolean {
  const el = t.el;
  switch (t.kind) {
    case 'text': {
      const input = el as HTMLInputElement;
      if (input.type === 'number' && !/^-?\d+(\.\d+)?$/.test(r.value)) {
        const digits = r.value.match(/\d+/)?.[0];
        if (!digits) return false;
        setNativeValue(input, digits);
        return true;
      }
      if (input.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(r.value)) return false;
      if (isTypeable(input)) typeText(input, r.value);
      else setNativeValue(input, r.value);
      return true;
    }
    case 'select': {
      const select = el as HTMLSelectElement;
      const options = Array.from(select.options);
      const index = chooseOption(options.map((o) => o.text), r.value, r.matcher);
      if (index < 0) return false;
      select.value = options[index]!.value;
      fire(select, 'input');
      fire(select, 'change');
      return true;
    }
    case 'radio':
    case 'checkgroup': {
      const index = chooseOption(t.group.map(optionText), r.value, r.matcher);
      if (index < 0) return false;
      const choice = t.group[index]!;
      if (!choice.checked) choice.click();
      return true;
    }
    default:
      return false;
  }
}

/**
 * Fill every field we have an answer for. Never submits. Fields already holding a
 * value are left alone unless `data.overwrite` is set, so a second run is harmless.
 */
export async function fillPage(doc: Document, data: FillData, opts: EngineOptions = {}): Promise<FillReport> {
  const { targets, keyOf, german } = analyse(doc, opts);
  // Location fields search a places API as you type, so give options time to arrive.
  const timeoutMs = opts.optionTimeoutMs ?? 2500;
  let filled = 0;
  const done = new Set<Target>();
  const comboboxes: [Target, Resolved][] = [];

  for (const t of targets) {
    if (!data.overwrite && currentValue(t)) {
      done.add(t);
      continue;
    }
    if (t.kind === 'file') {
      const which = documentFor(t, targets);
      const file = which === 'resume' ? data.resume : which === 'coverLetter' ? data.coverLetter : undefined;
      if (file) {
        try {
          const dt = new DataTransfer();
          dt.items.add(dataUrlToFile(file.dataUrl, file.name, file.type));
          (t.el as HTMLInputElement).files = dt.files;
          fire(t.el, 'input');
          fire(t.el, 'change');
          filled++;
          done.add(t);
        } catch {
          // DataTransfer is missing in some test environments; leave the upload to the user.
        }
      }
      continue;
    }
    const r = resolve(t, data, keyOf.get(t) ?? null, german);
    if (!r) continue;
    if (t.kind === 'combobox') {
      comboboxes.push([t, r]);
      continue;
    }
    if (fillSync(t, r)) {
      filled++;
      done.add(t);
      mark(t, FILLED_STYLE);
    }
  }

  // Custom dropdowns open one shared popup, so they have to go one at a time.
  for (const [t, r] of comboboxes) {
    if (await fillCombobox(t, r, timeoutMs, opts.isVisible ?? defaultIsVisible)) {
      filled++;
      done.add(t);
      mark(t, FILLED_STYLE);
    }
  }

  let needsYou = 0;
  for (const t of targets) {
    if (done.has(t) || t.kind === 'file' || !t.required || currentValue(t)) continue;
    needsYou++;
    mark(t, ATTENTION_STYLE);
  }
  return { filled, needsYou };
}

export type RowStatus = 'missing' | 'unknown' | 'ready' | 'onPage';

/** One form field as the side panel shows it: what it is, and whether Jobfill can answer it. */
export interface FieldRow {
  target: Target;
  question: string;
  /** Profile key the field maps to, or null for questions the profile doesn't cover */
  key: string | null;
  /** Saved answer used for a question the profile doesn't cover */
  answer?: SavedAnswer;
  /** Upload fields: which saved document belongs there */
  document?: 'resume' | 'coverLetter' | null;
  /** What Jobfill would put in (raw profile value, answer text, or file name) */
  value: string;
  /** What the page field holds right now */
  pageValue: string;
  status: RowStatus;
  /** Options a dropdown or radio group on the page offers */
  choices: string[];
}

function choicesOf(t: Target): string[] {
  if (t.kind === 'select') {
    return Array.from((t.el as HTMLSelectElement).options)
      .map((o) => o.text.trim())
      .filter((text) => !isPlaceholderOption(text));
  }
  if (t.kind === 'radio' || t.kind === 'checkgroup') return t.group.map(optionText);
  return [];
}

/** Country-code pickers that sit beside phone fields. */
const DIAL_CODE = /vorwahl|country code|dial code|calling code|laendercode/;

const byPagePosition =(a: Target, b: Target) =>
  a.el === b.el ? 0 : a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;

/** Every field on the page, in page order, with what Jobfill knows about it. */
export function describePage(doc: Document, data: FillData, opts: EngineOptions = {}): FieldRow[] {
  const { targets, keyOf } = analyse(doc, opts);
  const rows: FieldRow[] = [];
  for (const t of [...targets].sort(byPagePosition)) {
    const key = keyOf.get(t) ?? null;
    const question = cleanLabel(t.question);
    const pageValue = currentValue(t);
    if (t.kind === 'file') {
      const which = documentFor(t, targets);
      const file = which === 'resume' ? data.resume : which === 'coverLetter' ? data.coverLetter : undefined;
      const status: RowStatus = pageValue ? 'onPage' : which ? (file ? 'ready' : 'missing') : 'unknown';
      rows.push({ target: t, question: question || 'File upload', key: null, document: which, value: file?.name ?? '', pageValue, status, choices: [] });
      continue;
    }
    // Unlabelled widgets (a phone field's country-code picker) are noise in a list of questions.
    if (!key && (norm(question).length < 3 || DIAL_CODE.test(norm(question)))) continue;
    const answer = key ? undefined : findAnswer(data.answers, t.question);
    const value = key ? profileValue(data.profile, key) : (answer?.answer ?? '');
    const status: RowStatus = pageValue ? 'onPage' : value ? 'ready' : key ? 'missing' : 'unknown';
    rows.push({ target: t, question, key, answer, value, pageValue, status, choices: choicesOf(t) });
  }
  return rows;
}

/** Scroll a field into view and flash it, so the applicant can find it. */
export function revealTarget(t: Target): void {
  const box = (t.kind === 'radio' || t.kind === 'checkgroup' ? t.el.closest('fieldset') : null) ?? t.el;
  const el = (box.getClientRects().length ? box : (t.el.closest('label, div') ?? box)) as HTMLElement;
  el.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  el.style.setProperty('outline', '3px solid #2450C8', 'important');
  el.style.setProperty('outline-offset', '3px', 'important');
  setTimeout(() => {
    el.style.removeProperty('outline');
    el.style.removeProperty('outline-offset');
  }, 1600);
}

/** Fields that look like a job application rather than a login or search box. */
export function looksLikeApplication(doc: Document, opts: EngineOptions = {}): boolean {
  const { targets, keyOf } = analyse(doc, opts);
  if (targets.length < 3) return false;
  const keys = new Set(keyOf.values());
  const hasFile = targets.some((t) => t.kind === 'file');
  return (keys.has('email') || keys.has('firstName') || keys.has('fullName')) && (hasFile || targets.length >= 5);
}

/**
 * Questions the applicant answered that the profile doesn't cover, so they can be
 * offered next time. Called when the application is submitted.
 */
export function captureAnswers(doc: Document, opts: EngineOptions = {}): { question: string; answer: string }[] {
  const out: { question: string; answer: string }[] = [];
  const seen = new Set<string>();
  const { targets, keyOf } = analyse(doc, opts);
  for (const t of targets) {
    if (t.kind === 'file' || keyOf.get(t)) continue;
    const question = cleanLabel(t.question);
    const answer = currentValue(t);
    const key = norm(question);
    if (key.length < 4 || !answer || answer.length > 5000 || seen.has(key)) continue;
    if (SENSITIVE.test(key) || SENSITIVE.test(t.hints)) continue;
    seen.add(key);
    out.push({ question, answer });
  }
  return out;
}
