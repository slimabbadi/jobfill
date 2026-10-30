import type { JobInfo } from './types';
import { cleanLabel, norm } from './text';

interface Ats {
  name: string;
  host: RegExp;
  /**
   * Hostnames of scripts, styles or frames the ATS serves, for career pages on the
   * company's own domain (jobs.example.de running Recruitee, say).
   */
  assets?: RegExp;
  /** Company slug from the URL, when the ATS puts it there */
  company?: (url: URL) => string;
}

const firstSegment = (url: URL) => url.pathname.split('/').filter(Boolean)[0] ?? '';
const subdomain = (url: URL) => url.hostname.split('.')[0] ?? '';

const ATS: Ats[] = [
  {
    name: 'Greenhouse',
    host: /(^|\.)greenhouse\.io$/,
    assets: /greenhouse\.io$/,
    company: (u) => u.searchParams.get('for') ?? (firstSegment(u) === 'embed' ? '' : firstSegment(u)),
  },
  { name: 'Lever', host: /(^|\.)lever\.co$/, assets: /lever\.co$/, company: firstSegment },
  { name: 'Ashby', host: /(^|\.)ashbyhq\.com$/, assets: /ashbyhq\.com$/, company: firstSegment },
  { name: 'Workday', host: /myworkdayjobs\.com$|myworkdaysite\.com$/, company: subdomain },
  { name: 'Workable', host: /(^|\.)workable\.com$/, assets: /workable\.com$/, company: firstSegment },
  { name: 'SmartRecruiters', host: /smartrecruiters\.com$/, assets: /smartrecruiters\.com$/, company: firstSegment },
  { name: 'iCIMS', host: /icims\.com$/, company: (u) => subdomain(u).replace(/^careers-/, '') },
  { name: 'Jobvite', host: /jobvite\.com$/, company: firstSegment },
  { name: 'BambooHR', host: /bamboohr\.com$/, company: subdomain },
  { name: 'Taleo', host: /taleo\.net$/ },
  { name: 'Oracle', host: /oraclecloud\.com$/ },
  { name: 'LinkedIn', host: /(^|\.)linkedin\.com$/ },
  { name: 'Eightfold', host: /eightfold\.ai$/, company: subdomain },
  // Common in Germany and the DACH region
  { name: 'Personio', host: /jobs\.personio\.(de|com)$/, assets: /personio\.(de|com)$/, company: subdomain },
  { name: 'softgarden', host: /softgarden\.(io|de)$/, assets: /softgarden\.(io|de)$/, company: subdomain },
  { name: 'JOIN', host: /(^|\.)join\.com$/, assets: /(^|\.)join\.com$/, company: (u) => u.pathname.split('/').filter(Boolean)[1] ?? '' },
  { name: 'Recruitee', host: /recruitee\.com$/, assets: /recruitee(cdn)?\.com$/, company: subdomain },
  { name: 'Teamtailor', host: /teamtailor\.com$/, assets: /teamtailor(-cdn)?\.com$/, company: subdomain },
  { name: 'onlyfy', host: /onlyfy\.(jobs|com)$|prescreenapp\.io$/, assets: /onlyfy|prescreen/, company: subdomain },
  { name: 'd.vinci', host: /dvinci(-hr)?\.(com|de)$|dvinci-easy\.com$/, assets: /dvinci/ },
  { name: 'rexx', host: /rexx-systems\.com$|rexx-recruitment\./, assets: /rexx/ },
  { name: 'SuccessFactors', host: /successfactors\.(com|eu)$|jobs\.sap\.com$|sapsf\.(com|eu)$/, assets: /successfactors|sapsf/ },
  { name: 'BITE', host: /b-ite\.(com|de|net)$/, assets: /b-ite\./ },
  { name: 'concludis', host: /concludis\.de$/, assets: /concludis/ },
  { name: 'Haufe Umantis', host: /umantis\.com$/, assets: /umantis/ },
  { name: 'HR4YOU', host: /hr4you\.org$/, assets: /hr4you/ },
  { name: 'Coveto', host: /coveto\.de$/, assets: /coveto/ },
  { name: 'Talention', host: /talention\.(com|de)$/, assets: /talention/ },
  { name: 'Kenjo', host: /kenjo\.io$/, assets: /kenjo/ },
  { name: 'MHM eRecruiting', host: /mhm-hr\.(com|de)$|mhm-erecruiting/, assets: /mhm-hr|mhm-erecruiting/ },
  { name: 'Breezy', host: /breezy\.hr$/, assets: /breezy\.hr$/, company: subdomain },
  { name: 'StepStone', host: /(^|\.)stepstone\.(de|at|com)$/ },
  { name: 'XING', host: /(^|\.)xing\.com$/ },
  { name: 'Indeed', host: /(^|\.)indeed\.(com|de)$/ },
  { name: 'Workwise', host: /(^|\.)workwise\.io$/ },
  { name: 'Arbeitsagentur', host: /arbeitsagentur\.de$/ },
];

/** The ATS behind a page: by its address, or by what the page loads from where. */
export function detectAts(url: URL, doc?: Document): { ats: Ats; byHost: boolean } | undefined {
  const byHost = ATS.find((a) => a.host.test(url.hostname));
  if (byHost) return { ats: byHost, byHost: true };
  if (!doc) return undefined;
  const hosts = new Set<string>();
  for (const el of Array.from(doc.querySelectorAll('script[src], link[href], iframe[src], form[action]'))) {
    const raw = el.getAttribute('src') ?? el.getAttribute('href') ?? el.getAttribute('action') ?? '';
    try {
      hosts.add(new URL(raw, url).hostname);
    } catch {
      // Ignore unparseable URLs.
    }
  }
  hosts.delete(url.hostname);
  const byAsset = ATS.find((a) => a.assets && [...hosts].some((h) => a.assets!.test(h)));
  return byAsset ? { ats: byAsset, byHost: false } : undefined;
}

/** Path suffixes for the apply or confirmation step of a posting, not a different posting. */
const APPLY_SUFFIX =
  /\/(apply|application|applymanually|autofillwithresume|usemylastapplication|login|form|confirmation|thank-?you|thanks|submitted|success)(\/.*)?$/i;

/** Same posting, same key: whether you're on the description or the form, embed or not. */
export function urlKey(href: string): string {
  try {
    const url = new URL(href);
    const keep = ['gh_jid', 'token', 'for', 'jobId', 'job', 'id', 'jk', 'currentJobId'];
    const params = keep
      .filter((k) => url.searchParams.has(k))
      .map((k) => `${k}=${url.searchParams.get(k)}`)
      .join('&');
    const path = url.pathname.replace(APPLY_SUFFIX, '').replace(/\/+$/, '').toLowerCase();
    return `${url.hostname.replace(/^www\./, '')}${path}${params ? '?' + params : ''}`;
  } catch {
    return href;
  }
}

type Json = Record<string, unknown>;

function findJobPosting(node: unknown): Json | undefined {
  if (!node || typeof node !== 'object') return undefined;
  if (Array.isArray(node)) {
    for (const item of node) {
      const hit = findJobPosting(item);
      if (hit) return hit;
    }
    return undefined;
  }
  const obj = node as Json;
  const type = obj['@type'];
  if (type === 'JobPosting' || (Array.isArray(type) && type.includes('JobPosting'))) return obj;
  return findJobPosting(obj['@graph']);
}

function str(v: unknown): string {
  return typeof v === 'string' ? cleanLabel(v) : '';
}

function jsonLdLocation(job: Json): string {
  const locs = Array.isArray(job.jobLocation) ? job.jobLocation : [job.jobLocation];
  const first = locs[0] as Json | undefined;
  const address = first?.address as Json | string | undefined;
  if (typeof address === 'string') return cleanLabel(address);
  const parts = [address?.addressLocality, address?.addressRegion, address?.addressCountry].map(str).filter(Boolean);
  if (parts.length) return parts.join(', ');
  if (job.jobLocationType === 'TELECOMMUTE') return 'Remote';
  const required = (Array.isArray(job.applicantLocationRequirements) ? job.applicantLocationRequirements : [job.applicantLocationRequirements])[0] as Json | undefined;
  return str(required?.name);
}

function fromJsonLd(doc: Document): Partial<JobInfo> {
  for (const script of Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))) {
    try {
      const job = findJobPosting(JSON.parse(script.textContent ?? ''));
      if (!job) continue;
      const org = job.hiringOrganization as Json | string | undefined;
      return {
        title: str(job.title),
        company: typeof org === 'string' ? cleanLabel(org) : str(org?.name),
        location: jsonLdLocation(job),
      };
    } catch {
      // Malformed JSON-LD is common; fall through to other signals.
    }
  }
  return {};
}

/** Titles like "Job Application for Backend Engineer at Stripe", "Stripe - Backend Engineer" or "Entwickler bei DEMV". */
function fromDocumentTitle(title: string): Partial<JobInfo> {
  const t = cleanLabel(title);
  let m = t.match(/^(?:job application for |bewerbung als )?(.+?) (?:at|@|bei) (.+?)(?: [|-] .*)?$/i);
  if (m) return { title: m[1], company: m[2] };
  m = t.match(/^(.+?) [-–|] (.+?)(?: [-–|] .*)?$/);
  if (m) return { company: m[1], title: m[2] };
  return {};
}

function prettySlug(slug: string): string {
  return slug
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function meta(doc: Document, name: string): string {
  const el = doc.querySelector(`meta[property="${name}"], meta[name="${name}"]`);
  return cleanLabel(el?.getAttribute('content') ?? '');
}

function firstText(doc: Document, selectors: string): string {
  for (const el of Array.from(doc.querySelectorAll(selectors))) {
    const text = cleanLabel(el.textContent ?? '');
    if (text && text.length <= 120) return text;
  }
  return '';
}

/** "Full Stack Developer (m/w/d)" -> "Full Stack Developer": German postings must carry the gender marker. */
export function cleanTitle(title: string): string {
  return title
    .replace(/\s*[([]\s*(?:[mwfdxi*]\s*[/|,]\s*){1,3}[mwfdxi*]\s*[)\]]/gi, '')
    .replace(/\s*\((?:all genders?|alle geschlechter|gn)\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractJob(doc: Document, href: string): JobInfo {
  const url = new URL(href);
  const detected = detectAts(url, doc);
  const ats = detected?.ats;
  const ld = fromJsonLd(doc);
  const fromTitle = fromDocumentTitle(doc.title);
  // On a company's own domain the URL says nothing about the ATS's slug scheme.
  const slug = detected?.byHost ? (ats?.company?.(url) ?? '') : '';

  const title = cleanTitle(
    ld.title ||
    firstText(doc, '[data-automation-id="jobPostingHeader"], .posting-headline h2, h1') ||
    fromTitle.title ||
    meta(doc, 'og:title') ||
    cleanLabel(doc.title),
  );

  // On an ATS host, og:site_name is often the ATS itself, so the URL slug is trusted more.
  const hostCompany = prettySlug(url.hostname.replace(/^(www|careers|jobs|boards)\./, '').split('.')[0] ?? '');
  const company = ats
    ? ld.company || fromTitle.company || (slug ? prettySlug(slug) : '') || meta(doc, 'og:site_name') || hostCompany
    : ld.company || meta(doc, 'og:site_name') || hostCompany;

  const location =
    ld.location ||
    firstText(doc, '[data-automation-id="locations"] dd, .posting-categories .location, .job__location, [class*="location" i]');

  return {
    title,
    company,
    location,
    url: href,
    urlKey: urlKey(href),
    source: ats?.name ?? url.hostname.replace(/^www\./, ''),
  };
}

/** Matched against normalised text, so umlauts are spelled out and punctuation is gone. */
const CONFIRMATION =
  /thank you for (applying|your application|your interest)|application (has been )?(successfully )?(submitted|received|sent)|we ?(ve| have) received your application|successfully (applied|submitted)|(vielen )?dank fuer (ihre|deine) bewerbung|bewerbung (ist |wurde )?(erfolgreich )?(versendet|verschickt|uebermittelt|eingegangen|abgeschickt|eingereicht|gesendet)|wir haben (ihre|deine) bewerbung (erhalten|bekommen)/;

export function looksLikeConfirmation(doc: Document): boolean {
  return CONFIRMATION.test(norm(doc.body?.textContent?.slice(0, 20000) ?? ''));
}
