export type Profile = Record<string, string>;

export interface Resume {
  name: string;
  type: string;
  size: number;
  /** base64 data URL, so the file survives in extension storage and in backups */
  dataUrl: string;
}

export interface SavedAnswer {
  id: string;
  question: string;
  answer: string;
  /** Company of the application the answer was learned from, if any */
  learnedFrom?: string;
  updatedAt: number;
}

export const STATUSES = ['saved', 'filled', 'applied', 'interviewing', 'offer', 'rejected', 'withdrawn'] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<Status, string> = {
  saved: 'Saved',
  filled: 'Filled, not sent',
  applied: 'Applied',
  interviewing: 'Interviewing',
  offer: 'Offer',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

export interface Application {
  id: string;
  company: string;
  title: string;
  location: string;
  url: string;
  /** Normalised posting URL used to spot duplicates */
  urlKey: string;
  /** Detected applicant tracking system, e.g. "Greenhouse" */
  source: string;
  status: Status;
  appliedAt?: number;
  createdAt: number;
  updatedAt: number;
  notes: string;
  history: { status: Status; at: number }[];
}

export interface Settings {
  enabled: boolean;
  dailyGoal: number;
  showFloatingButton: boolean;
  showSideTab: boolean;
  overwriteFilled: boolean;
  learnAnswers: boolean;
  autoBackup: boolean;
  lastBackupAt?: number;
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  dailyGoal: 5,
  showFloatingButton: true,
  showSideTab: true,
  overwriteFilled: false,
  learnAnswers: true,
  autoBackup: true,
};

export interface JobInfo {
  company: string;
  title: string;
  location: string;
  url: string;
  urlKey: string;
  source: string;
}

/** Everything the fill engine needs, loaded once per fill. */
export interface FillData {
  profile: Profile;
  answers: SavedAnswer[];
  resume?: Resume;
  coverLetter?: Resume;
  overwrite: boolean;
}

export type Message =
  | { type: 'fill' }
  | { type: 'page-info' }
  | { type: 'mark-applied' }
  | { type: 'save-job' };

export interface FillReport {
  filled: number;
  needsYou: number;
}

export interface PageInfo {
  job: JobInfo;
  hasForm: boolean;
  existing?: Application;
}
