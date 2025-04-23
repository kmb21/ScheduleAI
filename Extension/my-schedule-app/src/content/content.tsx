
import { createRoot } from 'react-dom/client';
import Sidebar from '../Sidebar/sidebar';

const containerId = "loom-extension-container";

if (!document.getElementById(containerId)) {
  const container = document.createElement('div');
  container.id = containerId;
  container.style.position = 'fixed';
  container.style.top = '70px';
  container.style.right = '20px';
  container.style.width = '360px';
  container.style.height = 'auto';
  container.style.backgroundColor = 'white';
  container.style.border = '1px solid #ccc';
  container.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
  container.style.zIndex = '999999';
  container.style.borderRadius = '8px';
  container.style.overflow = 'auto';
  container.style.maxHeight = '90vh';
  container.style.padding = '10px';
  document.body.appendChild(container);

  const root = createRoot(container);
  root.render(<Sidebar />);
}
