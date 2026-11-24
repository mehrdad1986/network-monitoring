import '@testing-library/jest-dom';
import { StrictMode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { runNetworkTool } from '../services/networkDiagnostics';
import { DNSInvestigation } from './DNSInvestigation';

jest.mock('../services/networkDiagnostics', () => ({ runNetworkTool: jest.fn() }));
const runLookup = runNetworkTool as jest.MockedFunction<typeof runNetworkTool>;

beforeEach(() => runLookup.mockReset());

test('DNS Hunter displays resolver answers under React Strict Mode', async () => {
  runLookup.mockResolvedValue({
    domain: 'google.com',
    servers: [
      { location: 'Cloudflare (1.1.1.1)', result: '216.239.38.120', synced: true },
      { location: 'Google (8.8.8.8)', result: '216.239.38.120', synced: true },
      { location: 'Quad9 (9.9.9.9)', result: '216.239.38.120', synced: true },
    ],
    note: 'Resolver comparison',
  });
  render(<StrictMode><DNSInvestigation mode="dns" /></StrictMode>);
  fireEvent.click(screen.getByRole('button', { name: 'Find DNS answers' }));
  expect(await screen.findAllByText('216.239.38.120')).toHaveLength(3);
  expect(screen.getByText('Cloudflare (1.1.1.1)')).toBeInTheDocument();
  expect(runLookup).toHaveBeenCalledWith('dns-propagation', 'google.com', expect.any(AbortSignal));
});

test('DNS Hunter displays backend lookup errors', async () => {
  runLookup.mockRejectedValue(new Error('Public DNS is unavailable'));
  render(<StrictMode><DNSInvestigation mode="dns" /></StrictMode>);
  fireEvent.click(screen.getByRole('button', { name: 'Find DNS answers' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Public DNS is unavailable');
});
