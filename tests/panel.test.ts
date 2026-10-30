import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { describePage } from '../src/lib/fill';
import type { FillData } from '../src/lib/types';

const opts = { isVisible: () => true };

function load(name: string) {
  document.documentElement.lang = 'de';
  document.body.innerHTML = readFileSync(join(__dirname, 'fixtures', name), 'utf8');
}

const data: FillData = {
  profile: { firstName: 'Lena', lastName: 'Schröder', email: 'lena@example.de', linkedin: 'https://linkedin.com/in/lena' },
  answers: [],
  resume: { name: 'cv.pdf', type: 'application/pdf', size: 1, dataUrl: 'data:application/pdf;base64,' },
  overwrite: false,
};

describe('describePage', () => {
  it('sorts the DEMV form into ready, missing, unknown and already filled', () => {
    load('recruitee-demv.html');
    const rows = describePage(document, data, opts);
    const byQuestion = Object.fromEntries(rows.map((r) => [r.question, r.status]));
    expect(byQuestion).toMatchObject({
      'Vor- und Nachname': 'ready',
      'E-Mail-Adresse': 'ready',
      Telefonnummer: 'missing',
      Lebenslauf: 'ready',
      Gehaltsvorstellung: 'missing',
      Xing: 'missing',
      LinkedIn: 'ready',
      'Möchtest Du noch etwas los werden?': 'unknown',
    });
    // Rows follow the page's order, so the panel reads like the form.
    expect(rows.map((r) => r.question).slice(0, 3)).toEqual(['Vor- und Nachname', 'E-Mail-Adresse', 'Telefonnummer']);
  });

  it('marks fields the page already filled, and lists a dropdown’s choices', () => {
    load('german-form.html');
    (document.querySelector('#plz') as HTMLInputElement).value = '20095';
    const rows = describePage(document, data, opts);
    expect(rows.find((r) => r.question === 'PLZ')).toMatchObject({ status: 'onPage', pageValue: '20095', key: 'postalCode' });
    expect(rows.find((r) => r.question.startsWith('Wie sind Sie'))).toMatchObject({
      status: 'unknown',
      choices: ['LinkedIn', 'StepStone', 'XING', 'Sonstiges'],
    });
    expect(rows.find((r) => r.question === 'Anschreiben')).toMatchObject({ document: 'coverLetter', status: 'missing' });
    expect(rows.find((r) => r.question === 'Zeugnisse')).toMatchObject({ document: null, status: 'unknown' });
  });

  it('uses a saved answer for questions the profile does not cover', () => {
    load('german-form.html');
    const answers = [{ id: 'a', question: 'Wie sind Sie auf uns aufmerksam geworden?', answer: 'XING', updatedAt: 0 }];
    const row = describePage(document, { ...data, answers }, opts).find((r) => r.question.startsWith('Wie sind Sie'));
    expect(row).toMatchObject({ status: 'ready', value: 'XING' });
    expect(row?.answer?.id).toBe('a');
  });
});
