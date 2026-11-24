import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AppearanceProvider, appearanceKey, defaultAppearance, parseAppearance } from './AppearanceProvider';
import { AppearanceSettings } from '../components/AppearanceSettings';

beforeEach(() => localStorage.clear());
test('validates stored preferences and ignores unsupported or broken data', () => {
  for (const value of ['broken', '{}', 'null', JSON.stringify({ ...defaultAppearance, version: 2 }), JSON.stringify({ ...defaultAppearance, accent: 'invalid' })]) expect(parseAppearance(value)).toEqual(defaultAppearance);
});
test('applies theme, shade and accent immediately, persists and restores them', async () => {
  const first = render(<AppearanceProvider><AppearanceSettings /></AppearanceProvider>);
  fireEvent.click(screen.getByRole('button', { name: /Light Bright/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Deeper' }));
  fireEvent.click(screen.getByRole('button', { name: 'deep blue accent' }));
  expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  expect(document.documentElement).toHaveAttribute('data-depth', 'deep');
  expect(document.documentElement).toHaveAttribute('data-accent', 'deep');
  await waitFor(() => expect(JSON.parse(localStorage.getItem(appearanceKey) || '{}').mode).toBe('light'));
  first.unmount();
  render(<AppearanceProvider><AppearanceSettings /></AppearanceProvider>);
  expect(screen.getByRole('button', { name: /Light Bright/ })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: /Reset to defaults/ }));
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  expect(document.documentElement).toHaveAttribute('data-depth', 'balanced');
});
test('keeps theme controls working when storage is blocked', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const storage = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  render(<AppearanceProvider><AppearanceSettings /></AppearanceProvider>);
  fireEvent.click(screen.getByRole('button', { name: /Light Bright/ }));
  expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  expect(screen.getByRole('status')).toHaveTextContent('this session');
  storage.mockRestore(); warn.mockRestore();
});

test('device mode follows preference changes and removes its listener on unmount', () => {
  let listener: () => void = () => {};
  const query = { matches: true, addEventListener: jest.fn((_, handler) => { listener = handler; }), removeEventListener: jest.fn() };
  const original = window.matchMedia;
  window.matchMedia = jest.fn().mockReturnValue(query);
  const view = render(<AppearanceProvider><AppearanceSettings /></AppearanceProvider>);
  fireEvent.click(screen.getByRole('button', { name: /Use device Follow/ }));
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  act(() => { query.matches = false; listener(); });
  expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  view.unmount(); expect(query.removeEventListener).toHaveBeenCalled();
  window.matchMedia = original;
});
