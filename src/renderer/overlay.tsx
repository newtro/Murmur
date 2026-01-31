import React from 'react';
import { createRoot } from 'react-dom/client';
import OverlayApp from './OverlayApp';

// Note: Don't import globals.css here - it adds background colors
// The overlay needs to be fully transparent

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <OverlayApp />
    </React.StrictMode>
  );
}
