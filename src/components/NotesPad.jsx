import React, { useState, useEffect, useRef } from 'react';
import { Rnd } from 'react-rnd';
import { X, Minimize2, Maximize2, Trash2, Edit3 } from 'lucide-react';
import { fetchAPI } from '../api/apiClient';

export default function NotesPad({ testId, isVisible, onClose }) {
  const [content, setContent] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState({ x: window.innerWidth - 350, y: 100 });
  const [size, setSize] = useState({ width: 320, height: 400 });
  const syncTimerRef = useRef(null);
  const saveTimeoutRef = useRef(null);
  const lastSyncedContent = useRef('');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Initial load
  useEffect(() => {
    if (!testId || !isVisible) return;
    
    // Load from local storage first
    const localNotes = localStorage.getItem(`notes_${testId}`);
    if (localNotes) {
      setContent(localNotes);
      lastSyncedContent.current = localNotes;
    }

    // Fetch from backend
    const fetchNotes = async () => {
      try {
        const res = await fetchAPI(`/api/notes/${testId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.notes && data.notes.length > (localNotes?.length || 0)) {
            setContent(data.notes);
            lastSyncedContent.current = data.notes;
            localStorage.setItem(`notes_${testId}`, data.notes);
          }
        }
      } catch (err) {
        console.error("Failed to load notes", err);
      }
    };
    fetchNotes();

    // Setup 10-second backend sync loop
    syncTimerRef.current = setInterval(() => {
      syncToBackend();
    }, 10000);

    return () => {
      clearInterval(syncTimerRef.current);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      syncToBackend(); // Final sync on unmount
    };
  }, [testId, isVisible]);

  const syncToBackend = async () => {
    const currentContent = localStorage.getItem(`notes_${testId}`) || '';
    if (currentContent === lastSyncedContent.current || !testId) return;

    try {
      const res = await fetchAPI(`/api/notes/${testId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: currentContent })
      });
      if (res.ok) {
        lastSyncedContent.current = currentContent;
      }
    } catch (err) {
      console.error("Failed to sync notes", err);
    }
  };

  const handleChange = (e) => {
    const val = e.target.value;
    setContent(val);
    
    // Auto-save to localStorage immediately
    localStorage.setItem(`notes_${testId}`, val);

    // Debounce backend sync explicitly if needed, but the 10s loop handles it
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
        // Just storing it locally ensures no loss.
        // We'll let the 10s interval handle actual API calls.
    }, 500);
  };

  const handleClear = () => {
    setContent('');
    localStorage.removeItem(`notes_${testId}`);
    syncToBackend();
  };

  if (!isVisible) return null;

  if (isMobile) {
    return (
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, height: isMinimized ? 50 : '60vh',
        background: 'var(--surface)', borderTop: '1px solid var(--accent)', zIndex: 9999,
        transition: 'height 0.3s ease', display: 'flex', flexDirection: 'column'
      }}>
        {/* Header */}
        <div onClick={() => setIsMinimized(!isMinimized)} style={{
          padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderBottom: '1px solid var(--border)', background: 'var(--surface2)', cursor: 'pointer'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text)', fontWeight: 600 }}>
            <Edit3 size={16} color="var(--accent)" /> Rough Notes
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
             {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
             <X size={16} onClick={(e) => { e.stopPropagation(); onClose(); }} />
          </div>
        </div>
        
        {!isMinimized && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 12 }}>
            <textarea
              value={content}
              onChange={handleChange}
              placeholder="Write your notes here..."
              style={{
                flex: 1, width: '100%', resize: 'none', background: 'transparent',
                border: 'none', color: 'var(--text)', outline: 'none', fontSize: 14,
                lineHeight: 1.5, fontFamily: 'inherit'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>
              <span>Characters: {content.length}</span>
              <button onClick={handleClear} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 12 }}>
                <Trash2 size={12} /> Clear
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <Rnd
      size={isMinimized ? { width: 200, height: 48 } : size}
      position={position}
      onDragStop={(e, d) => setPosition({ x: d.x, y: d.y })}
      onResizeStop={(e, direction, ref, delta, position) => {
        setSize({ width: ref.style.width, height: ref.style.height });
        setPosition(position);
      }}
      minWidth={isMinimized ? 200 : 300}
      minHeight={isMinimized ? 48 : 250}
      maxWidth="70vw"
      maxHeight="80vh"
      disableDragging={false}
      enableResizing={!isMinimized}
      dragHandleClassName="notes-drag-handle"
      style={{ zIndex: 9999 }}
    >
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(10px)',
        border: '1px solid var(--accent)', borderRadius: 12, overflow: 'hidden',
        boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
      }}>
        {/* Header - Drag Handle */}
        <div className="notes-drag-handle" style={{
          padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'var(--surface2)', cursor: 'grab', borderBottom: '1px solid var(--border)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'white', fontWeight: 600, fontSize: 14 }}>
            <Edit3 size={16} color="var(--accent)" /> Notes
          </div>
          <div style={{ display: 'flex', gap: 12, color: '#94a3b8' }}>
            <button onClick={() => setIsMinimized(!isMinimized)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>
              {isMinimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        {!isMinimized && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '12px 16px' }}>
            <textarea
              value={content}
              onChange={handleChange}
              placeholder="Write your rough work and notes here..."
              style={{
                flex: 1, width: '100%', resize: 'none', background: 'transparent',
                border: 'none', color: '#e2e8f0', outline: 'none', fontSize: 14,
                lineHeight: 1.5, fontFamily: 'Space Grotesk'
              }}
            />
            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>Characters: {content.length}</span>
              <button onClick={handleClear} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                <Trash2 size={14} /> Clear Notes
              </button>
            </div>
          </div>
        )}
      </div>
    </Rnd>
  );
}
