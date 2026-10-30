import type { Profile } from './types';
import { norm } from './text';

export interface EnumOption {
  value: string;
  label: string;
  /** Written into free-text fields on German-language forms */
  de?: string;
  /** Tested against the normalised text of a form's option */
  match: RegExp;
}

const DECLINE =
  /decline|dont wish|do not wish|prefer not|rather not|choose not|not (to )?(answer|disclose|say|specify|self identify|identify)|(do not|dont) want to (answer|disclose|say|identify)|keine angabe|ohne angabe|nicht angeben|moechte ich nicht|keine auskunft/;

const decline: EnumOption = { value: 'decline', label: "I don't wish to answer", de: 'Keine Angabe', match: DECLINE };

const yesNo: EnumOption[] = [
  { value: 'yes', label: 'Yes', de: 'Ja', match: /^(yes|y|ja)\b/ },
  { value: 'no', label: 'No', de: 'Nein', match: /^(no|n|nein)\b/ },
];

/** CEFR levels, plus the German words employers use instead of them. */
const languageLevel: EnumOption[] = [
  { value: 'native', label: 'Native', de: 'Muttersprache', match: /muttersprach|native|mother ?tongue|erstsprache/ },
  { value: 'c2', label: 'C2, business fluent', de: 'C2 (verhandlungssicher)', match: /\bc2\b|verhandlungssicher|business fluent|proficient/ },
  { value: 'c1', label: 'C1, fluent', de: 'C1 (fließend)', match: /\bc1\b|fliessend|\bfluent\b|sehr gut/ },
  { value: 'b2', label: 'B2, good', de: 'B2 (gute Kenntnisse)', match: /\bb2\b|^gute?\b|upper intermediate|\bgood\b/ },
  { value: 'b1', label: 'B1, intermediate', de: 'B1', match: /\bb1\b|(?<!upper )intermediate|mittel/ },
  { value: 'a2', label: 'A2, basic', de: 'A2 (Grundkenntnisse)', match: /\ba2\b|grundkenntnis|grundlagen|\bbasic\b|elementary/ },
  { value: 'a1', label: 'A1, beginner', de: 'A1', match: /\ba1\b|anfaenger|beginner/ },
];

export const ENUMS = {
  yesNo,
  languageLevel,
  salutation: [
    { value: 'mr', label: 'Mr (Herr)', de: 'Herr', match: /^(mr|herr)\b/ },
    { value: 'ms', label: 'Ms (Frau)', de: 'Frau', match: /^(ms|mrs|miss|frau)\b/ },
    { value: 'mx', label: 'Mx (Divers)', de: 'Divers', match: /^(mx|divers)\b|neutral/ },
    decline,
  ],
  gender: [
    { value: 'male', label: 'Male', de: 'Männlich', match: /^(male|man|cis ?male|cisgender (male|man)|maennlich|mann)\b/ },
    { value: 'female', label: 'Female', de: 'Weiblich', match: /^(female|woman|cis ?female|cisgender (female|woman)|weiblich|frau)\b/ },
    { value: 'nonbinary', label: 'Non-binary', de: 'Divers', match: /non ?binary|genderqueer|gender non|divers/ },
    decline,
  ],
  hispanic: [...yesNo, decline],
  race: [
    { value: 'native', label: 'American Indian or Alaska Native', match: /american indian|alaska/ },
    { value: 'asian', label: 'Asian', match: /\basian\b/ },
    { value: 'black', label: 'Black or African American', match: /\bblack\b|african/ },
    { value: 'pacific', label: 'Native Hawaiian or Other Pacific Islander', match: /hawaiian|pacific/ },
    { value: 'white', label: 'White', match: /\bwhite\b/ },
    { value: 'hispanic', label: 'Hispanic or Latino', match: /hispanic|latin/ },
    { value: 'multi', label: 'Two or more races', match: /two or more|multiracial|multiple/ },
    decline,
  ],
  veteran: [
    { value: 'no', label: 'I am not a protected veteran', match: /\bnot\b.*veteran|^no\b/ },
    {
      value: 'yes',
      label: 'I identify as a protected veteran',
      match: /^(?!.*\bnot\b).*(i am|identify as|identify).*(veteran|classification)|^yes\b/,
    },
    decline,
  ],
  disability: [
    { value: 'no', label: "No, I don't have a disability", de: 'Nein', match: /^(no|nein)\b/ },
    { value: 'yes', label: 'Yes, I have a disability', de: 'Ja', match: /^(yes|ja)\b/ },
    decline,
  ],
} satisfies Record<string, EnumOption[]>;

export interface ProfileField {
  key: string;
  label: string;
  group: string;
  kind?: 'text' | 'textarea' | 'email' | 'tel' | 'url' | 'date';
  options?: EnumOption[];
  hint?: string;
}

/** What the profile form shows, in display order. */
export const PROFILE_FIELDS: ProfileField[] = [
  { group: 'About you', key: 'salutation', label: 'Salutation (Anrede)', options: ENUMS.salutation },
  { group: 'About you', key: 'academicTitle', label: 'Academic title (Titel)', hint: 'e.g. Dr. Leave blank if none.' },
  { group: 'About you', key: 'firstName', label: 'First name (Vorname)' },
  { group: 'About you', key: 'lastName', label: 'Last name (Nachname)' },
  { group: 'About you', key: 'preferredName', label: 'Preferred name' },
  { group: 'About you', key: 'pronouns', label: 'Pronouns' },
  { group: 'About you', key: 'birthDate', label: 'Date of birth (Geburtsdatum)', kind: 'date', hint: 'Many German forms ask. Leave blank to answer by hand.' },
  { group: 'About you', key: 'nationality', label: 'Nationality (Staatsangehörigkeit)' },

  { group: 'Contact', key: 'email', label: 'Email', kind: 'email' },
  { group: 'Contact', key: 'phone', label: 'Phone (Telefon)', kind: 'tel', hint: 'With country code, e.g. +49 151 2345678' },
  { group: 'Contact', key: 'location', label: 'Location', hint: 'How you want it written, e.g. Hamburg, Deutschland' },
  { group: 'Contact', key: 'address1', label: 'Street and number (Straße und Hausnummer)' },
  { group: 'Contact', key: 'postalCode', label: 'Postal code (PLZ)' },
  { group: 'Contact', key: 'city', label: 'City (Ort)' },
  { group: 'Contact', key: 'state', label: 'State (Bundesland)' },
  { group: 'Contact', key: 'country', label: 'Country (Land)' },

  { group: 'Links', key: 'linkedin', label: 'LinkedIn', kind: 'url' },
  { group: 'Links', key: 'xing', label: 'XING', kind: 'url' },
  { group: 'Links', key: 'github', label: 'GitHub or GitLab', kind: 'url' },
  { group: 'Links', key: 'portfolio', label: 'Website or portfolio', kind: 'url' },

  { group: 'Languages', key: 'germanLevel', label: 'German (Deutschkenntnisse)', options: languageLevel },
  { group: 'Languages', key: 'englishLevel', label: 'English (Englischkenntnisse)', options: languageLevel },

  { group: 'Work eligibility', key: 'workAuthorized', label: 'Allowed to work where you’re applying?', options: yesNo, hint: 'Arbeitserlaubnis' },
  { group: 'Work eligibility', key: 'needsSponsorship', label: 'Will you need a visa or sponsorship?', options: yesNo },
  { group: 'Work eligibility', key: 'willingToRelocate', label: 'Willing to relocate?', options: yesNo, hint: 'Umzugsbereitschaft' },
  { group: 'Work eligibility', key: 'salary', label: 'Salary expectation (Gehaltsvorstellung)', hint: 'As you want it written, e.g. 75.000 € brutto/Jahr' },
  { group: 'Work eligibility', key: 'noticePeriod', label: 'Notice period (Kündigungsfrist)', hint: 'e.g. 3 Monate zum Monatsende' },
  { group: 'Work eligibility', key: 'startDate', label: 'Earliest start date (Eintrittstermin)', hint: 'e.g. 01.02.2027 or Sofort' },

  { group: 'Experience', key: 'currentCompany', label: 'Current or last employer (Arbeitgeber)' },
  { group: 'Experience', key: 'currentTitle', label: 'Current or last job title (Position)' },
  { group: 'Experience', key: 'yearsExperience', label: 'Years of experience (Berufserfahrung)' },

  { group: 'Education', key: 'school', label: 'University or school (Hochschule)' },
  { group: 'Education', key: 'degree', label: 'Degree (Abschluss)', hint: 'e.g. Master of Science' },
  { group: 'Education', key: 'major', label: 'Field of study (Studiengang)' },
  { group: 'Education', key: 'gradYear', label: 'Graduation year' },

  { group: 'Voluntary self-identification', key: 'gender', label: 'Gender (Geschlecht)', options: ENUMS.gender },
  { group: 'Voluntary self-identification', key: 'hispanic', label: 'Hispanic or Latino? (US forms)', options: ENUMS.hispanic },
  { group: 'Voluntary self-identification', key: 'race', label: 'Race (US forms)', options: ENUMS.race },
  { group: 'Voluntary self-identification', key: 'veteran', label: 'Veteran status (US forms)', options: ENUMS.veteran },
  { group: 'Voluntary self-identification', key: 'disability', label: 'Disability status', options: ENUMS.disability },
];

export const FIELD_BY_KEY = new Map(PROFILE_FIELDS.map((f) => [f.key, f]));

interface Rule {
  key: string;
  test: RegExp;
  not?: RegExp;
}

/** Questions about someone other than the applicant: a referrer, an emergency contact. */
const NOT_YOU =
  /refer|recruiter|emergency|reference|manager|supervisor|hiring|interviewer|empfehl|referenz|notfall|ansprechpartner|vorgesetzt|personalverantwortlich|werber/;

/**
 * Classification rules over normalised label text (umlauts spelled out), tried in
 * order. Order matters: sponsorship questions often also say "authorized", "preferred
 * first name" contains "first name", "email address" contains "address", and
 * "Vor- und Nachname" must win over "Nachname".
 */
const RULES: Rule[] = [
  { key: 'salutation', test: /\banrede\b|salutation|form of address/ },
  { key: 'academicTitle', test: /akademische[rn]? (titel|grad)|academic (title|degree)|^titel$|^title (dr|prof)/ },
  { key: 'gender', test: /\bgender\b|\bsex\b|geschlecht/, not: /orientation|transgender/ },
  { key: 'hispanic', test: /hispanic|latin(o|a|x)/ },
  { key: 'race', test: /\brace\b|ethnicity|ethnic/ },
  { key: 'veteran', test: /veteran/ },
  { key: 'disability', test: /disabilit|schwerbehinder|behinderung/ },
  { key: 'pronouns', test: /pronoun|pronomen/ },
  { key: 'birthDate', test: /date of birth|birth ?date|birthday|geburtsdatum|geburtstag|\bdob\b/ },
  { key: 'nationality', test: /nationalit|citizenship|staatsangehoerig|staatsbuergerschaft/ },
  {
    key: 'germanLevel',
    test: /deutsch ?(sprach)?(kenntnis|niveau)|sprachkenntnisse deutsch|deutsch sprachkenntnis|german (language )?(level|skills|proficiency|knowledge)|level of german|speak german|^deutsch$|^german$/,
  },
  {
    key: 'englishLevel',
    test: /englisch ?(sprach)?(kenntnis|niveau)|sprachkenntnisse englisch|englisch sprachkenntnis|english (language )?(level|skills|proficiency|knowledge)|level of english|speak english|^englisch$|^english$/,
  },
  { key: 'needsSponsorship', test: /sponsor|\bvisa\b|\bvisum\b/ },
  {
    key: 'workAuthorized',
    test: /authori[sz]ed to work|work authori[sz]ation|legally (eligible|permitted|able|allowed) to work|eligib(le|ility) to work|right to work|work permit|permitted to work|arbeitserlaubnis|arbeitsgenehmigung|aufenthaltstitel|arbeitsberechtigung|berechtigt.* zu arbeiten/,
  },
  { key: 'willingToRelocate', test: /relocat|umzug|umzieh|umzuzieh|umsiedl/ },
  {
    key: 'salary',
    test: /salary|compensation|pay (range|expectation)|desired (pay|rate)|expected (pay|ctc|rate)|rate expectation|\bctc\b|gehalt|verguetung|einkommensvorstellung/,
  },
  { key: 'noticePeriod', test: /notice period|kuendigungsfrist/ },
  {
    key: 'startDate',
    test: /start date|when (can|could) you start|available to start|earliest (possible )?start|availability to (start|join)|soonest|eintrittstermin|eintrittsdatum|fruehestmoeglich|verfuegbar ab|verfuegbarkeit|starttermin|arbeitsbeginn|\beintritt\b/,
  },
  {
    key: 'yearsExperience',
    test: /years (of )?(relevant |professional |work |total |industry )?experience|how many years|jahre (an )?(berufs)?erfahrung|berufserfahrung|jahren erfahrung/,
  },
  { key: 'linkedin', test: /linked ?in/ },
  { key: 'xing', test: /\bxing\b/ },
  { key: 'github', test: /git ?hub|git ?lab/ },
  { key: 'portfolio', test: /portfolio|personal (web ?)?site|\bwebsite\b|\bweb site\b|\bblog\b|webseite|homepage|internetseite/ },
  { key: 'email', test: /\be ?mail\b/, not: NOT_YOU },
  {
    key: 'phone',
    test: /\b(phone|mobile|cell|telephone)\b|telefon|\bmobil|handy|rufnummer/,
    not: new RegExp(`${NOT_YOU.source}|type|extension|\\bext\\b|country code|device|vorwahl|\\bart\\b`),
  },
  { key: 'preferredName', test: /preferred (first )?name|nick ?name|goes by|rufname|bevorzugter (vor)?name|spitzname/ },
  {
    key: 'fullName',
    test: /vor ?(und|&)? ?nachname|vor (und|&) zuname|vorname (und|&) (nach|zu|familien)name|vollstaendiger name|name vorname/,
    not: NOT_YOU,
  },
  { key: 'firstName', test: /\b(first|given) ?name\b|^fname$|^first$|vorname/, not: NOT_YOU },
  { key: 'lastName', test: /\b(last|family|sur) ?name\b|^lname$|^last$|nachname|familienname|zuname/, not: NOT_YOU },
  {
    key: 'fullName',
    test: /^((your|full|legal|complete|candidate|applicant|ihr|dein) )*name$|\bfull (legal )?name\b|\blegal name\b/,
    not: NOT_YOU,
  },
  { key: 'gradYear', test: /graduat(ion|ed)? (year|date)|year (of )?graduat|grad year|expected graduation|abschlussjahr|jahr des abschlusses/ },
  { key: 'major', test: /\bmajor\b|field of study|discipline|concentration|area of study|studiengang|studienfach|fachrichtung/ },
  { key: 'degree', test: /\bdegree\b|abschluss/, not: /jahr|year|datum/ },
  { key: 'school', test: /school|university|college|institution|hochschule|universitaet|\buni\b|bildungseinrichtung/ },
  {
    key: 'currentCompany',
    test: /current (company|employer)|(most )?recent (company|employer)|^employer$|^(current )?company( name)?$|(aktuelle[rs]?|derzeitige[rs]?|letzte[rs]?) (arbeitgeber|unternehmen)|^arbeitgeber$/,
  },
  {
    key: 'currentTitle',
    test: /current (job )?(title|role|position)|(most )?recent (job )?(title|position|role)|^(job )?title$|(aktuelle|derzeitige|letzte) (position|stelle|taetigkeit|rolle)|berufsbezeichnung|jobtitel/,
  },
  { key: 'address1', test: /\baddress\b|street|strasse|anschrift|adresse|hausnummer/, not: /e ?mail|\bip\b|web|url|line 2|address 2|zusatz/ },
  { key: 'postalCode', test: /\bzip\b|postal|post ?code|\bplz\b|postleitzahl/ },
  {
    key: 'location',
    test: /\blocation\b|where are you (currently )?(located|based)|current (city|location)|city (and|&) (state|country)|based in|aktueller standort|wo (wohnst|lebst) du|wo (wohnen|leben) sie/,
  },
  { key: 'city', test: /\bcity\b|\btown\b|\bort\b|\bstadt\b|wohnort/ },
  { key: 'state', test: /\b(state|province|region|county)\b|bundesland/ },
  { key: 'country', test: /\bcountry\b|\bland\b|wohnland/, not: /code|citizenship|vorwahl|staatsangehoerig/ },
];

/** HTML autocomplete tokens are the most reliable signal when a site bothers to set them. */
const AUTOCOMPLETE: Record<string, string> = {
  'honorific-prefix': 'salutation',
  'given-name': 'firstName',
  'family-name': 'lastName',
  name: 'fullName',
  nickname: 'preferredName',
  email: 'email',
  tel: 'phone',
  'tel-national': 'phone',
  'address-line1': 'address1',
  'street-address': 'address1',
  'address-level2': 'city',
  'address-level1': 'state',
  'postal-code': 'postalCode',
  country: 'country',
  'country-name': 'country',
  bday: 'birthDate',
  organization: 'currentCompany',
  'organization-title': 'currentTitle',
};

export interface FieldSignals {
  /** Visible question/label text */
  question: string;
  /** name/id attributes, used only when the label says nothing useful */
  hints: string;
  autocomplete: string;
  inputType: string;
  /** Dropdown, radio group or similar: the answer is picked, not written */
  choice?: boolean;
}

function byRules(text: string): string | null {
  if (!text) return null;
  for (const rule of RULES) {
    if (rule.test.test(text) && !rule.not?.test(text)) return rule.key;
  }
  return null;
}

/** Map a form field to a profile key, or null if it's not something the profile knows. */
export function classify(s: FieldSignals): string | null {
  const q = norm(s.question);
  const key = byRules(q);
  // A label naming the field beats autocomplete, which some sites set wrong
  // (Recruitee marks "Vor- und Nachname" and plain "Name" alike as "name").
  const auto = AUTOCOMPLETE[s.autocomplete.toLowerCase().split(/\s+/).pop() ?? ''];
  if (auto && (!key || key === 'fullName' || auto === key)) return auto;
  // Long free-text questions ("Describe a time you relocated a service...") only share a
  // keyword with a profile field. Long multiple-choice ones ("Will you now or in the
  // future require sponsorship...") are still the yes/no question they look like.
  const long = q.split(' ').length > 14;
  if (key && (!long || (s.choice && FIELD_BY_KEY.get(key)?.options))) return key;
  if (!q) {
    if (s.inputType === 'email') return 'email';
    if (s.inputType === 'tel') return 'phone';
    return byRules(s.hints);
  }
  return null;
}

/** The string to put into a field for `key`, including derived keys like fullName. */
export function profileValue(profile: Profile, key: string): string {
  const p = (k: string) => (profile[k] ?? '').trim();
  switch (key) {
    case 'fullName':
      return [p('firstName'), p('lastName')].filter(Boolean).join(' ');
    case 'preferredName':
      return p('preferredName') || p('firstName');
    case 'location':
      return p('location') || [p('city'), p('state'), p('country')].filter(Boolean).join(', ');
    default:
      return p(key);
  }
}

/** Human-readable value for enum keys, e.g. "yes" -> "Yes", or "Ja" on a German form. */
export function displayValue(key: string, value: string, german = false): string {
  const option = FIELD_BY_KEY.get(key)?.options?.find((o) => o.value === value);
  if (!option) return value;
  return german && option.de ? option.de : option.label;
}

export function enumMatcher(key: string, value: string): RegExp | undefined {
  return FIELD_BY_KEY.get(key)?.options?.find((o) => o.value === value)?.match;
}

/** ISO "1990-04-23" as the field expects it: from its placeholder, else by page language. */
export function formatDate(iso: string, placeholder: string, german: boolean): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const [, y, mo, d] = m;
  const ph = placeholder.toLowerCase();
  const sep = ph.match(/(?:dd|tt)([./-])(?:mm)/)?.[1];
  if (sep) return `${d}${sep}${mo}${sep}${y}`;
  if (/mm[./-]dd/.test(ph)) return `${mo}/${d}/${y}`;
  if (/yyyy[./-]mm|jjjj[./-]mm/.test(ph)) return iso;
  return german ? `${d}.${mo}.${y}` : iso;
}
