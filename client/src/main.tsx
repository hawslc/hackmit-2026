import React from 'react';
import ReactDOM from 'react-dom/client';
// TODO(ux): replace DevHarness with the real Setup / Practice / Review screens.
import { DevHarness } from './live/DevHarness';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DevHarness />
  </React.StrictMode>,
);
