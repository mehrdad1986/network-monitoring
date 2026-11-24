import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SystemMenu } from './SystemMenu';

function renderMenu(path = '/app/monitors') {
  return render(<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><SystemMenu /></MemoryRouter>);
}

test('opens account, preferences, security, and system administration destinations', () => {
  renderMenu();
  expect(screen.queryByRole('navigation', { name: 'System navigation' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'System' }));
  const destinations = {
    Profile: '/app/profile', Settings: '/app/settings', Preferences: '/app/settings?tab=preferences',
    Notifications: '/app/settings?tab=notifications', Security: '/app/settings?tab=security',
    Appearance: '/app/settings?tab=appearance', 'System Dashboard': '/app/system-dashboard',
    'Users & Roles': '/app/users', 'Audit Logs': '/app/audit-logs', 'Service Management': '/app/service-management',
    'Backup & Restore': '/app/backup', 'Tool Management': '/app/tool-management',
    'Software Updates': '/app/software-updates', 'Storage Management': '/app/storage-management',
  };
  for (const [name, path] of Object.entries(destinations)) expect(screen.getByRole('link', { name })).toHaveAttribute('href', path);
  expect(within(screen.getByRole('navigation', { name: 'System navigation' })).getAllByRole('link')).toHaveLength(Object.keys(destinations).length);
});

test('Operations exposes monitoring, diagnostics, routing, analytics, and scanner cards', () => {
  renderMenu();
  fireEvent.click(screen.getByRole('button', { name: /Operations/ }));
  const navigation = screen.getByRole('navigation', { name: 'Operations navigation' });
  const destinations = {
    'Network Targets': '/app/targets', 'DoH Servers': '/app/monitoring/doh',
    'Network Performance': '/app/network-performance', 'Ping Tool': '/app/ping-tools',
    'AS Path Analysis': '/app/as-path', 'BGP Intelligence': '/app/bgp-intelligence',
    'Historical Analysis': '/app/historical', 'DNS Hunter': '/app/dns-hunter',
    'NetMon Radar': '/app/netmon-radar', 'VPN Subscriptions': '/vpn', 'Contact Us': '/contact',
  };
  for (const [name, path] of Object.entries(destinations)) expect(screen.getByRole('link', { name })).toHaveAttribute('href', path);
  expect(navigation.querySelectorAll('a').length).toBeGreaterThan(50);
});

test('navigation closes the disclosure and marks the selected page', () => {
  renderMenu();
  fireEvent.click(screen.getByRole('button', { name: 'System' }));
  fireEvent.click(screen.getByRole('link', { name: 'Settings' }));
  const trigger = screen.getByRole('button', { name: 'System / Settings' });
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(trigger);
  expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page');
});

test('outside pointer closes the panel and Escape restores trigger focus', () => {
  renderMenu();
  const trigger = screen.getByRole('button', { name: 'System' });
  fireEvent.click(trigger);
  fireEvent.pointerDown(document.body);
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(trigger);
  screen.getByRole('link', { name: 'Users & Roles' }).focus();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
  expect(trigger).toHaveFocus();
});
