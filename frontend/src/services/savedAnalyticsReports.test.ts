import { getSavedAnalyticsReports, removeSavedAnalyticsReport, saveAnalyticsReport } from './savedAnalyticsReports';

beforeEach(() => localStorage.clear());

test('saves report summaries across reloads and removes them', () => {
  const first = saveAnalyticsReport('Historical Analysis', [{ label: 'Measurements', value: 4 }], new Date('2026-10-27T12:00:00Z'));
  expect(first[0]).toMatchObject({ title: 'Historical Analysis', summary: [{ label: 'Measurements', value: 4 }] });
  expect(getSavedAnalyticsReports()).toEqual(first);
  expect(removeSavedAnalyticsReport(first[0].id)).toEqual([]);
});

test('ignores malformed stored reports', () => {
  localStorage.setItem('netmon.analytics.saved-reports.v1', JSON.stringify([{ title: 'broken' }]));
  expect(getSavedAnalyticsReports()).toEqual([]);
});
