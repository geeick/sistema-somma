import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import LocalAuthProvider from './lib/LocalAuthProvider';
import { installPortugueseTextReplacements } from './lib/portugueseText';
import { installExtraPortugueseTranslations } from './lib/portugueseTextExtra';

installPortugueseTextReplacements();
installExtraPortugueseTranslations();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <LocalAuthProvider>
        <App />
      </LocalAuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
