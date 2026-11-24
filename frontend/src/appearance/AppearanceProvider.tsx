import { createContext, useContext, useEffect, useLayoutEffect, useState, ReactNode } from 'react';

export type Appearance = { version: 1; mode: 'dark' | 'light' | 'system'; depth: 'soft' | 'balanced' | 'deep'; accent: 'soft' | 'classic' | 'deep' };
export const appearanceKey = 'netmon.appearance.v1';
export const defaultAppearance: Appearance = { version: 1, mode: 'dark', depth: 'balanced', accent: 'classic' };

export function parseAppearance(value: string | null): Appearance {
  if (!value) return defaultAppearance;
  try {
    const data = JSON.parse(value);
    if (data?.version !== 1 || !['dark', 'light', 'system'].includes(data.mode) || !['soft', 'balanced', 'deep'].includes(data.depth) || !['soft', 'classic', 'deep'].includes(data.accent)) return defaultAppearance;
    return { version: 1, mode: data.mode, depth: data.depth, accent: data.accent };
  } catch { return defaultAppearance; }
}

const AppearanceContext = createContext<{ appearance: Appearance; update: (value: Partial<Omit<Appearance, 'version'>>) => void; reset: () => void; saved: boolean } | null>(null);

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearance] = useState(() => {
    try { return parseAppearance(localStorage.getItem(appearanceKey)); }
    catch { return defaultAppearance; }
  });
  const [saved, setSaved] = useState(true);
  const [deviceDark, setDeviceDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true);
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!query) return;
    const update = () => setDeviceDark(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  useLayoutEffect(() => {
    const theme = appearance.mode === 'system' ? (deviceDark ? 'dark' : 'light') : appearance.mode;
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.depth = appearance.depth;
    root.dataset.accent = appearance.accent;
    root.style.colorScheme = theme;
  }, [appearance, deviceDark]);
  useEffect(() => {
    try { localStorage.setItem(appearanceKey, JSON.stringify(appearance)); setSaved(true); }
    catch { setSaved(false); console.warn('Appearance preferences could not be saved in this browser.'); }
  }, [appearance]);
  return <AppearanceContext.Provider value={{ appearance, saved, update: value => setAppearance(previous => ({ ...previous, ...value })), reset: () => setAppearance(defaultAppearance) }}>{children}</AppearanceContext.Provider>;
}

export function useAppearance() {
  const value = useContext(AppearanceContext);
  if (!value) throw new Error('Appearance controls require AppearanceProvider');
  return value;
}
