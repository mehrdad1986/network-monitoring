import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import './StandaloneToolShell.css';

export function StandaloneToolShell({ title, children }: { title: string; children: ReactNode }) {
  return <main className="standalone-tool-shell">
    <header className="standalone-tool-header">
      <span>{title}</span>
      <Link to="/dashboard" aria-label="Back to dashboard" title="Back to dashboard">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5m7 7-7-7 7-7" /></svg>
      </Link>
    </header>
    {children}
  </main>;
}
