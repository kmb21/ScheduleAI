import React, { useState } from 'react'
import axios from 'axios'
import { encode } from 'gpt-3-encoder' // Install this: npm i gpt-3-encoder

// Split by paragraph blocks (emails/messages), fallback to sentence if too long
function chunkTextSmart(text: string, maxTokens = 4000): string[] {
  const blocks = text
    .split(/\n{2,}/) // split by empty lines (double newlines)
    .map(block => block.trim())
    .filter(Boolean)

  const chunks: string[] = []
  let currentChunk = ''
  let tokenCount = 0

  for (const block of blocks) {
    const blockTokens = encode(block).length

    if (blockTokens > maxTokens) {
      // Split long blocks into sentences if needed
      const sentences = block.split(/(?<=[.!?])\s+/)
      let temp = ''

      for (const sentence of sentences) {
        const sentenceTokens = encode(sentence).length
        if (encode(temp + sentence).length > maxTokens) {
          chunks.push(temp.trim())
          temp = sentence + ' '
        } else {
          temp += sentence + ' '
        }
      }
      if (temp.trim()) chunks.push(temp.trim())
    } else {
      if (tokenCount + blockTokens > maxTokens) {
        chunks.push(currentChunk.trim())
        currentChunk = block + '\n\n'
        tokenCount = blockTokens
      } else {
        currentChunk += block + '\n\n'
        tokenCount += blockTokens
      }
    }
  }

  if (currentChunk.trim()) chunks.push(currentChunk.trim())
  return chunks
}

const callApi = async (text: string): Promise<string> => {
  const response = await axios.post('http://localhost:5001/parse', { text })
  return response.data.structured
}

const Popup: React.FC = () => {
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleScanClick = async () => {
    setLoading(true)
    setAnalysis('Scanning page and analyzing...')

    chrome.runtime.sendMessage({ type: 'SCRAPE_TEXT' }, async (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error:', chrome.runtime.lastError.message)
        setAnalysis('Failed to retrieve page text.')
        setLoading(false)
        return
      }

      const text = response?.text
      if (!text) {
        setAnalysis('No text found on this page.')
        setLoading(false)
        return
      }

      try {
        const chunks = chunkTextSmart(text)
        const results = await Promise.all(chunks.map(callApi))
        setAnalysis(results.join('\n\n'))
      } catch (err) {
        console.error('AI error:', err)
        setAnalysis('Failed to analyze content.')
      } finally {
        setLoading(false)
      }
    })
  }

  return (
    <div
      style={{
        width: '360px',
        height: '400px',
        padding: '20px',
        fontFamily: 'sans-serif',
        backgroundColor: '#f9f9f9',
        boxSizing: 'border-box',
        overflowY: 'auto',
      }}
    >
      <h2 style={{ fontSize: '18px', marginBottom: '12px' }}>Smart Scheduler</h2>

      <button
        onClick={handleScanClick}
        disabled={loading}
        style={{
          padding: '10px 16px',
          backgroundColor: loading ? '#6c757d' : '#007bff',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          marginBottom: '12px',
        }}
      >
        {loading ? 'Scanning...' : 'Scan Page'}
      </button>

      {analysis && (
        <div
          style={{
            backgroundColor: '#e2f0cb',
            color: '#2e5736',
            padding: '12px 16px',
            borderRadius: '8px',
            border: '1px solid #bde2a7',
            whiteSpace: 'pre-wrap',
            fontSize: '14px',
          }}
        >
          📅 <strong>AI Summary:</strong>
          <br />
          {analysis}
        </div>
      )}
    </div>
  )
}

export default Popup
