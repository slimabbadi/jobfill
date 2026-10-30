import { describe, expect, it } from 'vitest';
import { isTypeable, typeText } from '../src/lib/fill';

function input(html = '<input type="text">') {
  document.body.innerHTML = html;
  return document.body.firstElementChild as HTMLInputElement;
}

describe('typeText', () => {
  it('types character by character with keyboard and input events', () => {
    const el = input();
    const seen: string[] = [];
    el.addEventListener('keydown', (e) => seen.push(`down:${e.key}`));
    el.addEventListener('input', (e) => seen.push(`input:${(e as InputEvent).data}`));
    el.addEventListener('keyup', (e) => seen.push(`up:${e.key}`));
    typeText(el, 'Lena');
    expect(el.value).toBe('Lena');
    expect(seen.slice(0, 3)).toEqual(['down:L', 'input:L', 'up:L']);
    expect(seen.filter((s) => s.startsWith('input:')).map((s) => s.slice(6))).toEqual(['L', 'e', 'n', 'a']);
  });

  it('works for sites that build the value from each keystroke', () => {
    const el = input();
    // Like a controlled component that only trusts InputEvent.data.
    let state = '';
    el.addEventListener('input', (e) => {
      state += (e as InputEvent).data ?? '';
      el.value = state;
    });
    typeText(el, 'lena@example.de');
    expect(state).toBe('lena@example.de');
    expect(el.value).toBe('lena@example.de');
  });

  it('lets input masks that handle keystrokes themselves do the inserting', () => {
    const el = input('<input type="tel">');
    el.addEventListener('beforeinput', (e) => {
      const data = (e as InputEvent).data;
      e.preventDefault();
      if (data && /\d/.test(data)) el.value += data;
    });
    typeText(el, '+49 151 23');
    expect(el.value).toBe('4915123');
  });

  it('keeps a dialling-code prefix the field already holds', () => {
    const el = input('<input type="tel" value="+49">');
    typeText(el, '+49 151 2345678');
    expect(el.value).toBe('+49 151 2345678');
  });

  it('replaces other existing text', () => {
    const el = input('<input type="text" value="old">');
    typeText(el, 'new');
    expect(el.value).toBe('new');
  });

  it('falls back to setting the value when the page swallows every keystroke', () => {
    const el = input();
    el.addEventListener('keydown', (e) => e.preventDefault());
    typeText(el, 'Hamburg');
    expect(el.value).toBe('Hamburg');
  });

  it('types line breaks into text areas', () => {
    document.body.innerHTML = '<textarea></textarea>';
    const ta = document.querySelector('textarea')!;
    typeText(ta, 'Hallo\nTschüss');
    expect(ta.value).toBe('Hallo\nTschüss');
  });

  it('fires change once at the end', () => {
    const el = input();
    let changes = 0;
    el.addEventListener('change', () => changes++);
    typeText(el, 'abc');
    expect(changes).toBe(1);
  });

  it('only applies to free-text fields', () => {
    expect(isTypeable(input('<input type="email">'))).toBe(true);
    expect(isTypeable(input('<input>'))).toBe(true);
    expect(isTypeable(input('<input type="date">'))).toBe(false);
    expect(isTypeable(input('<input type="number">'))).toBe(false);
    document.body.innerHTML = '<textarea></textarea>';
    expect(isTypeable(document.querySelector('textarea')!)).toBe(true);
  });
});
