import { beforeEach, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/lib/types';

const state = vi.hoisted(() => ({
  enabled: false,
  listener: null as null | ((msg: unknown) => unknown),
  fillPage: vi.fn(async () => ({ filled: 1, needsYou: 0 })),
  recordJob: vi.fn(),
  learnAnswers: vi.fn(),
  setVisible: vi.fn(),
  refresh: null as null | (() => void),
}));
vi.mock('wxt/utils/define-content-script', () => ({ defineContentScript: (config: unknown) => config }));
vi.mock('wxt/browser', () => ({
  browser: { runtime: { onMessage: { addListener: (fn: typeof state.listener) => { state.listener = fn; } } } },
}));
vi.mock('../src/lib/store', () => ({
  getSettings: async () => ({ ...DEFAULT_SETTINGS, enabled: state.enabled }),
  getAll: async () => ({ profile: { firstName: 'Slim' }, answers: [], settings: { ...DEFAULT_SETTINGS, enabled: state.enabled } }),
  getApplications: async () => [],
  findApplication: () => undefined,
  recordJob: state.recordJob,
  learnAnswers: state.learnAnswers,
  updateApplication: vi.fn(),
  onChange: (fn: () => void) => { state.refresh = fn; return () => {}; },
}));
vi.mock('../src/lib/fill', () => ({
  looksLikeApplication: () => true,
  fillPage: state.fillPage,
  captureAnswers: () => [],
  describePage: () => [],
}));
vi.mock('../src/content/panel', () => ({
  createPanel: () => ({ setVisible: state.setVisible, refresh: vi.fn(), destroy: vi.fn(), isOpen: false }),
}));
import content from '../src/entrypoints/content';

beforeEach(() => {
  vi.clearAllMocks();
  state.enabled = false;
  document.body.replaceChildren();
});

it('blocks filling and tracking while off, then resumes without a reload', async () => {
  const cleanup: (() => void)[] = [];
  content.main({ onInvalidated: (fn: () => void) => cleanup.push(fn) } as never);
  await vi.waitFor(() => expect(state.setVisible).toHaveBeenLastCalledWith(false));
  await state.listener?.({ type: 'fill' });
  await state.listener?.({ type: 'mark-applied' });
  await state.listener?.({ type: 'save-job' });
  expect(state.fillPage).not.toHaveBeenCalled();
  expect(state.recordJob).not.toHaveBeenCalled();
  expect(state.learnAnswers).not.toHaveBeenCalled();

  state.enabled = true;
  state.refresh?.();
  await vi.waitFor(() => expect(state.setVisible).toHaveBeenLastCalledWith(true));
  await state.listener?.({ type: 'fill' });
  expect(state.fillPage).toHaveBeenCalledOnce();
  expect(state.recordJob).toHaveBeenCalledOnce();
  cleanup.forEach((fn) => fn());
});
