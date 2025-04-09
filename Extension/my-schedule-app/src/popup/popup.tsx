import React, { useState } from 'react'

const Popup: React.FC = () => {
  const [scrapedText, setScrapedText] = useState<string | null>(null)

  const handleScrapeClick = () => {
    chrome.runtime.sendMessage({ type: 'SCRAPE_TEXT' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Error:", chrome.runtime.lastError.message)
        setScrapedText("Failed to retrieve page text.")
        return
      }

      if (response?.text) {
        setScrapedText(response.text)
      } else {
        setScrapedText("No text found on this page.")
      }
    })
  }

  return (
    <div
      style={{
        width: '360px',
        height: '300px',
        padding: '20px',
        fontFamily: 'sans-serif',
        backgroundColor: '#f9f9f9',
        boxSizing: 'border-box',
        overflowY: 'auto'
      }}
    >
      <h2 style={{ fontSize: '18px', marginBottom: '12px' }}>Smart Scheduler</h2>

      <button
        onClick={handleScrapeClick}
        style={{
          padding: '10px 16px',
          backgroundColor: '#007bff',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          marginBottom: '12px'
        }}
      >
        Scrape Current Page
      </button>

      {scrapedText && (
        <div
          style={{
            backgroundColor: '#fff3cd',
            color: '#856404',
            padding: '12px 16px',
            borderRadius: '8px',
            border: '1px solid #ffeeba',
            whiteSpace: 'pre-wrap',
            fontSize: '14px',
          }}
        >
          📄 <strong>Scraped:</strong> {scrapedText.slice(0, 500)}...
        </div>
      )}
    </div>
  )
}

export default Popup
