import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  AUTH: 'rbf_auth_user',
  LANGUAGE: 'rbf_language',
  NOTEBOOK_PREFIX: 'rbf_notebook_',
  VISIT_REPORT_PREFIX: 'rbf_visit_report_',
};

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  isLoggedIn: boolean;
}

export interface NotebookEntry {
  id: string;
  date: string;
  day: string;
  weather: string;
  projectWorkers: string;
  activeWorkshops: string;
  activeMachines: string;
  dailyTasks: string;
  projectName?: string;
  reportName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VisitReportEntry {
  id: string;
  date: string;
  reportId?: string;          // e.g. RBF-ENG-2026-0001
  signature?: string;         // base64 PNG data URL
  signerName?: string;
  signedAt?: string;
  photos: string[];
  pdfFiles: string[];
  dwgFiles: string[];
  notes: string;
  projectName?: string;
  reportName?: string;
  createdAt: string;
  updatedAt: string;
}

// Auth
export const saveAuthUser = async (user: AuthUser): Promise<void> => {
  await AsyncStorage.setItem(KEYS.AUTH, JSON.stringify(user));
};

export const getAuthUser = async (): Promise<AuthUser | null> => {
  const data = await AsyncStorage.getItem(KEYS.AUTH);
  return data ? JSON.parse(data) : null;
};

export const clearAuthUser = async (): Promise<void> => {
  await AsyncStorage.removeItem(KEYS.AUTH);
};

// Language
export const saveLanguage = async (lang: string): Promise<void> => {
  await AsyncStorage.setItem(KEYS.LANGUAGE, lang);
};

export const getLanguage = async (): Promise<string | null> => {
  return AsyncStorage.getItem(KEYS.LANGUAGE);
};

// Notebook
export const saveNotebookEntry = async (entry: NotebookEntry): Promise<void> => {
  const key = `${KEYS.NOTEBOOK_PREFIX}${entry.id}`;
  await AsyncStorage.setItem(key, JSON.stringify(entry));
};

export const getNotebookEntries = async (): Promise<NotebookEntry[]> => {
  const keys = await AsyncStorage.getAllKeys();
  const notebookKeys = keys.filter(k => k.startsWith(KEYS.NOTEBOOK_PREFIX));
  if (notebookKeys.length === 0) return [];
  const results = await AsyncStorage.multiGet(notebookKeys);
  return results
    .map(([, value]) => (value ? JSON.parse(value) : null))
    .filter(Boolean) as NotebookEntry[];
};

export const getTodayNotebookEntry = async (): Promise<NotebookEntry | null> => {
  const today = new Date().toISOString().split('T')[0];
  const key = `${KEYS.NOTEBOOK_PREFIX}${today}`;
  const data = await AsyncStorage.getItem(key);
  return data ? JSON.parse(data) : null;
};

// Visit Report
export const saveVisitReport = async (entry: VisitReportEntry): Promise<void> => {
  const key = `${KEYS.VISIT_REPORT_PREFIX}${entry.id}`;
  await AsyncStorage.setItem(key, JSON.stringify(entry));
};

export const getVisitReports = async (): Promise<VisitReportEntry[]> => {
  const keys = await AsyncStorage.getAllKeys();
  const reportKeys = keys.filter(k => k.startsWith(KEYS.VISIT_REPORT_PREFIX));
  if (reportKeys.length === 0) return [];
  const results = await AsyncStorage.multiGet(reportKeys);
  return results
    .map(([, value]) => (value ? JSON.parse(value) : null))
    .filter(Boolean) as VisitReportEntry[];
};

export const getTodayVisitReport = async (): Promise<VisitReportEntry | null> => {
  const today = new Date().toISOString().split('T')[0];
  const key = `${KEYS.VISIT_REPORT_PREFIX}${today}`;
  const data = await AsyncStorage.getItem(key);
  return data ? JSON.parse(data) : null;
};

// Get by ID
export const getNotebookEntryById = async (id: string): Promise<NotebookEntry | null> => {
  const keys = await AsyncStorage.getAllKeys();
  const match = keys.find(k => k.startsWith(KEYS.NOTEBOOK_PREFIX) && k.includes(id));
  if (!match) return null;
  const data = await AsyncStorage.getItem(match);
  return data ? JSON.parse(data) : null;
};

export const getVisitReportById = async (id: string): Promise<VisitReportEntry | null> => {
  const keys = await AsyncStorage.getAllKeys();
  const match = keys.find(k => k.startsWith(KEYS.VISIT_REPORT_PREFIX) && k.includes(id));
  if (!match) return null;
  const data = await AsyncStorage.getItem(match);
  return data ? JSON.parse(data) : null;
};

// Rename report (update reportName field)
export const renameNotebookEntry = async (id: string, reportName: string): Promise<void> => {
  const entry = await getNotebookEntryById(id);
  if (!entry) throw new Error('Entry not found');
  entry.reportName = reportName.trim();
  entry.updatedAt = new Date().toISOString();
  await saveNotebookEntry(entry);
};

export const renameVisitReport = async (id: string, reportName: string): Promise<void> => {
  const entry = await getVisitReportById(id);
  if (!entry) throw new Error('Report not found');
  entry.reportName = reportName.trim();
  entry.updatedAt = new Date().toISOString();
  await saveVisitReport(entry);
};

// Delete entries
export const deleteNotebookEntry = async (id: string): Promise<void> => {
  const keys = await AsyncStorage.getAllKeys();
  const match = keys.find(k => k.startsWith(KEYS.NOTEBOOK_PREFIX) && k.includes(id));
  if (match) await AsyncStorage.removeItem(match);
};

export const deleteVisitReport = async (id: string): Promise<void> => {
  const keys = await AsyncStorage.getAllKeys();
  const match = keys.find(k => k.startsWith(KEYS.VISIT_REPORT_PREFIX) && k.includes(id));
  if (match) await AsyncStorage.removeItem(match);
};

// Combined report type for history screen
export type AnyReport = (NotebookEntry & { type: 'notebook' }) | (VisitReportEntry & { type: 'visit' });

export const getAllReports = async (): Promise<AnyReport[]> => {
  const notebooks = await getNotebookEntries();
  const visits = await getVisitReports();
  const all: AnyReport[] = [
    ...notebooks.map(n => ({ ...n, type: 'notebook' as const })),
    ...visits.map(v => ({ ...v, type: 'visit' as const })),
  ];
  return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

// Backup & Restore
const BACKUP_VERSION = 1;

export interface BackupData {
  version: number;
  exportedAt: string;
  notebooks: NotebookEntry[];
  visits: VisitReportEntry[];
}

export const createBackup = async (): Promise<string> => {
  const notebooks = await getNotebookEntries();
  const visits = await getVisitReports();
  const backup: BackupData = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    notebooks,
    visits,
  };
  return JSON.stringify(backup, null, 2);
};

export const restoreBackup = async (
  jsonString: string,
  mode: 'merge' | 'replace' = 'merge'
): Promise<{ notebooks: number; visits: number }> => {
  const backup: BackupData = JSON.parse(jsonString);
  if (!backup.version || !backup.notebooks || !backup.visits) {
    throw new Error('Invalid backup file format');
  }

  if (mode === 'replace') {
    // Clear existing data
    const keys = await AsyncStorage.getAllKeys();
    const reportKeys = keys.filter(
      k => k.startsWith(KEYS.NOTEBOOK_PREFIX) || k.startsWith(KEYS.VISIT_REPORT_PREFIX)
    );
    if (reportKeys.length > 0) await AsyncStorage.multiRemove(reportKeys);
  }

  // Restore notebooks
  for (const nb of backup.notebooks) {
    const existingKey = `${KEYS.NOTEBOOK_PREFIX}${nb.id}`;
    if (mode === 'merge') {
      const existing = await AsyncStorage.getItem(existingKey);
      if (existing) continue; // skip duplicates in merge mode
    }
    await AsyncStorage.setItem(existingKey, JSON.stringify(nb));
  }

  // Restore visits
  for (const vr of backup.visits) {
    const existingKey = `${KEYS.VISIT_REPORT_PREFIX}${vr.id}`;
    if (mode === 'merge') {
      const existing = await AsyncStorage.getItem(existingKey);
      if (existing) continue;
    }
    await AsyncStorage.setItem(existingKey, JSON.stringify(vr));
  }

  return { notebooks: backup.notebooks.length, visits: backup.visits.length };
};

// Generate ID
export const generateId = (): string => {
  return new Date().toISOString().split('T')[0] + '_' + Date.now();
};

// ─── Report ID (Sequential) ──────────────────────────────────────────────────
const REPORT_COUNTER_KEY = 'rbf_report_counter';

export const generateReportId = async (): Promise<string> => {
  const year = new Date().getFullYear();
  const raw = await AsyncStorage.getItem(REPORT_COUNTER_KEY);
  let counter = raw ? parseInt(raw, 10) : 0;
  counter += 1;
  await AsyncStorage.setItem(REPORT_COUNTER_KEY, String(counter));
  const padded = String(counter).padStart(4, '0');
  return `RBF-ENG-${year}-${padded}`;
};

export const getLastReportId = async (): Promise<string | null> => {
  return AsyncStorage.getItem('rbf_last_report_id');
};

export const saveLastReportId = async (id: string): Promise<void> => {
  await AsyncStorage.setItem('rbf_last_report_id', id);
};
