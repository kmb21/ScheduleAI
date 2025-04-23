import React from 'react';
import { createRoot } from 'react-dom/client';
import Sidebar from './Sidebar/sidebar';

console.log('Panel script loaded!');

document.addEventListener('DOMContentLoaded', () => {
  const rootElement = document.getElementById('root');
  
  if (!rootElement) {
    console.error('Root element not found');
    document.body.innerHTML = '<div>Error: Root element not found</div>';
    return;
  }
  
  try {
    const root = createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <Sidebar />
      </React.StrictMode>
    );
    console.log('React rendered successfully');
  } catch (error) {
    console.error('Failed to render React app:', error);
    document.body.innerHTML = `<div>Error: Failed to render app: ${error}</div>`;
  }
});