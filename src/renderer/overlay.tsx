import React from 'react';
import { createRoot } from 'react-dom/client';
import OverlayApp from './OverlayApp';
import './styles/globals.css';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <OverlayApp />
    </React.StrictMode>
  );
}
