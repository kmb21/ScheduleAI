import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';

import { EventItem, TodayIcon } from '../utils';
import { freeTextToGcal } from '../utils';
import MentionsInput from '../Mentions/mentions';

const urgencyRank: Record<NonNullable<EventItem['urgency']>, number> = {
  high:   0,
  medium: 1,
  low:    2
};

const Sidebar: React.FC = () => {
  const [events, setEvents]   = useState<EventItem[]>([]);
  const [loading, setLoading] = useState<boolean | { progress: string }>(false);
  // const [visible, setVisible] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [freeText, setFreeText] = useState('');
//   const [minimized, setMinimized] = useState(false);
  const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;


  useEffect(() => console.log('Sidebar mounted'), []);

  // -------- helper ---------- //
  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => {
      const ua = urgencyRank[a.urgency ?? 'low'];
      const ub = urgencyRank[b.urgency ?? 'low'];
      if (ua !== ub) return ua - ub;

      // Fallback secondary sort by (parsed) date if recognizable
      const ta = Date.parse(a.time?.iso ?? '') || Infinity;
      const tb = Date.parse(b.time?.iso ?? '') || Infinity;
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
            body: JSON.stringify({ text: JSON.stringify(response.text), user_timezone: JSON.stringify(userTimeZone) })
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
      setLoading(true);
      setError(null);
      const userNowISO = new Date().toISOString(); 

      const res = await axios.post('http://localhost:5001/parse_free_text', {
        text: freeText,
        user_timezone: userTimeZone,
        user_now: userNowISO        
      });
  
      const structuredEvents = res.data?.events || [];
  
      if (structuredEvents.length > 0) {
        // For each parsed event, immediately open Google Calendar
        structuredEvents.forEach((e:any) => {
          const event = {
            event: e.title,
            time: e.time,
            context: e.description,
            participants: e.participants || []
          };
          freeTextToGcal(event);
        });
      }
  
      setFreeText('');
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError('Failed to parse free text');
      setLoading(false);
    }
  };
  

  const openEmail = (ev:EventItem) => {
    if (!ev.gmailThread) return;
    window.open(`https://mail.google.com/mail/u/0/#inbox/${ev.gmailThread}`,'_blank');
  };

  const addToGCal = (e: EventItem) => {
    const title   = encodeURIComponent(e.event);
    const details = encodeURIComponent(e.context ?? '');
    const loc     = encodeURIComponent(e.sender ?? '');
  
    let start: string = '';
    let end: string | null = null;
  
    if (e.time?.iso && e.time.iso.includes('/')) {
      const [startStr, endStr] = e.time.iso.split('/');
      start = startStr.replace(/[-:.]/g, '').slice(0, 15);
      end   = endStr.replace(/[-:.]/g, '').slice(0, 15);
    } else if (e.time?.iso && e.time.iso.length >= 16) {
      start = e.time.iso.replace(/[-:.]/g, '').slice(0, 15);
      end = new Date(new Date(e.time.iso).getTime() + 60 * 60 * 1000)
               .toISOString().replace(/[-:.]/g, '').slice(0, 15);
    } else if (e.time?.iso) {
      start = e.time.iso.replace(/-/g, '');
      end = null;
    } else {
      const now = new Date();
      start = now.toISOString().replace(/[-:.]/g, '').slice(0, 15);
      end = new Date(now.getTime() + 60 * 60 * 1000)
               .toISOString().replace(/[-:.]/g, '').slice(0, 15);
    }
  
    const dateParam = end ? `${start}/${end}` : start;
  
    window.open(
      `https://calendar.google.com/calendar/r/eventedit?text=${title}` +
      `&details=${details}&location=${loc}&dates=${dateParam}`,
      '_blank'
    );
  };
  
  // -------------------------- //
  // if (!visible) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: 16, boxSizing: 'border-box' }}>
    {/* HEADER */}
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <h2 style={{ flex: 1, margin: 0, fontSize: 20 }}>Looma</h2>
        {/* <button 
          onClick={() => setVisible(false)} 
          style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>
          ✖
        </button> */}
      </div>
  
      {/* SCAN */}
      <button onClick={handleScan} disabled={!!loading}
        style={{
          marginTop: 12,
          padding: '10px 16px',
          borderRadius: 6,
          width: '100%',
          background: '#4285F4',
          color: '#fff',
          fontWeight: 600,
          border: 'none',
          cursor: loading ? 'not-allowed' : 'pointer'
        }}>
        {loading ? 'Scanning…' : 'Scan Current Page'}
      </button>
  
      {/* ERR */}
      {error && <div style={{ color: 'red', marginTop: 12 }}>{error}</div>}
    </div>
  
    {/* EVENTS SCROLLABLE AREA */}
    <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 160 }}>
      {sortedEvents.length ? (
        <>
          <h3 style={{ display: 'flex', alignItems: 'center', margin: '4px 0 10px' }}>
            <TodayIcon /> Upcoming Events
          </h3>
          {sortedEvents.map((ev, i) => (
            <div key={i}
              style={{
                border: '1px solid #ddd',
                borderRadius: 8,
                padding: 14,
                marginBottom: 14,
                boxShadow: '0 1px 4px rgba(0,0,0,.06)'
              }}>
              <h4 style={{ margin: '0 0 6px', fontSize: 16 }}>{ev.event}</h4>
              <p style={{ margin: 0, fontSize: 13, color: '#555' }}><strong>Time:</strong> {ev.time?.display ?? 'Not specified'}</p>
              {ev.context && <p style={{ margin: 0, fontSize: 13, color: '#555' }}><strong>Context:</strong> {ev.context}</p>}
              {ev.sender && <p style={{ margin: 0, fontSize: 13, color: '#555' }}><strong>Sender:</strong> {ev.sender}</p>}
              {ev.urgency && <p style={{ margin: '4px 0 0', fontSize: 13,
                color: ev.urgency === 'high' ? '#d93025' : ev.urgency === 'medium' ? '#e37400' : '#188038' }}>
                <strong>Urgency:</strong> {ev.urgency}
              </p>}
              {/* ACTIONS */}
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button onClick={() => addToGCal(ev)}
                  style={{
                    flex: 1, padding: '6px 10px', borderRadius: 4, fontSize: 13,
                    background: '#188038', color: '#fff', border: 'none', cursor: 'pointer'
                  }}>
                  ➕ Add to Calendar
                </button>
                <button onClick={() => openEmail(ev)} disabled={!ev.gmailThread}
                  style={{
                    flex: 1, padding: '6px 10px', borderRadius: 4, fontSize: 13,
                    background: '#fff', color: '#4285F4', border: '1px solid #4285F4',
                    cursor: 'pointer'
                  }}>
                  ✉️ Open Email
                </button>
              </div>
            </div>
          ))}
        </>
      ) : (
        !loading && <div style={{ textAlign: 'center', color: '#666' }}>No events yet — click “Scan”.</div>
      )}
    </div>
  
    {/* FOOTER FREE TEXT */}
    <div style={{
      position: 'sticky',
      bottom: 0,
      background: '#fff',
      paddingTop: 12,
      paddingBottom: 16,
      paddingLeft: 16,
      paddingRight: 16,
      zIndex: 20,
      boxShadow: '0 -4px 24px -12px rgba(0, 0, 0, 0.15)'
    }}>
      <MentionsInput 
        value={freeText} 
        onChange={setFreeText} 
        userEmail="mkumbon1@swarthmore.edu" 
      />
      <button onClick={handleFreeTextSubmit}
        style={{
          marginTop: 8,
          width: '100%',
          padding: '10px 0',
          borderRadius: 6,
          background: '#fbbc05',
          border: 'none',
          fontWeight: 600,
          cursor: 'pointer'
        }}>
        Parse & Add
      </button>
    </div>
  </div>
  
  );
};

export default Sidebar;
