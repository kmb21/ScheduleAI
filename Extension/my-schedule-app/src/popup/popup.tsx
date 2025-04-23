import React from 'react';

const Popup: React.FC = () => {
  const openSidebar = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0].id) {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          files: ['content.js'],
        });
      }
    });
  };

  return (
    <div style={{ padding: '16px' }}>
      <h2>Smart Scheduler</h2>
      <button onClick={openSidebar} style={{ padding: '8px 12px', marginTop: '12px' }}>
        Open Sidebar
      </button>
    </div>
  );
};

export default Popup;
