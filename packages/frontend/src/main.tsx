import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider as OidcProvider } from 'react-oidc-context';
import App from './App';
import './App.css';
import { oidcConfig } from './auth/oidc-config.js';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <OidcProvider {...oidcConfig}>
      <App />
    </OidcProvider>
  </StrictMode>
);
