import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Navigation } from './Navigation';

function renderNavigation(path = '/app/monitors') {
  return render(<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Navigation onLogout={jest.fn()} /></MemoryRouter>);
}

test('moves visual focus to the clicked group while preserving other expanded groups', () => {
  renderNavigation();
  const monitoring = screen.getByRole('button', { name: 'MONITORING' });
  const protocols = screen.getByRole('button', { name: 'PROTOCOL MONITORING' });
  expect(monitoring.closest('[data-section]')).toHaveAttribute('data-focused', 'true');
  fireEvent.click(protocols);
  expect(protocols).toHaveAttribute('aria-expanded', 'true');
  expect(protocols.closest('[data-section]')).toHaveAttribute('data-focused', 'true');
  expect(monitoring).toHaveAttribute('aria-expanded', 'false');
  expect(monitoring.closest('[data-section]')).not.toHaveAttribute('data-focused');
  fireEvent.click(protocols);
  expect(protocols).toHaveAttribute('aria-expanded', 'false');
  expect(protocols.closest('[data-section]')).not.toHaveAttribute('data-focused');
});

test('deep links and submenu navigation focus the owning group', () => {
  renderNavigation('/app/quality');
  const performance = screen.getByRole('button', { name: 'NETWORK PERFORMANCE' });
  expect(performance).toHaveAttribute('aria-expanded', 'false');
  expect(performance.closest('[data-section]')).toHaveAttribute('data-focused', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'MONITORING' }));
  fireEvent.click(screen.getByRole('link', { name: 'Targets' }));
  expect(screen.getByRole('link', { name: 'Targets' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('button', { name: 'MONITORING' }).closest('[data-section]')).toHaveAttribute('data-focused', 'true');
});

test('selecting a submenu link still closes mobile navigation', () => {
  renderNavigation();
  fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }));
  expect(screen.getByRole('navigation')).toHaveClass('mobile-open');
  fireEvent.click(screen.getByRole('button', { name: 'MONITORING' }));
  fireEvent.click(screen.getByRole('link', { name: 'Targets' }));
  expect(screen.getByRole('navigation')).not.toHaveClass('mobile-open');
});

test('System administration is absent from the vertical sidebar', () => {
  renderNavigation();
  expect(screen.queryByRole('button', { name: 'SYSTEM' })).not.toBeInTheDocument();
  for (const name of ['Users', 'Audit Logs', 'Settings', 'MT Backup', 'Tool Management']) {
    expect(screen.queryByRole('link', { name })).not.toBeInTheDocument();
  }
});
