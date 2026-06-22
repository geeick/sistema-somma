import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import LocalAuthProvider from './lib/LocalAuthProvider';

// The Neon JS SDK may export UI components in a separate package or path.
// The quickstart sometimes references `@neondatabase/neon-js/ui` which
// may not be available for your installed SDK version. To avoid a hard
// dependency on the UI package, render the app directly. If you later
// install a provider component, wrap `<App/>` with it.

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <LocalAuthProvider>
        <App />
      </LocalAuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
