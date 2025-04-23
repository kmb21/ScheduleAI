import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';

import { EventItem, TodayIcon } from '../utils';

const urgencyRank: Record<NonNullable<EventItem['urgency']>, number> = {
  high:   0,
  medium: 1,
  low:    2
};

const Sidebar: React.FC = () => {
  const [events, setEvents]   = useState<EventItem[]>([]);
  const [loading, setLoading] = useState<boolean | { progress: string }>(false);
  const [visible, setVisible] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [freeText, setFreeText] = useState('');
//   const [minimized, setMinimized] = useState(false);


  useEffect(() => console.log('Sidebar mounted'), []);

  // -------- helper ---------- //
  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => {
      const ua = urgencyRank[a.urgency ?? 'low'];
      const ub = urgencyRank[b.urgency ?? 'low'];
      if (ua !== ub) return ua - ub;

      // Fallback secondary sort by (parsed) date if recognizable
      const ta = Date.parse(a.time ?? '') || Infinity;
      const tb = Date.parse(b.time ?? '') || Infinity;
      if (ta !== tb) return ta - tb;

      return a.event.localeCompare(b.event);
    });
  }, [events]);

  // ----- handlers ----------- //
  const handleScan = async () => {
    try {
      setLoading(true);
      setError(null);
      
      chrome.runtime.sendMessage({ type: 'SCRAPE_TEXT' }, async (response) => {
        if (!response || response.error) {
          setError(response?.error || 'No response from background script');
          setLoading(false);
          return;
        }
        
        try {
          // Use fetch with streaming instead of axios
          const fetchResponse = await fetch('http://localhost:5001/parse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: JSON.stringify(response.text) })
          });
          
          if (!fetchResponse.ok) {
            throw new Error(`HTTP error! Status: ${fetchResponse.status}`);
          }
          
          const reader = fetchResponse.body?.getReader();
          if (!reader) {
            throw new Error('Response body is not readable');
          }
          
          // Progress tracking
          let processedChunks = 0;
          let totalChunks = 0;
          
          // Clear existing events
          setEvents([]);
          
          // Process chunks as they come in
          const decoder = new TextDecoder();
          let buffer = '';
          
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            
            // Process complete lines from the buffer
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep the last incomplete line in the buffer
            
            for (const line of lines) {
              if (!line.trim()) continue;
              
              try {
                const data = JSON.parse(line);
                processedChunks = data.chunk_index;
                totalChunks = data.total_chunks;
                
                if (data.new_events?.length) {
                  setEvents(prev => [...prev, ...data.new_events]);
                }
                
                // Update loading status to show progress
                setLoading(prev => typeof prev === 'object'
                    ? { ...prev, progress: `${processedChunks}/${totalChunks}` }
                    : { progress: `${processedChunks}/${totalChunks}` });
                
                // Check if this is the final message
                if (data.complete) {
                  setLoading(false);
                }
              } catch (parseErr) {
                console.error('Error parsing stream data:', parseErr, line);
              }
            }
          }
        } catch (apiErr) {
          console.error(apiErr);
          setError('Failed to parse data');
          setLoading(false);
        }
      });
    } catch (err) {
      console.error(err);
      setError('Unexpected error');
      setLoading(false);
    }
  };

  const handleFreeTextSubmit = async () => {
    if (!freeText.trim()) return;
    try {
      const res = await axios.post('http://localhost:5001/parse', { text: freeText });
      setEvents(prev => [...prev, ...(res.data.structured?.events ?? [])]);
      setFreeText('');
    } catch { setError('Failed to parse free text'); }
  };

  const handleAddToGCal = (e: EventItem) => {
    const title   = encodeURIComponent(e.event);
    const details = encodeURIComponent(e.context ?? '');
    const loc     = encodeURIComponent(e.sender ?? '');
    const now     = new Date();
    const start   = now.toISOString().replace(/[-:.]/g, '').slice(0, 15);
    const end     = new Date(now.getTime() + 60 * 60 * 1000)
                       .toISOString().replace(/[-:.]/g, '').slice(0, 15);

    window.open(
      `https://calendar.google.com/calendar/r/eventedit?text=${title}` +
      `&details=${details}&location=${loc}&dates=${start}/${end}`,
      '_blank'
    );
  };
  // -------------------------- //
  if (!visible) return null;

  return (
    <div style={{
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      height: '100%'
    }}>
      {/* header */}
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
        <h2 style={{ margin:0 }}>Smart Scheduler</h2>
        <button onClick={() => setVisible(false)}
                style={{ background:'none', border:'none', fontSize:16, cursor:'pointer' }}>
          ❌
        </button>
      </div>

      {/* scan button */}
      <button onClick={handleScan} disabled={!!loading}
        style={{
          padding:'8px 16px', background:'#4285F4', color:'#fff', border:'none',
          borderRadius:4, cursor:loading?'not-allowed':'pointer', marginBottom:16
        }}>
  {loading === true ? 'Scanning…' : 
   typeof loading === 'object' ? `Scanning (${loading.progress})` : 
   'Scan Current Page'}
</button>

      {error && <div style={{ color:'red', marginBottom:16 }}>Error: {error}</div>}

      {/* events list */}
      <div style={{ flexGrow:1, overflowY:'auto', marginBottom:16 }}>
        {sortedEvents.length > 0 ? (
          <>
            <h3 style={{ marginBottom:10 }}><TodayIcon /> Upcoming Events</h3>
            {sortedEvents.map((e, i) => (
              <div key={i} style={{
                background:'#fff', border:'1px solid #ccc', borderRadius:8,
                padding:12, marginBottom:12, boxShadow:'0 2px 8px rgba(0,0,0,.05)'
              }}>
                <h4 style={{ margin:'0 0 8px' }}>{e.event}</h4>
                <p style={{ margin:'0 0 4px', color:'#555' }}><strong>Time:</strong> {e.time}</p>
                <p style={{ margin:'0 0 4px', color:'#555' }}><strong>Context:</strong> {e.context}</p>
                {e.sender && <p style={{ margin:'0 0 4px', color:'#555' }}>
                  <strong>Sender:</strong> {e.sender}
                </p>}
                {e.urgency && <p style={{
                    margin:0,
                    color:e.urgency==='high'?'red':e.urgency==='medium'?'orange':'green'
                  }}>
                  <strong>Urgency:</strong> {e.urgency}
                </p>}
                <button onClick={() => handleAddToGCal(e)}
                        style={{
                          marginTop:8, padding:'6px 12px', fontSize:14, borderRadius:4,
                          background:'#34A853', color:'#fff', border:'none', cursor:'pointer'
                        }}>
                  ➕ Google Calendar
                </button>
                
              </div>
            ))}
            
          </>
        ) : !loading && <div style={{ textAlign:'center', color:'#666' }}>
            No events yet – click “Scan”.
          </div>}
      </div>

      {/* free‑text composer (fixed bottom) */}
      <div style={{ flexShrink:0 }}>
        <textarea
          placeholder="e.g. ‘Intro call with Maxwell tomorrow 2 PM’"
          value={freeText}
          onChange={e => setFreeText(e.target.value)}
          rows={3}
          style={{
            width:'100%', borderRadius:8, border:'1px solid #ccc', padding:8,
            fontSize:14, resize:'none', marginBottom:8
          }}
        />
        <button onClick={handleFreeTextSubmit}
                style={{
                  padding:'8px 16px', width:'100%', fontWeight:600,
                  background:'#fbbc05', border:'none', borderRadius:4, cursor:'pointer'
                }}>
          Parse & Add
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
