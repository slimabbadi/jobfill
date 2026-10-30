import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { captureAnswers, fillPage, looksLikeApplication } from '../src/lib/fill';
import { classify } from '../src/lib/fields';
import type { FillData } from '../src/lib/types';

const opts = { isVisible: () => true, optionTimeoutMs: 50 };

function load(name: string) {
  document.body.innerHTML = readFileSync(join(__dirname, 'fixtures', name), 'utf8');
}

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const selectedText = (sel: string) => $<HTMLSelectElement>(sel).selectedOptions[0]?.text;

const data: FillData = {
  profile: {
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    phone: '+44 20 7946 0000',
    linkedin: 'https://linkedin.com/in/ada',
    github: 'https://github.com/ada',
    portfolio: 'https://ada.dev',
    currentCompany: 'Analytical Engines Ltd',
    workAuthorized: 'yes',
    needsSponsorship: 'no',
    willingToRelocate: 'yes',
    gender: 'female',
    veteran: 'no',
    disability: 'decline',
  },
  answers: [{ id: '1', question: 'How did you hear about this job?', answer: 'LinkedIn', updatedAt: 0 }],
  overwrite: false,
};

describe('Greenhouse-style form', () => {
  beforeEach(() => load('greenhouse.html'));

  it('is recognised as an application', () => {
    expect(looksLikeApplication(document, opts)).toBe(true);
  });

  it('fills profile fields, dropdowns and saved answers', async () => {
    const report = await fillPage(document, data, opts);

    expect($<HTMLInputElement>('#first_name').value).toBe('Ada');
    expect($<HTMLInputElement>('#last_name').value).toBe('Lovelace');
    expect($<HTMLInputElement>('#email').value).toBe('ada@example.com');
    expect($<HTMLInputElement>('#phone').value).toBe('+44 20 7946 0000');
    expect($<HTMLInputElement>('#q1').value).toBe('https://linkedin.com/in/ada');
    expect($<HTMLInputElement>('#q2').value).toBe('https://ada.dev');
    expect(selectedText('#q3')).toBe('Yes');
    expect(selectedText('#q4')).toBe('No');
    expect($<HTMLInputElement>('#q5').value).toBe('LinkedIn');
    expect(selectedText('#gender')).toBe('Female');
    expect(selectedText('#veteran')).toBe('I am not a protected veteran');
    expect(selectedText('#disability')).toBe('I do not want to answer');
    expect(report.filled).toBe(12);
  });

  it('leaves pre-filled values and open questions alone, and flags required blanks', async () => {
    const report = await fillPage(document, data, opts);
    expect($<HTMLInputElement>('#q7').value).toBe('PREFILLED');
    expect($<HTMLTextAreaElement>('#q6').value).toBe('');
    expect(report.needsYou).toBe(1);
  });

  it('does not fill a field the profile covers but left blank', async () => {
    await fillPage(document, { ...data, profile: { ...data.profile, phone: '' } }, opts);
    expect($<HTMLInputElement>('#phone').value).toBe('');
  });

  it('captures answers to questions the profile does not cover', async () => {
    await fillPage(document, data, opts);
    $<HTMLTextAreaElement>('#q6').value = 'Because payments are fun.';
    const captured = captureAnswers(document, opts);
    expect(captured).toContainEqual({
      question: expect.stringMatching(/^Why do you want to work at Stripe/),
      answer: 'Because payments are fun.',
    });
    expect(captured.some((c) => c.question.startsWith('First Name'))).toBe(false);
  });
});

describe('Lever-style form', () => {
  beforeEach(() => load('lever.html'));

  it('reads labels from sibling containers and fills radios', async () => {
    await fillPage(document, data, opts);
    expect($<HTMLInputElement>('input[name="name"]').value).toBe('Ada Lovelace');
    expect($<HTMLInputElement>('input[name="email"]').value).toBe('ada@example.com');
    expect($<HTMLInputElement>('input[name="org"]').value).toBe('Analytical Engines Ltd');
    expect($<HTMLInputElement>('input[name="urls[GitHub]"]').value).toBe('https://github.com/ada');
    expect($<HTMLInputElement>('input[name="cards[abc][field0]"][value="Yes"]').checked).toBe(true);
  });

  it('remembers a radio answer and reuses it on the next form', async () => {
    $<HTMLInputElement>('input[value="CET"]').click();
    const captured = captureAnswers(document, opts);
    expect(captured).toContainEqual({ question: 'Which time zone do you work in?', answer: 'CET' });

    load('lever.html');
    const answers = captured.map((c, i) => ({ id: String(i), ...c, updatedAt: 0 }));
    await fillPage(document, { ...data, answers }, opts);
    expect($<HTMLInputElement>('input[value="CET"]').checked).toBe(true);
  });
});

describe('classify', () => {
  const c = (question: string, hints = '') => classify({ question, hints, autocomplete: '', inputType: 'text' });

  it.each([
    ['Preferred First Name', 'preferredName'],
    ['Email address', 'email'],
    ['Street address', 'address1'],
    ['Will you require visa sponsorship?', 'needsSponsorship'],
    ['Are you authorized to work in Canada?', 'workAuthorized'],
    ['Desired salary', 'salary'],
    ['Graduation year', 'gradYear'],
    ['Field of study', 'major'],
    ['Referrer email', null],
    ['Emergency contact phone', null],
    ['Phone device type', null],
  ])('%s -> %s', (question, key) => {
    expect(c(question)).toBe(key);
  });

  it('falls back to name/id only when there is no label', () => {
    expect(c('', 'job application first name')).toBe('firstName');
    expect(c('Tell us something surprising', 'job application first name')).toBe(null);
  });

  it('ignores long free-form questions that mention a keyword', () => {
    expect(c('Describe a time you had to relocate a service between data centres and what you learned from the experience')).toBe(null);
  });
});
