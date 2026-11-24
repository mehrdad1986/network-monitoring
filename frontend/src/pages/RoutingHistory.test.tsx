import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { saveRoutingHistory } from '../services/routing';
import { RoutingHistory } from './RoutingHistory';

test('shows and removes actual browser-saved routing checks', () => {
  localStorage.clear();
  const entry = saveRoutingHistory({ kind: 'AS path lookup', input: '8.8.8.8', summary: 'RIPE RIS lookup completed' });
  render(<RoutingHistory />);
  expect(screen.getByText('8.8.8.8')).toBeInTheDocument();
  expect(screen.getByText('RIPE RIS lookup completed')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Remove AS path lookup for 8.8.8.8' }));
  expect(screen.getByText('No routing checks saved')).toBeInTheDocument();
  expect(localStorage.getItem('netmon.routing.history.v1')).not.toContain(entry[0].id);
});
