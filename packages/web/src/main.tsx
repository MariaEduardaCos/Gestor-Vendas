import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.js';
import './index.css';
import { registrarServiceWorker } from './lib/pwa';

registrarServiceWorker();

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
