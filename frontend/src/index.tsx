import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { AppearanceProvider } from './appearance/AppearanceProvider';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <AppearanceProvider><App /></AppearanceProvider>
  </React.StrictMode>
);
