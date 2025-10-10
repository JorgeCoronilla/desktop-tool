import React from 'react';
import './styles/theme.css';
import { createRoot } from 'react-dom/client';
import App from './App';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element not found');
}

// Tema por defecto: claro. Si existe preferencia guardada, respetarla.
const preferredTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', preferredTheme);

const root = createRoot(container);
root.render(<App />);
