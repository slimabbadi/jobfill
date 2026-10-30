import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { analyse, captureAnswers, documentFor, fillPage, looksLikeApplication } from '../src/lib/fill';
import { classify } from '../src/lib/fields';
import { cleanTitle, extractJob, looksLikeConfirmation } from '../src/lib/job';
import type { FillData } from '../src/lib/types';

const opts = { isVisible: () => true, optionTimeoutMs: 50 };

function load(name: string, lang = '') {
  document.documentElement.lang = lang;
  document.body.innerHTML = readFileSync(join(__dirname, 'fixtures', name), 'utf8');
}

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const value = (sel: string) => $<HTMLInputElement>(sel).value;
const selectedText = (sel: string) => $<HTMLSelectElement>(sel).selectedOptions[0]?.text;

const data: FillData = {
  profile: {
    salutation: 'ms',
    firstName: 'Lena',
    lastName: 'Schröder',
    email: 'lena@example.de',
    phone: '+49 151 2345678',
    address1: 'Große Bergstraße 12',
    postalCode: '22767',
    city: 'Hamburg',
    country: 'Deutschland',
    birthDate: '1994-03-07',
    nationality: 'deutsch',
    noticePeriod: '3 Monate zum Monatsende',
    startDate: '01.02.2027',
    salary: '75.000 € brutto/Jahr',
    germanLevel: 'native',
    englishLevel: 'c2',
    workAuthorized: 'yes',
    linkedin: 'https://www.linkedin.com/in/lena',
    xing: 'https://www.xing.com/profile/Lena_Schroeder',
    github: 'https://github.com/lena',
  },
  answers: [{ id: '1', question: 'Wie sind Sie auf uns aufmerksam geworden?', answer: 'StepStone', updatedAt: 0 }],
  overwrite: false,
};

describe('Recruitee form from jobs.demv-systems.de', () => {
  beforeEach(() => load('recruitee-demv.html', 'de'));

  it('is recognised as an application', () => {
    expect(looksLikeApplication(document, opts)).toBe(true);
  });

  it('fills name, contact, salary and profile links', async () => {
    await fillPage(document, data, opts);
    expect(value('[name="candidate.name"]')).toBe('Lena Schröder');
    expect(value('[name="candidate.email"]')).toBe('lena@example.de');
    expect(value('[name="candidate.phone"]')).toBe('+49 151 2345678');
    expect(value('#q1')).toBe('75.000 € brutto/Jahr');
    expect(value('#q2')).toBe('https://www.xing.com/profile/Lena_Schroeder');
    expect(value('#q3')).toBe('https://www.linkedin.com/in/lena');
    expect(value('#q4')).toBe('https://github.com/lena');
    expect(value('#q5')).toBe('');
  });

  it('leaves the privacy consent box for the applicant to tick', async () => {
    await fillPage(document, data, opts);
    expect($<HTMLInputElement>('[name="candidate.agreements.0.consent"]').checked).toBe(false);
  });

  it('picks the resume upload', () => {
    const { targets } = analyse(document, opts);
    const cv = targets.find((t) => t.kind === 'file')!;
    expect(documentFor(cv, targets)).toBe('resume');
  });
});

describe('typical German form', () => {
  beforeEach(() => load('german-form.html'));

  it('fills German labels, dropdowns and Ja/Nein questions', async () => {
    await fillPage(document, data, opts);
    expect(selectedText('#anrede')).toBe('Frau');
    expect(value('#titel')).toBe('');
    expect(value('#vorname')).toBe('Lena');
    expect(value('#name')).toBe('Schröder');
    expect(value('#mail')).toBe('lena@example.de');
    expect(value('#tel')).toBe('+49 151 2345678');
    expect(value('#strasse')).toBe('Große Bergstraße 12');
    expect(value('#plz')).toBe('22767');
    expect(value('#ort')).toBe('Hamburg');
    expect(selectedText('#land')).toBe('Deutschland');
    expect(value('#geb')).toBe('07.03.1994');
    expect(value('#nat')).toBe('deutsch');
    expect(value('#kf')).toBe('3 Monate zum Monatsende');
    expect(value('#eintritt')).toBe('01.02.2027');
    expect(value('#gehalt')).toBe('75.000 € brutto/Jahr');
    expect(selectedText('#de')).toBe('Muttersprache');
    expect(selectedText('#en')).toBe('C2');
    expect($<HTMLInputElement>('input[name="permit"][value="ja"]').checked).toBe(true);
    expect(value('#xing')).toBe('https://www.xing.com/profile/Lena_Schroeder');
    expect(selectedText('#quelle')).toBe('StepStone');
    expect($<HTMLInputElement>('[name="privacy"]').checked).toBe(false);
  });

  it('matches German and English level words to the saved level', async () => {
    await fillPage(document, { ...data, profile: { ...data.profile, germanLevel: 'c1', englishLevel: 'b2' } }, opts);
    expect(selectedText('#de')).toBe('Fließend');
    expect(selectedText('#en')).toBe('B2');
  });

  it('sends the resume and cover letter to the right uploads, and skips certificates', () => {
    const { targets } = analyse(document, opts);
    const files = targets.filter((t) => t.kind === 'file');
    expect(files.map((t) => documentFor(t, targets))).toEqual(['resume', 'coverLetter', null]);
  });

  it('learns German answers the profile does not cover', async () => {
    $<HTMLSelectElement>('#quelle').value = 'XING';
    expect(captureAnswers(document, opts)).toContainEqual({ question: 'Wie sind Sie auf uns aufmerksam geworden?', answer: 'XING' });
  });
});

describe('German labels', () => {
  const c = (question: string) => classify({ question, hints: '', autocomplete: '', inputType: 'text' });

  it.each([
    ['Vorname und Nachname', 'fullName'],
    ['Familienname', 'lastName'],
    ['Rufname', 'preferredName'],
    ['Handynummer', 'phone'],
    ['Postleitzahl', 'postalCode'],
    ['Wohnort', 'city'],
    ['Bundesland', 'state'],
    ['Aktueller Arbeitgeber', 'currentCompany'],
    ['Berufsbezeichnung', 'currentTitle'],
    ['Höchster Abschluss', 'degree'],
    ['Studiengang', 'major'],
    ['Hochschule / Universität', 'school'],
    ['Wie viele Jahre Berufserfahrung haben Sie?', 'yearsExperience'],
    ['Benötigen Sie ein Visum?', 'needsSponsorship'],
    ['Wären Sie bereit, für die Stelle umzuziehen?', 'willingToRelocate'],
    ['Telefonnummer der Referenz', null],
    ['E-Mail des Ansprechpartners', null],
  ])('%s -> %s', (question, key) => {
    expect(c(question)).toBe(key);
  });
});

describe('German job pages', () => {
  it('detects Recruitee on a company domain from the assets it loads', () => {
    const d = document.implementation.createHTMLDocument('DEMV Systems Gmbh - Full Stack Developer (m/w/d) - Bewerbung');
    d.head.innerHTML = '<script src="https://careers.recruiteecdn.com/assets/app.js"></script>';
    d.body.innerHTML = `<script type="application/ld+json">${JSON.stringify({
      '@type': 'JobPosting',
      title: 'Senior Full Stack Developer – AI Automation (m/w/d)',
      hiringOrganization: { name: 'DEMV Systems' },
      applicantLocationRequirements: [{ '@type': 'Country', name: 'Deutschland' }],
    })}</script>`;
    const job = extractJob(d, 'https://jobs.demv-systems.de/o/senior-full-stack-developer/c/new?source=LinkedIn');
    expect(job).toMatchObject({
      source: 'Recruitee',
      company: 'DEMV Systems',
      title: 'Senior Full Stack Developer – AI Automation',
      location: 'Deutschland',
    });
  });

  it.each([
    ['Personio', 'https://acme.jobs.personio.de/job/12345'],
    ['softgarden', 'https://acme.softgarden.io/job/123'],
    ['JOIN', 'https://join.com/companies/acme/123-developer'],
    ['SuccessFactors', 'https://career5.successfactors.eu/career?company=acme'],
    ['StepStone', 'https://www.stepstone.de/stellenangebote--Developer-Hamburg-ACME--123-inline.html'],
  ])('recognises %s by its address', (name, href) => {
    expect(extractJob(document.implementation.createHTMLDocument(''), href).source).toBe(name);
  });

  it('strips gender markers from titles', () => {
    expect(cleanTitle('Full Stack Developer (m/w/d)')).toBe('Full Stack Developer');
    expect(cleanTitle('Werkstudent Marketing (w/m/x)')).toBe('Werkstudent Marketing');
    expect(cleanTitle('Data Engineer (all genders)')).toBe('Data Engineer');
  });

  it('spots German thank-you pages', () => {
    const d = document.implementation.createHTMLDocument('');
    d.body.innerHTML = '<h1>Vielen Dank für Ihre Bewerbung!</h1>';
    expect(looksLikeConfirmation(d)).toBe(true);
    d.body.innerHTML = '<p>Deine Bewerbung wurde erfolgreich übermittelt.</p>';
    expect(looksLikeConfirmation(d)).toBe(true);
  });
});
