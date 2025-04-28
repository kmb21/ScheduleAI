import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

interface Mention {
  email: string;
  name?: string;
}

interface Props {
  value: string;
  onChange: (val: string) => void;
  userEmail: string;
  apiUrl?: string;
}

const MentionsInput: React.FC<Props> = ({
  value,
  onChange,
  userEmail,
  apiUrl = 'http://localhost:5001/contacts'
}) => {
  const [allContacts, setAllContacts] = useState<Mention[]>([]);
  const [suggestions, setSuggestions] = useState<Mention[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const suggestionRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const loadContacts = async () => {
      if (!userEmail) return;
      setIsLoading(true);
      try {
        const res = await axios.post(apiUrl, { user_email: userEmail, query: '' });
        if (res.data?.contacts) {
          setAllContacts(res.data.contacts);
        }
      } catch (error) {
        setApiError('Failed to load contacts');
      } finally {
        setIsLoading(false);
      }
    };
    loadContacts();
  }, [userEmail, apiUrl]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    onChange(newText);

    const cursorPos = e.target.selectionStart ?? 0;
    const textBeforeCursor = newText.substring(0, cursorPos);
    const lastAt = textBeforeCursor.lastIndexOf('@');

    if (lastAt >= 0) {
      const afterAt = textBeforeCursor.slice(lastAt + 1);
      if (afterAt.length === 0 || /\s/.test(afterAt)) {
        setShowSuggestions(false);
      } else {
        showContactSuggestions(afterAt);
      }
    } else {
      setShowSuggestions(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showSuggestions) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestionIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestionIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      handleSelect(suggestions[activeSuggestionIndex]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const showContactSuggestions = (query: string) => {
    if (!query) {
      setSuggestions(allContacts.slice(0, 5));
      setActiveSuggestionIndex(0);
      setShowSuggestions(true);
      return;
    }

    const matches = allContacts
      .filter(c => c.email.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 10);

    const manualEntry = { email: query };
    setSuggestions(matches.length ? matches : [manualEntry]);
    setActiveSuggestionIndex(0);
    setShowSuggestions(true);
  };

  const handleSelect = (mention: Mention) => {
    const cursorPos = inputRef.current?.selectionStart || 0;
    const textBeforeCursor = value.substring(0, cursorPos);
    const textAfterCursor = value.substring(cursorPos);

    const lastAt = textBeforeCursor.lastIndexOf('@');
    if (lastAt >= 0) {
      const newText =
        textBeforeCursor.substring(0, lastAt) +
        mention.email +
        ' ' +
        textAfterCursor;

      onChange(newText);

      setTimeout(() => {
        const newCursor = lastAt + mention.email.length + 1;
        inputRef.current?.setSelectionRange(newCursor, newCursor);
      }, 0);
    }

    setShowSuggestions(false);
  };

  useEffect(() => {
    if (showSuggestions && suggestionRefs.current[activeSuggestionIndex]) {
      suggestionRefs.current[activeSuggestionIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    }
  }, [activeSuggestionIndex, showSuggestions]);

  return (
    <div style={{ position: 'relative' }}>
      <textarea
        ref={inputRef}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder="e.g. 'Intro call with @john tomorrow at 2pm... !Press @ to get suggestions!'"
        rows={3}
        style={{ width: '100%', borderRadius: 8, padding: 8 }}
      />

      {showSuggestions && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          background: '#fff',
          border: '1px solid #ddd',
          borderRadius: 4,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          maxHeight: '200px',
          overflowY: 'auto',
          zIndex: 999,
          animation: 'fadeIn 0.2s ease'
        }}>
          {isLoading ? (
            <div style={{ padding: 8 }}>Loading...</div>
          ) : apiError ? (
            <div style={{ padding: 8, color: 'red' }}>{apiError}</div>
          ) : suggestions.length > 0 ? (
            suggestions.map((mention, idx) => (
              <div
                ref={el => suggestionRefs.current[idx] = el}
                key={`${mention.email}-${idx}`}
                style={{
                  padding: 8,
                  borderBottom: '1px solid #eee',
                  cursor: 'pointer',
                  backgroundColor: idx === activeSuggestionIndex ? '#f0f0f0' : 'transparent'
                }}
                onMouseEnter={() => setActiveSuggestionIndex(idx)}
                onClick={() => handleSelect(mention)}
              >
                {mention.email}
              </div>
            ))
          ) : (
            <div style={{ padding: 8, color: '#666' }}>No suggestions</div>
          )}
        </div>
      )}

      {/* Fade-in animation */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default MentionsInput;
