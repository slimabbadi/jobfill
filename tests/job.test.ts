import { describe, expect, it } from 'vitest';
import { extractJob, looksLikeConfirmation, urlKey } from '../src/lib/job';

function doc(html: string, title = ''): Document {
  const d = document.implementation.createHTMLDocument(title);
  d.body.innerHTML = html;
  return d;
}

describe('urlKey', () => {
  it('treats the description, form and confirmation of one posting as the same job', () => {
    const base = urlKey('https://jobs.lever.co/spotify/1234-abcd');
    expect(urlKey('https://jobs.lever.co/spotify/1234-abcd/apply')).toBe(base);
    expect(urlKey('https://jobs.lever.co/spotify/1234-abcd/thanks')).toBe(base);
    expect(urlKey('https://jobs.lever.co/spotify/1234-abcd/?utm_source=linkedin')).toBe(base);
    expect(urlKey('https://jobs.lever.co/spotify/9999')).not.toBe(base);
  });

  it('keeps the query parameters that identify a posting', () => {
    expect(urlKey('https://boards.greenhouse.io/embed/job_app?for=stripe&token=123')).toBe(
      'boards.greenhouse.io/embed/job_app?token=123&for=stripe',
    );
    expect(urlKey('https://stripe.com/jobs?gh_jid=1')).not.toBe(urlKey('https://stripe.com/jobs?gh_jid=2'));
  });

  it('strips Workday apply steps', () => {
    expect(urlKey('https://disney.wd5.myworkdayjobs.com/en-US/disneycareer/job/Burbank/Engineer_10001/apply/applyManually')).toBe(
      'disney.wd5.myworkdayjobs.com/en-us/disneycareer/job/burbank/engineer_10001',
    );
  });
});

describe('extractJob', () => {
  it('prefers JSON-LD JobPosting data', () => {
    const d = doc(
      `<script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'JobPosting',
            title: 'Backend Engineer',
            hiringOrganization: { '@type': 'Organization', name: 'Stripe' },
            jobLocation: { address: { addressLocality: 'Dublin', addressCountry: 'IE' } },
          },
        ],
      })}</script><h1>Something else</h1>`,
    );
    const job = extractJob(d, 'https://job-boards.greenhouse.io/stripe/jobs/123');
    expect(job).toMatchObject({ title: 'Backend Engineer', company: 'Stripe', location: 'Dublin, IE', source: 'Greenhouse' });
  });

  it('reads Greenhouse page titles', () => {
    const job = extractJob(doc('', 'Job Application for Product Designer at Notion'), 'https://boards.greenhouse.io/notion/jobs/1');
    expect(job).toMatchObject({ title: 'Product Designer', company: 'Notion' });
  });

  it('falls back to the URL slug for the company', () => {
    const job = extractJob(doc('<h1>Senior ML Engineer</h1>'), 'https://jobs.ashbyhq.com/linear-app/abc');
    expect(job).toMatchObject({ title: 'Senior ML Engineer', company: 'Linear App', source: 'Ashby' });
  });
});

describe('looksLikeConfirmation', () => {
  it('spots thank-you pages', () => {
    expect(looksLikeConfirmation(doc('<h2>Thank you for applying!</h2>'))).toBe(true);
    expect(looksLikeConfirmation(doc('<h2>Apply for this job</h2>'))).toBe(false);
  });
});
