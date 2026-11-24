import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import apiService from '../services/api';
import { HistoricalAnalysis } from './AnalyticsMonitoring';

const measurement = {
  time: '2026-10-27T12:00:00Z', probe_id: 'probe-1', target_id: 'target-1', monitor_id: 'monitor-1',
  monitor_type: 'tcp', success: true, latency_ms: 42, metadata: {},
};

beforeEach(() => {
  localStorage.clear();
  jest.spyOn(apiService, 'getTargets').mockResolvedValue([{ id: 'target-1' } as any]);
  jest.spyOn(apiService, 'getTargetMeasurements').mockResolvedValue([measurement]);
});
afterEach(() => jest.restoreAllMocks());

test('saves an Analytics snapshot and reloads/removes it from the same browser', async () => {
  const first = render(<HistoricalAnalysis />);
  await screen.findByText('Recorded target measurements');
  const save = screen.getByRole('button', { name: 'Save report' });
  fireEvent.click(save);
  expect(await screen.findByText('Report saved in this browser.')).toBeInTheDocument();
  expect(screen.getAllByText('Historical Analysis').length).toBeGreaterThan(1);
  first.unmount();

  render(<HistoricalAnalysis />);
  expect((await screen.findAllByText('Average latency')).length).toBeGreaterThan(0);
  const remove = await screen.findByRole('button', { name: 'Remove saved report Historical Analysis' });
  fireEvent.click(remove);
  expect(await screen.findByText('Saved report removed.')).toBeInTheDocument();
  expect(screen.queryByRole('article')).not.toBeInTheDocument();
});
