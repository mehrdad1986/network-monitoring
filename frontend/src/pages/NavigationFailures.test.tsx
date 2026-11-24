import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TargetsList } from './TargetsList';
import { Probes } from './Probes';
import { Home } from './Home';
import api from '../services/api';
jest.mock('../services/api');
beforeEach(() => { jest.clearAllMocks(); jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => jest.restoreAllMocks());

test('target cards navigate to registered app route', async () => {
 (api.getTargets as jest.Mock).mockResolvedValue([{ id: 'test-target', name: 'Test target', address: 'localhost', enabled: true, type: 'host' }]);
 render(<MemoryRouter><TargetsList /></MemoryRouter>);
 expect(await screen.findByRole('link', { name: /Test target/ })).toHaveAttribute('href', '/app/targets/test-target');
});

test('target service failure is shown with retry instead of an empty success state', async () => {
 (api.getTargets as jest.Mock).mockRejectedValue(new Error('PostgreSQL is unavailable'));
 render(<MemoryRouter><TargetsList /></MemoryRouter>);
 expect(await screen.findByRole('alert')).toHaveTextContent('PostgreSQL is unavailable');
 expect(screen.queryByText('No targets configured yet.')).toBeNull();
 expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled();
});

test('probes display API failure instead of claiming there are no registered probes', async () => {
 (api.getProbes as jest.Mock).mockRejectedValue(new Error('PostgreSQL is unavailable'));
 render(<Probes />);
 expect(await screen.findByRole('alert')).toHaveTextContent('PostgreSQL is unavailable');
 expect(screen.queryByText('No Probes Registered')).toBeNull();
});

test('clicking the selected sign-in tab keeps sign-in selected', () => {
 render(<Home onLogin={jest.fn()} />);
 const tab = document.querySelector('.form-tabs button.active') as HTMLButtonElement;
 fireEvent.click(tab);
 expect(document.querySelector('.form-tabs button.active')).toBe(tab);
});
