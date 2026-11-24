import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export const DPITools = () => {
  const { hash } = useLocation();
  const section = ['#applications', '#runs', '#connection'].includes(hash) ? hash : '';

  useEffect(() => {
    // Keep the authenticated route on the NetMon origin; the dev server proxies
    // /dpi-tools to the separately running DPI application on port 3100.
    window.location.replace(`/dpi-tools/${section}`);
  }, [section]);

  return (
    <main className="app-loading" aria-label="DPI Tools">
      <p role="status">Opening DPI Tools…</p>
    </main>
  );
};
