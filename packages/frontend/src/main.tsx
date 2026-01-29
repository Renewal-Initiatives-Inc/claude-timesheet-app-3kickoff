import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './App.css';
import { initializeCsrfToken } from './api/client.js';

// Initialize CSRF token before rendering to prevent CSRF errors on first login
initializeCsrfToken();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
