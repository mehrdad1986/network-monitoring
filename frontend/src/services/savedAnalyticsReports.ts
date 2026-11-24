export interface SavedAnalyticsReport {
  id: string;
  title: string;
  savedAt: string;
  summary: { label: string; value: string | number }[];
}

const storageKey = 'netmon.analytics.saved-reports.v1';

function isSavedReport(value: unknown): value is SavedAnalyticsReport {
  if (!value || typeof value !== 'object') return false;
  const report = value as Partial<SavedAnalyticsReport>;
  return typeof report.id === 'string' && typeof report.title === 'string' &&
    typeof report.savedAt === 'string' && Array.isArray(report.summary) &&
    report.summary.every(row => row && typeof row.label === 'string' &&
      (typeof row.value === 'string' || typeof row.value === 'number'));
}

export function getSavedAnalyticsReports(): SavedAnalyticsReport[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey) || '[]');
    return Array.isArray(parsed) ? parsed.filter(isSavedReport) : [];
  } catch {
    return [];
  }
}

export function saveAnalyticsReport(title: string, summary: SavedAnalyticsReport['summary'], now = new Date()): SavedAnalyticsReport[] {
  const report: SavedAnalyticsReport = {
    id: `${now.getTime()}-${Math.random().toString(36).slice(2, 9)}`,
    title,
    savedAt: now.toISOString(),
    summary: summary.map(row => ({ label: row.label, value: row.value })),
  };
  const next = [report, ...getSavedAnalyticsReports()].slice(0, 100);
  localStorage.setItem(storageKey, JSON.stringify(next));
  return next;
}

export function removeSavedAnalyticsReport(id: string): SavedAnalyticsReport[] {
  const next = getSavedAnalyticsReports().filter(report => report.id !== id);
  localStorage.setItem(storageKey, JSON.stringify(next));
  return next;
}
